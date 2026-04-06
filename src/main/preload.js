const { contextBridge, ipcRenderer } = require('electron');

// Helper: subscribe to an IPC event, returns an unsubscribe function
function on(channel, callback) {
  const handler = (_, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (updates) => ipcRenderer.invoke('config:set', updates),

  // System info
  getHostname: () => ipcRenderer.invoke('system:getHostname'),
  getVersion: () => ipcRenderer.invoke('system:getVersion'),

  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke('audio:getDevices'),

  // NDI sources
  getNdiSources: () => ipcRenderer.invoke('ndi:getSources'),
  addManualSource: (name) => ipcRenderer.invoke('ndi:addManual', name),
  removeManualSource: (name) => ipcRenderer.invoke('ndi:removeManual', name),

  // Process control
  startLeg: (leg, params) => ipcRenderer.invoke('process:start', leg, params),
  stopLeg: (leg) => ipcRenderer.invoke('process:stop', leg),
  startBoth: (txParams, rxParams) => ipcRenderer.invoke('process:startBoth', txParams, rxParams),
  stopAll: () => ipcRenderer.invoke('process:stopAll'),
  getProcessStatus: () => ipcRenderer.invoke('process:getStatus'),
  buildCommandPreview: (leg, params) => ipcRenderer.invoke('process:buildCommandPreview', leg, params),
  buildBothCommandPreview: (txParams, rxParams) => ipcRenderer.invoke('process:buildBothCommandPreview', txParams, rxParams),

  // Event subscriptions (all return unsubscribe functions)
  onLog: (cb) => on('log', cb),
  onNdiSources: (cb) => on('ndi:sources', cb),
  onProcessStatus: (cb) => on('process:status', cb),
  onVuLevels: (cb) => on('vu:levels', cb),

  // Auto-updater
  onUpdaterStatus: (cb) => on('updater:status', cb),
  installUpdate: () => ipcRenderer.invoke('updater:installNow'),
  checkForUpdates: () => ipcRenderer.invoke('updater:checkNow'),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
});
