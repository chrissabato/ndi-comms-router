const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { autoUpdater } = require('electron-updater');

const configManager = require('./configManager');
const audioDevices = require('./audioDevices');
const ndiScanner = require('./ndiScanner');
const processManager = require('./processManager');

// ── Auto-updater ──────────────────────────────────────────────────────────────

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateStatus(status, data = {}) {
  if (mainWindow) mainWindow.webContents.send('updater:status', { status, ...data });
}

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-not-available', () => sendUpdateStatus('up-to-date'));
autoUpdater.on('update-available', (info) =>
  sendUpdateStatus('available', { version: info.version })
);
autoUpdater.on('download-progress', (p) =>
  sendUpdateStatus('downloading', { percent: Math.round(p.percent) })
);
autoUpdater.on('update-downloaded', (info) =>
  sendUpdateStatus('ready', { version: info.version })
);
autoUpdater.on('error', (err) =>
  sendUpdateStatus('error', { message: err.message })
);

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
  if (updates.binaryPath) {
    processManager.setBinaryPath(updates.binaryPath);
  }
  return config;
});

ipcMain.handle('system:getHostname', () => os.hostname());

ipcMain.handle('audio:getDevices', () => {
  const config = configManager.getConfig();
  return audioDevices.getAudioDevices(config.machineRole, config.binaryPath);
});

ipcMain.handle('ndi:getSources', () => ndiScanner.getSources());
ipcMain.handle('ndi:addManual', (_, name) => { ndiScanner.addManualSource(name); return ndiScanner.getSources(); });
ipcMain.handle('ndi:removeManual', (_, name) => { ndiScanner.removeManualSource(name); return ndiScanner.getSources(); });

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

ipcMain.handle('process:buildBothCommandPreview', (_, txParams, rxParams) =>
  processManager.buildBothCommandPreview(txParams, rxParams)
);

ipcMain.handle('updater:installNow', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle('window:close', () => mainWindow?.close());

ipcMain.handle('updater:checkNow', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    // In dev, just send a fake up-to-date response
    sendUpdateStatus('up-to-date');
  }
});

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
  processManager.onSourcesUpdate(sources);
});

ndiScanner.on('log', (data) => {
  if (mainWindow) mainWindow.webContents.send('log', data);
});

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const config = configManager.loadConfig();

  if (config.binaryPath) {
    processManager.setBinaryPath(config.binaryPath);
  }

  createWindow();

  // Check for updates a few seconds after launch (only in packaged app)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  processManager.cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  processManager.cleanup();
});

// Handle SIGTERM cleanly
process.on('SIGTERM', () => {
  processManager.cleanup();
  app.quit();
});
