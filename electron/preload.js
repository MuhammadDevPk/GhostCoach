const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onToggleRecord: (callback) => ipcRenderer.on('toggle-record', (_event, value) => callback(value)),
  onCancelRequest: (callback) => ipcRenderer.on('cancel-request', (_event, value) => callback(value))
});
