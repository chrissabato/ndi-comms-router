const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

const configManager = require('./configManager');
const audioDevices = require('./audioDevices');
const ndiScanner = require('./ndiScanner');
const processManager = require('./processManager');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0D0D0D',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('config:get', () => configManager.getConfig());

ipcMain.handle('config:set', (_, updates) => {
  const config = configManager.setConfig(updates);
  // Apply binary path to sub-systems if it changed
  if (updates.binaryPath) {
    ndiScanner.setBinaryPath(updates.binaryPath);
    processManager.setBinaryPath(updates.binaryPath);
  }
  return config;
});

ipcMain.handle('system:getHostname', () => os.hostname());

ipcMain.handle('audio:getDevices', () => {
  const config = configManager.getConfig();
  return audioDevices.getAudioDevices(config.machineRole);
});

ipcMain.handle('ndi:getSources', () => ndiScanner.getSources());

ipcMain.handle('process:start', (_, leg, params) => processManager.startLeg(leg, params));

ipcMain.handle('process:stop', (_, leg) => {
  processManager.stopLeg(leg);
  return { ok: true };
});

ipcMain.handle('process:startBoth', (_, txParams, rxParams) => {
  processManager.startBoth(txParams, rxParams);
  return { ok: true };
});

ipcMain.handle('process:stopAll', () => {
  processManager.stopAll();
  return { ok: true };
});

ipcMain.handle('process:getStatus', () => processManager.getStatus());

ipcMain.handle('process:buildCommandPreview', (_, leg, params) =>
  processManager.buildCommandPreview(leg, params)
);

// ── Wire process manager events to renderer ───────────────────────────────

processManager.on('log', (data) => {
  if (mainWindow) mainWindow.webContents.send('log', data);
});

processManager.on('status', (data) => {
  if (mainWindow) mainWindow.webContents.send('process:status', data);
});

processManager.on('vu', (data) => {
  if (mainWindow) mainWindow.webContents.send('vu:levels', data);
});

// ── Wire NDI scanner to renderer ─────────────────────────────────────────

ndiScanner.on('sources', (sources) => {
  if (mainWindow) mainWindow.webContents.send('ndi:sources', sources);
  // Notify process manager so waiting RX legs can auto-connect
  processManager.onSourcesUpdate(sources);
});

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const config = configManager.loadConfig();

  // Apply saved binary path
  if (config.binaryPath) {
    ndiScanner.setBinaryPath(config.binaryPath);
    processManager.setBinaryPath(config.binaryPath);
  }

  ndiScanner.start();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  processManager.cleanup();
  ndiScanner.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  processManager.cleanup();
  ndiScanner.stop();
});

// Handle SIGTERM cleanly
process.on('SIGTERM', () => {
  processManager.cleanup();
  app.quit();
});
