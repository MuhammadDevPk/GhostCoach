const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onToggleRecord: (callback) => ipcRenderer.on('toggle-record', (_event, value) => callback(value)),
  onToggleRecordAutosend: (callback) => ipcRenderer.on('toggle-record-autosend', (_event, value) => callback(value)),
  onCheckpointRecord: (callback) => ipcRenderer.on('checkpoint-record', (_event, value) => callback(value)),
  onCombineResponses: (callback) => ipcRenderer.on('combine-responses', (_event, value) => callback(value)),
  onCancelRequest: (callback) => ipcRenderer.on('cancel-request', (_event, value) => callback(value)),
  showTeleprompter: (text) => ipcRenderer.send('teleprompter:show', text),
  closeTeleprompter: () => ipcRenderer.send('teleprompter:close'),
  onLoadTeleprompter: (callback) => ipcRenderer.on('teleprompter:load', (_event, value) => callback(value)),
  onTeleprompterClosed: (callback) => ipcRenderer.on('teleprompter:closed', (_event, value) => callback(value)),
  // Real-time scroll progress — teleprompter window sends, main window receives
  sendTeleprompterProgress: (progress) => ipcRenderer.send('teleprompter:progress', progress),
  onTeleprompterProgress: (callback) => ipcRenderer.on('teleprompter:progress', (_event, value) => callback(value))
});
