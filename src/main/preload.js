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

  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke('audio:getDevices'),

  // NDI sources
  getNdiSources: () => ipcRenderer.invoke('ndi:getSources'),

  // Process control
  startLeg: (leg, params) => ipcRenderer.invoke('process:start', leg, params),
  stopLeg: (leg) => ipcRenderer.invoke('process:stop', leg),
  startBoth: (txParams, rxParams) => ipcRenderer.invoke('process:startBoth', txParams, rxParams),
  stopAll: () => ipcRenderer.invoke('process:stopAll'),
  getProcessStatus: () => ipcRenderer.invoke('process:getStatus'),
  buildCommandPreview: (leg, params) => ipcRenderer.invoke('process:buildCommandPreview', leg, params),

  // Event subscriptions (all return unsubscribe functions)
  onLog: (cb) => on('log', cb),
  onNdiSources: (cb) => on('ndi:sources', cb),
  onProcessStatus: (cb) => on('process:status', cb),
  onVuLevels: (cb) => on('vu:levels', cb),

  // Auto-updater
  onUpdaterStatus: (cb) => on('updater:status', cb),
  installUpdate: () => ipcRenderer.invoke('updater:installNow'),
});
