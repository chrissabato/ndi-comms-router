const { EventEmitter } = require('events');

// Manual source registry only — NDI discovery removed.
// ndi-free-audio handles waiting for sources internally; the source name
// just needs to be configured once and saved in config.
class NdiScanner extends EventEmitter {
  constructor() {
    super();
    this._sources = [];
  }

  // No-ops retained so callers don't need to change
  setBinaryPath() {}
  setDiscoveryServer() {}
  start() {}
  stop() {}

  getSources() { return this._sources; }

  addManualSource(name) {
    if (!this._sources.find(s => s.name === name)) {
      this._sources = [...this._sources, { name, manual: true }];
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
}

module.exports = new NdiScanner();
