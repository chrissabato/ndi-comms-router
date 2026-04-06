const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_CONFIG = {
  machineRole: null,
  binaryPath: 'ndi-free-audio',
  autoStart: false,
  networkInterface: 'auto',
  tx: {
    device: '',
    gain: 0,
    latency: 12,
    muted: false,
  },
  rx: {
    source: '',
    device: '',
    gain: 0,
    latency: 12,
    muted: false,
  },
};

let configPath = null;
let cachedConfig = null;

function getConfigPath() {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'config.json');
  }
  return configPath;
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    cachedConfig = Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
    // Deep merge nested objects
    cachedConfig.tx = Object.assign({}, DEFAULT_CONFIG.tx, cachedConfig.tx);
    cachedConfig.rx = Object.assign({}, DEFAULT_CONFIG.rx, cachedConfig.rx);
  } catch {
    cachedConfig = Object.assign({}, DEFAULT_CONFIG);
  }
  return cachedConfig;
}

function getConfig() {
  if (!cachedConfig) loadConfig();
  return cachedConfig;
}

function setConfig(updates) {
  const current = getConfig();
  // Deep merge tx/rx if provided
  if (updates.tx) updates.tx = Object.assign({}, current.tx, updates.tx);
  if (updates.rx) updates.rx = Object.assign({}, current.rx, updates.rx);
  cachedConfig = Object.assign({}, current, updates);
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(cachedConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write config:', err);
  }
  return cachedConfig;
}

module.exports = { getConfig, setConfig, loadConfig };
