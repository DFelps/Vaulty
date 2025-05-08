const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openPasswordWindow: () => ipcRenderer.send('open-password-window')
});