const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vaulty', {
  getStatus: () => ipcRenderer.invoke('vault:status'),
  createVault: (masterPassword) => ipcRenderer.invoke('vault:create', masterPassword),
  unlock: (masterPassword) => ipcRenderer.invoke('vault:unlock', masterPassword),
  lock: () => ipcRenderer.invoke('vault:lock'),

  listCredentials: () => ipcRenderer.invoke('vault:list'),
  getCredentialForEdit: (id) => ipcRenderer.invoke('vault:getCredentialForEdit', id),
  revealPassword: (id) => ipcRenderer.invoke('vault:revealPassword', id),
  saveCredential: (payload) => ipcRenderer.invoke('vault:saveCredential', payload),
  deleteCredential: (id) => ipcRenderer.invoke('vault:deleteCredential', id),

  exportBackup: () => ipcRenderer.invoke('vault:exportBackup'),
  importBackup: () => ipcRenderer.invoke('vault:importBackup'),

  openExternal: (url) => ipcRenderer.invoke('vault:openExternal', url),

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  getWindowState: () => ipcRenderer.invoke('window:getState'),

  onForcedLock: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('vault:forced-lock', handler)

    return () => {
      ipcRenderer.removeListener('vault:forced-lock', handler)
    }
  },

  onWindowState: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('window:state', handler)

    return () => {
      ipcRenderer.removeListener('window:state', handler)
    }
  }
})