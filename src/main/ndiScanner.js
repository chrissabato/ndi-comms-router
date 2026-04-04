const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const POLL_INTERVAL_MS = 3000;

class NdiScanner extends EventEmitter {
  constructor() {
    super();
    this._binaryPath = 'ndi-free-audio';
    this._sources = [];
    this._timer = null;
    this._running = false;
  }

  setBinaryPath(p) {
    this._binaryPath = p;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._poll();
    this._timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  getSources() {
    return this._sources;
  }

  _poll() {
    if (!this._binaryPath) return;

    let proc;
    try {
      proc = spawn(this._binaryPath, ['--list'], {
        windowsHide: true,
        timeout: 5000,
      });
    } catch (err) {
      // Binary not found or not executable — silently skip
      return;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const combined = stdout + stderr;
      const parsed = this._parse(combined);
      if (JSON.stringify(parsed) !== JSON.stringify(this._sources)) {
        this._sources = parsed;
        this.emit('sources', this._sources);
      }
    });

    proc.on('error', () => {
      // Binary not found — emit empty if we had sources before
      if (this._sources.length > 0) {
        this._sources = [];
        this.emit('sources', this._sources);
      }
    });
  }

  _parse(output) {
    const sources = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // ndi-free-audio --list typically outputs lines like:
      //   XR18-PC . Comms TX
      //   DANTE-PC . Comms TX
      // or with IP:
      //   XR18-PC . Comms TX (192.168.1.10)
      // We capture anything that looks like an NDI source name

      // Skip header/status lines
      if (
        trimmed.startsWith('NDI') ||
        trimmed.startsWith('Found') ||
        trimmed.startsWith('Scanning') ||
        trimmed.startsWith('Source') ||
        trimmed.startsWith('No ') ||
        trimmed.startsWith('Error') ||
        trimmed.startsWith('[')
      ) continue;

      // Extract hostname from "HOSTNAME . Stream Name" pattern
      const dotMatch = trimmed.match(/^([A-Za-z0-9_\-]+)\s*\.\s*(.+?)(?:\s*\(([^)]+)\))?$/);
      if (dotMatch) {
        sources.push({
          name: trimmed.replace(/\s*\([^)]+\)$/, '').trim(),
          hostname: dotMatch[1],
          streamName: dotMatch[2].trim(),
          ip: dotMatch[3] || null,
        });
        continue;
      }

      // Fallback: anything non-empty that doesn't look like a status line
      if (trimmed.length > 2 && !trimmed.includes(':') && !trimmed.startsWith('-')) {
        sources.push({
          name: trimmed,
          hostname: trimmed.split(/\s/)[0],
          streamName: trimmed,
          ip: null,
        });
      }
    }

    return sources;
  }
}

module.exports = new NdiScanner();
