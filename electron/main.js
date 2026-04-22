// main.fixed.js

const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const { VaultService } = require('./vault-service')

const isDev = !app.isPackaged
let mainWindow
const vault = new VaultService()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    title: 'Vaulty',
    backgroundColor: '#0b1020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html')
    )
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function handler(fn) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erro interno.'
      }
    }
  }
}

ipcMain.handle('vault:status', handler(() => vault.getStatus()))
ipcMain.handle('vault:create', handler((_, p) => vault.createVault(p)))
ipcMain.handle('vault:unlock', handler((_, p) => vault.unlock(p)))
ipcMain.handle('vault:lock', handler(() => vault.lock()))
ipcMain.handle('vault:list', handler(() => vault.listCredentials()))
ipcMain.handle('vault:getCredentialForEdit', handler((_, id) => vault.getCredentialForEdit(id)))
ipcMain.handle('vault:revealPassword', handler((_, id) => vault.revealPassword(id)))
ipcMain.handle('vault:saveCredential', handler((_, data) => vault.saveCredential(data)))
ipcMain.handle('vault:deleteCredential', handler((_, id) => vault.deleteCredential(id)))
ipcMain.handle('vault:exportBackup', handler(() => vault.exportBackup()))
ipcMain.handle('vault:importBackup', handler(() => vault.importBackup()))