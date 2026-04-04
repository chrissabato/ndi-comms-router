const { spawn } = require('child_process');
const { EventEmitter } = require('events');

// NDI FreeAudio has no --list flag. We attempt common discovery flags
// and parse any source-looking output. Manual entry is the reliable fallback.
const DISCOVERY_FLAGS = [['--list'], ['-list'], ['--sources'], ['-sources']];
const POLL_INTERVAL_MS = 5000;

class NdiScanner extends EventEmitter {
  constructor() {
    super();
    this._binaryPath = null;
    this._sources = [];
    this._timer = null;
    this._running = false;
    this._flagIndex = 0;       // which discovery flag to try next
    this._flagConfirmed = false; // once one flag works, stick with it
    this._loggedNoFlag = false;
  }

  setBinaryPath(p) {
    this._binaryPath = p;
    this._flagIndex = 0;
    this._flagConfirmed = false;
    this._loggedNoFlag = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._poll();
    this._timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  getSources() { return this._sources; }

  // Allow renderer to inject manually-entered sources
  addManualSource(name) {
    const hostname = name.split(/[\s.(]/)[0];
    const existing = this._sources.find(s => s.name === name);
    if (!existing) {
      this._sources = [...this._sources, { name, hostname, streamName: name, ip: null, manual: true }];
      this.emit('sources', this._sources);
    }
  }

  removeManualSource(name) {
    const updated = this._sources.filter(s => s.name !== name);
    if (updated.length !== this._sources.length) {
      this._sources = updated;
      this.emit('sources', this._sources);
    }
  }

  _log(message, level = 'info') {
    this.emit('log', { leg: 'sys', message: `[NDI Scanner] ${message}`, level, timestamp: Date.now() });
  }

  _poll() {
    if (!this._binaryPath) return;

    // If we've exhausted all flags, stop polling (manual entry only)
    if (!this._flagConfirmed && this._flagIndex >= DISCOVERY_FLAGS.length) {
      if (!this._loggedNoFlag) {
        this._loggedNoFlag = true;
        this._log(
          'NDI FreeAudio has no source-listing flag — enter NDI source names manually in the RX panel',
          'info'
        );
      }
      return;
    }

    const flags = this._flagConfirmed
      ? DISCOVERY_FLAGS[this._flagIndex]
      : DISCOVERY_FLAGS[this._flagIndex];

    let proc;
    try {
      proc = spawn(this._binaryPath, flags, {
        windowsHide: true,
        timeout: 5000,
      });
    } catch (err) {
      this._log(`Binary not found: "${this._binaryPath}" — set correct path in Settings`, 'error');
      return;
    }

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const combined = (stdout + stderr).trim();
      const parsed = this._parse(combined);

      if (parsed.length > 0) {
        // This flag works — lock in
        this._flagConfirmed = true;
        if (JSON.stringify(parsed) !== JSON.stringify(this._sources.filter(s => !s.manual))) {
          const manual = this._sources.filter(s => s.manual);
          this._sources = [...parsed, ...manual];
          this._log(`Found ${parsed.length} source(s): ${parsed.map(s => s.name).join(', ')}`);
          this.emit('sources', this._sources);
        }
      } else if (!this._flagConfirmed) {
        // Try next flag
        this._flagIndex++;
      }
    });

    proc.on('error', (err) => {
      this._log(`Scanner error: ${err.message}`, 'error');
    });
  }

  _parse(output) {
    const sources = [];
    const seen = new Set();

    for (const rawLine of output.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      // Skip header/help/option lines
      if (/^(NDI Free Audio|Copyright|Options|Input Devices|Output Devices|Usage|Found \d|Scanning|Searching|-input|-output|-input_name|-output_name|-input_gain|-output_gain|or -|Version)/i.test(line)) continue;
      if (/^\d+\s*:\s*/.test(line)) continue; // device list lines
      if (line.startsWith('-')) continue;

      // "HOSTNAME (stream name)"
      const parenMatch = line.match(/^([^(]+?)\s+\(([^)]+)\)\s*$/);
      if (parenMatch) {
        const hostname = parenMatch[1].trim();
        const streamName = parenMatch[2].trim();
        const name = `${hostname} (${streamName})`;
        if (!seen.has(name)) { seen.add(name); sources.push({ name, hostname, streamName, ip: null }); }
        continue;
      }

      // "HOSTNAME . stream name" or "HOSTNAME . stream name (ip)"
      const dotMatch = line.match(/^([A-Za-z0-9_\-]+)\s*\.\s*(.+?)(?:\s*\(([^)]+)\))?$/);
      if (dotMatch) {
        const hostname = dotMatch[1].trim();
        const streamName = dotMatch[2].trim();
        const ip = dotMatch[3] || null;
        const name = `${hostname} . ${streamName}`;
        if (!seen.has(name)) { seen.add(name); sources.push({ name, hostname, streamName, ip }); }
        continue;
      }

      // Numbered: "1: HOSTNAME ..." or "1) HOSTNAME ..."
      const numberedMatch = line.match(/^\d+[):.\s]\s*(.+)$/);
      if (numberedMatch) {
        const sub = this._parse(numberedMatch[1].trim());
        for (const s of sub) {
          if (!seen.has(s.name)) { seen.add(s.name); sources.push(s); }
        }
      }
    }

    return sources;
  }
}

module.exports = new NdiScanner();
