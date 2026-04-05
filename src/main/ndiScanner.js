const { EventEmitter } = require('events');

// grandiose.find(options, waitMs) is async — returns a Promise that resolves
// with an array of { name, urlAddress } objects. The wait happens in a worker
// thread so it never blocks the main thread.
const POLL_INTERVAL_MS = 5000;
const FIND_WAIT_MS = 500; // worker waits up to 2x this per NDI SDK call

let grandiose = null;
try {
  grandiose = require('grandiose');
} catch (_) {
  // grandiose not available — manual entry only
}

class NdiScanner extends EventEmitter {
  constructor() {
    super();
    this._discoveryServer = '';
    this._discoveredSources = [];
    this._manualSources = [];
    this._timer = null;
    this._running = false;
    this._polling = false;
  }

  // binaryPath no longer needed (grandiose uses NDI SDK directly)
  // kept as no-op so callers don't need to change
  setBinaryPath() {}

  setDiscoveryServer(ip) {
    this._discoveryServer = (ip || '').trim();
  }

  start() {
    if (this._running) return;
    this._running = true;
    if (!grandiose) {
      this._log('grandiose not available — add NDI sources manually in the RX panel.', 'info');
    } else {
      this._log(
        'NDI source discovery started' +
        (this._discoveryServer ? ` (discovery server: ${this._discoveryServer})` : '')
      );
      this._doPoll();
    }
    this._timer = setInterval(() => this._doPoll(), POLL_INTERVAL_MS);
  }

  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  getSources() {
    return [...this._discoveredSources, ...this._manualSources];
  }

  addManualSource(name) {
    if (!this._manualSources.find(s => s.name === name)) {
      this._manualSources = [...this._manualSources, { name, manual: true }];
      this.emit('sources', this.getSources());
    }
  }

  removeManualSource(name) {
    const before = this._manualSources.length;
    this._manualSources = this._manualSources.filter(s => s.name !== name);
    if (this._manualSources.length !== before) {
      this.emit('sources', this.getSources());
    }
  }

  async _doPoll() {
    if (!grandiose || this._polling) return;
    this._polling = true;
    try {
      const opts = {};
      if (this._discoveryServer) opts.extraIPs = this._discoveryServer;
      const raw = await grandiose.find(opts, FIND_WAIT_MS);
      const parsed = raw.map(s => ({
        name: s.name,
        urlAddress: s.urlAddress || null,
        manual: false,
      }));

      this._log(`Poll: found ${parsed.length} source(s)${parsed.length ? ': ' + parsed.map(s => s.name).join(', ') : ''}`);

      const prevNames = this._discoveredSources.map(s => s.name).sort().join('\n');
      const nextNames = parsed.map(s => s.name).sort().join('\n');
      if (prevNames !== nextNames) {
        this._discoveredSources = parsed;
        this.emit('sources', this.getSources());
      }
    } catch (err) {
      this._log(`Poll error: ${err.message}`, 'warn');
      if (this._discoveredSources.length > 0) {
        this._discoveredSources = [];
        this.emit('sources', this.getSources());
      }
    } finally {
      this._polling = false;
    }
  }

  _log(message, level = 'info') {
    this.emit('log', { leg: 'sys', message: `[NDI Scanner] ${message}`, level, timestamp: Date.now() });
  }
}

module.exports = new NdiScanner();
