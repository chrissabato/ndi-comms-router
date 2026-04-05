const { EventEmitter } = require('events');

const POLL_INTERVAL_MS = 3000;

// Try to load grandiose (optional native module wrapping NDI SDK).
// Falls back gracefully if not installed or NDI SDK is absent.
let grandiose = null;
try {
  grandiose = require('grandiose');
} catch (_) {
  // grandiose unavailable — manual entry only
}

class NdiScanner extends EventEmitter {
  constructor() {
    super();
    this._discoveryServer = '';
    this._finder = null;
    this._discoveredSources = [];
    this._manualSources = [];
    this._timer = null;
    this._running = false;
    this._noGrandioseLogged = false;
  }

  setDiscoveryServer(ip) {
    const cleaned = (ip || '').trim();
    if (cleaned === this._discoveryServer) return;
    this._discoveryServer = cleaned;
    if (this._running) {
      this._closeFinder();
      this._openFinder();
    }
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._openFinder();
    this._timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._closeFinder();
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

  _openFinder() {
    if (!grandiose) {
      if (!this._noGrandioseLogged) {
        this._noGrandioseLogged = true;
        this._log('grandiose not available — NDI source discovery disabled. Add sources manually in the RX panel.', 'info');
      }
      return;
    }
    try {
      const opts = {};
      if (this._discoveryServer) opts.extraIPs = this._discoveryServer;
      this._finder = grandiose.find(opts);
      this._log(
        'NDI source discovery started' +
        (this._discoveryServer ? ` (discovery server: ${this._discoveryServer})` : '')
      );
      // Immediate first poll
      this._poll();
    } catch (err) {
      this._log(`NDI discovery failed to start: ${err.message}`, 'error');
    }
  }

  _closeFinder() {
    this._finder = null;
    if (this._discoveredSources.length > 0) {
      this._discoveredSources = [];
      this.emit('sources', this.getSources());
    }
  }

  _poll() {
    if (!this._finder) return;
    try {
      const raw = this._finder.sources();
      const parsed = raw.map(s => ({
        name: s.name,
        urlAddress: s.urlAddress || null,
        manual: false,
      }));

      const prevNames = this._discoveredSources.map(s => s.name).sort().join('\n');
      const nextNames = parsed.map(s => s.name).sort().join('\n');

      if (prevNames !== nextNames) {
        this._discoveredSources = parsed;
        if (parsed.length > 0) {
          this._log(`Found ${parsed.length} NDI source(s): ${parsed.map(s => s.name).join(', ')}`);
        }
        this.emit('sources', this.getSources());
      }
    } catch (err) {
      this._log(`NDI discovery poll error: ${err.message}`, 'warn');
    }
  }

  _log(message, level = 'info') {
    this.emit('log', { leg: 'sys', message: `[NDI Scanner] ${message}`, level, timestamp: Date.now() });
  }
}

module.exports = new NdiScanner();
