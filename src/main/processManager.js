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
    this._rxSourceWatcher = null;
    this._pendingSources = null;
  }

  setBinaryPath(p) {
    this._binaryPath = p;
  }

  getStatus() {
    return { ...this._status };
  }

  // Build CLI args from leg params
  _buildArgs(leg, params) {
    const hostname = os.hostname().toUpperCase().replace(/[^A-Z0-9\-]/g, '-');
    const args = [];

    if (leg === 'tx') {
      args.push('--tx');
      // Stream name: "HOSTNAME . Comms TX"
      const streamName = params.streamName || `${hostname} . Comms TX`;
      args.push('-s', streamName);
    } else {
      args.push('--rx');
      // Source to subscribe to
      const source = params.source || '';
      args.push('-s', source);
    }

    if (params.device) args.push('-d', params.device);
    if (typeof params.gain === 'number') args.push('-g', String(params.gain));
    if (params.latency) args.push('-b', String(params.latency));
    if (params.networkInterface && params.networkInterface !== 'auto') {
      args.push('-i', params.networkInterface);
    }

    return args;
  }

  buildCommandPreview(leg, params) {
    const args = this._buildArgs(leg, params || {});
    return `${this._binaryPath} ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`;
  }

  startLeg(leg, params) {
    if (this._processes[leg]) this.stopLeg(leg);
    this._params[leg] = params;

    // For RX: if source not yet available, hold in waiting state
    if (leg === 'rx' && params.waitForSource && params.source) {
      const available = this._pendingSources &&
        this._pendingSources.some(s => s.name === params.source || s.name.includes(params.source));
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
    this._emitLog(leg, `Started: ${this._binaryPath} ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`);

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._emitLog(leg, trimmed);
        this._parseVu(leg, trimmed);
      }
    });

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._emitLog(leg, trimmed, 'error');
      }
    });

    proc.on('close', (code, signal) => {
      this._processes[leg] = null;
      if (signal === 'SIGTERM' || code === null) {
        this._setStatus(leg, 'stopped');
        this._emitLog(leg, `Process stopped (signal: ${signal || 'none'})`);
      } else if (code !== 0) {
        this._setStatus(leg, 'error');
        this._emitLog(leg, `Process exited with code ${code}`, 'error');
      } else {
        this._setStatus(leg, 'idle');
        this._emitLog(leg, 'Process exited cleanly');
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
      try {
        proc.kill('SIGTERM');
        // Force-kill after 3s if still alive
        setTimeout(() => {
          if (this._processes[leg] === proc) {
            try { proc.kill('SIGKILL'); } catch {}
          }
        }, 3000);
      } catch {}
      this._processes[leg] = null;
    }
    if (this._status[leg] !== 'idle') {
      this._setStatus(leg, 'idle');
    }
  }

  startBoth(txParams, rxParams) {
    this.startLeg('tx', txParams);
    this.startLeg('rx', rxParams);
  }

  stopAll() {
    this.stopLeg('tx');
    this.stopLeg('rx');
  }

  // Called by main index when NDI sources update — auto-connect waiting RX
  onSourcesUpdate(sources) {
    this._pendingSources = sources;
    if (this._status.rx === 'waiting' && this._params.rx) {
      const source = this._params.rx.source;
      const found = sources.some(s => s.name === source || s.name.includes(source));
      if (found) {
        this._emitLog('rx', `Source found: ${source} — connecting...`);
        this._spawn('rx', this._params.rx);
      }
    }
  }

  // Auto-reconnect if source drops (for RX in running state)
  onProcessClosed(leg) {
    if (leg === 'rx' && this._params.rx && this._params.rx.autoReconnect) {
      this._setStatus('rx', 'waiting');
      this._emitLog('rx', 'Connection lost — waiting to reconnect...');
    }
  }

  cleanup() {
    this.stopAll();
  }

  _setStatus(leg, status) {
    this._status[leg] = status;
    this.emit('status', { leg, status });
  }

  _emitLog(leg, message, level) {
    this.emit('log', { leg, message, level: level || 'info', timestamp: Date.now() });
  }

  _parseVu(leg, line) {
    // Try various patterns ndi-free-audio might use for VU output
    // Pattern 1: "L: -12.3 dB  R: -9.8 dB"
    let m = line.match(/L[:\s]+(-?\d+(?:\.\d+)?)\s*dB.*R[:\s]+(-?\d+(?:\.\d+)?)\s*dB/i);
    if (m) {
      this.emit('vu', { leg, left: parseFloat(m[1]), right: parseFloat(m[2]) });
      return;
    }
    // Pattern 2: "VU: -12.3 -9.8"
    m = line.match(/VU[:\s]+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
    if (m) {
      this.emit('vu', { leg, left: parseFloat(m[1]), right: parseFloat(m[2]) });
      return;
    }
    // Pattern 3: "[TX] L=-12.3 R=-9.8"
    m = line.match(/L=(-?\d+(?:\.\d+)?)\s+R=(-?\d+(?:\.\d+)?)/i);
    if (m) {
      this.emit('vu', { leg, left: parseFloat(m[1]), right: parseFloat(m[2]) });
    }
  }
}

module.exports = new ProcessManager();
