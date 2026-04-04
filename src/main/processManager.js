const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const os = require('os');

// Status values: idle | waiting | running | error | stopped
class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this._binaryPath = 'ndi-free-audio';
    this._processes = { tx: null, rx: null };
    this._status = { tx: 'idle', rx: 'idle' };
    this._params = { tx: null, rx: null };
    this._pendingSources = null;
  }

  setBinaryPath(p) {
    this._binaryPath = p;
  }

  getStatus() {
    return { ...this._status };
  }

  // Format gain value as the binary expects: "+0dB", "-10dB", "+6dB"
  _formatGain(gain) {
    const n = Number(gain) || 0;
    return `${n >= 0 ? '+' : ''}${n}dB`;
  }

  // Build CLI args from leg params
  // TX: -input "device" -input_name "HOSTNAME . Comms TX" -input_gain +0dB
  // RX: -output "device" -output_name "REMOTE . Comms TX" -output_gain +0dB
  _buildArgs(leg, params) {
    const args = [];

    if (leg === 'tx') {
      if (params.device) args.push('-input', params.device);
      const hostname = os.hostname().toUpperCase().replace(/[^A-Z0-9\-]/g, '-');
      const streamName = params.streamName || `${hostname} . Comms TX`;
      args.push('-input_name', streamName);
      if (typeof params.gain === 'number') args.push('-input_gain', this._formatGain(params.gain));
    } else {
      if (params.device) args.push('-output', params.device);
      if (params.source) args.push('-output_name', params.source);
      if (typeof params.gain === 'number') args.push('-output_gain', this._formatGain(params.gain));
    }

    return args;
  }

  buildCommandPreview(leg, params) {
    const args = this._buildArgs(leg, params || {});
    const bin = `"${this._binaryPath}"`;
    return `${bin} ${args.map(a => a.startsWith('-') ? a : `"${a}"`).join(' ')}`;
  }

  startLeg(leg, params) {
    if (this._processes[leg]) this.stopLeg(leg);
    this._params[leg] = params;

    // For RX: if source not yet available, hold in waiting state
    if (leg === 'rx' && params.waitForSource && params.source) {
      const available = this._pendingSources &&
        this._pendingSources.some(s => s.name === params.source);
      if (!available) {
        this._setStatus(leg, 'waiting');
        this._emitLog(leg, `Waiting for NDI source: ${params.source}`);
        return { status: 'waiting' };
      }
    }

    return this._spawn(leg, params);
  }

  _spawn(leg, params) {
    const args = this._buildArgs(leg, params);
    let proc;

    try {
      proc = spawn(this._binaryPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      this._setStatus(leg, 'error');
      this._emitLog(leg, `Failed to start: ${err.message}`, 'error');
      return { status: 'error', error: err.message };
    }

    this._processes[leg] = proc;
    this._setStatus(leg, 'running');
    this._emitLog(leg, `Started: ${this.buildCommandPreview(leg, params)}`);

    proc.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._emitLog(leg, trimmed);
        this._parseVu(leg, trimmed);
      }
    });

    proc.stderr.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._emitLog(leg, trimmed, 'error');
      }
    });

    proc.on('close', (code, signal) => {
      this._processes[leg] = null;
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        this._setStatus(leg, 'stopped');
      } else if (code === 0) {
        // Exited cleanly but unexpectedly — likely showed help (wrong args)
        this._setStatus(leg, 'error');
        this._emitLog(leg, `Process exited immediately (code 0) — check device name and binary path`, 'error');
      } else if (code !== null) {
        this._setStatus(leg, 'error');
        this._emitLog(leg, `Process exited with code ${code}`, 'error');
      } else {
        this._setStatus(leg, 'stopped');
      }

      // Auto-reconnect RX if it was running and we want to persist
      if (leg === 'rx' && this._params.rx?.autoReconnect && this._status.rx !== 'stopped') {
        this._setStatus('rx', 'waiting');
        this._emitLog('rx', 'Connection lost — waiting to reconnect...');
      }
    });

    proc.on('error', (err) => {
      this._processes[leg] = null;
      this._setStatus(leg, 'error');
      this._emitLog(leg, `Process error: ${err.message}`, 'error');
    });

    return { status: 'running' };
  }

  stopLeg(leg) {
    const proc = this._processes[leg];
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      setTimeout(() => {
        if (this._processes[leg] === proc) {
          try { proc.kill('SIGKILL'); } catch {}
        }
      }, 3000);
      this._processes[leg] = null;
    }
    this._setStatus(leg, 'idle');
    // Clear autoReconnect so it doesn't try to come back
    if (this._params[leg]) this._params[leg].autoReconnect = false;
  }

  startBoth(txParams, rxParams) {
    this.startLeg('tx', txParams);
    this.startLeg('rx', rxParams);
  }

  stopAll() {
    this.stopLeg('tx');
    this.stopLeg('rx');
  }

  onSourcesUpdate(sources) {
    this._pendingSources = sources;
    if (this._status.rx === 'waiting' && this._params.rx?.source) {
      const found = sources.some(s => s.name === this._params.rx.source);
      if (found) {
        this._emitLog('rx', `Source found: ${this._params.rx.source} — connecting...`);
        this._spawn('rx', this._params.rx);
      }
    }
  }

  cleanup() {
    if (this._params.tx) this._params.tx.autoReconnect = false;
    if (this._params.rx) this._params.rx.autoReconnect = false;
    this.stopAll();
  }

  _setStatus(leg, status) {
    this._status[leg] = status;
    this.emit('status', { leg, status });
  }

  _emitLog(leg, message, level = 'info') {
    this.emit('log', { leg, message, level, timestamp: Date.now() });
  }

  _parseVu(leg, line) {
    // NDI FreeAudio outputs levels like: "Level: -12.3 dB / -9.8 dB"
    let m = line.match(/Level[:\s]+(-?\d+(?:\.\d+)?)\s*dB\s*\/\s*(-?\d+(?:\.\d+)?)\s*dB/i);
    if (m) { this.emit('vu', { leg, left: parseFloat(m[1]), right: parseFloat(m[2]) }); return; }

    // "L: -12.3 dB  R: -9.8 dB"
    m = line.match(/L[:\s]+(-?\d+(?:\.\d+)?)\s*dB.*R[:\s]+(-?\d+(?:\.\d+)?)\s*dB/i);
    if (m) { this.emit('vu', { leg, left: parseFloat(m[1]), right: parseFloat(m[2]) }); return; }

    // "-12.3 / -9.8" or "-12.3 -9.8" (two floats)
    m = line.match(/^(-?\d+(?:\.\d+)?)\s*[\/,]\s*(-?\d+(?:\.\d+)?)$/);
    if (m) { this.emit('vu', { leg, left: parseFloat(m[1]), right: parseFloat(m[2]) }); }
  }
}

module.exports = new ProcessManager();
