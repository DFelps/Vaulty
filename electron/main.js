const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const { VaultService } = require('./vault-service')

const isDev = !app.isPackaged

let mainWindow = null
const vault = new VaultService()

function emitForcedLock(reason) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('vault:forced-lock', { reason })
  }
}

function emitWindowState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window:state', {
      isMaximized: mainWindow.isMaximized()
    })
  }
}

function getWindowIcon() {
  return path.join(__dirname, '..', 'assets', 'icon.png')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    title: 'Vaulty',
    backgroundColor: '#0b1020',
    frame: false,
    titleBarStyle: 'hidden',
    icon: getWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('minimize', () => {
    vault.lock()
    emitForcedLock('Sessão bloqueada ao minimizar a janela.')
  })

  mainWindow.on('maximize', emitWindowState)
  mainWindow.on('unmaximize', emitWindowState)

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
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
  if (process.platform !== 'darwin') {
    app.quit()
  }
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
ipcMain.handle('vault:create', handler((_, password) => vault.createVault(password)))
ipcMain.handle('vault:unlock', handler((_, password) => vault.unlock(password)))
ipcMain.handle('vault:lock', handler(() => vault.lock()))
ipcMain.handle('vault:list', handler(() => vault.listCredentials()))
ipcMain.handle('vault:getCredentialForEdit', handler((_, id) => vault.getCredentialForEdit(id)))
ipcMain.handle('vault:revealPassword', handler((_, id) => vault.revealPassword(id)))
ipcMain.handle('vault:saveCredential', handler((_, payload) => vault.saveCredential(payload)))
ipcMain.handle('vault:deleteCredential', handler((_, id) => vault.deleteCredential(id)))
ipcMain.handle('vault:exportBackup', handler(() => vault.exportBackup()))
ipcMain.handle('vault:importBackup', handler(() => vault.importBackup()))

ipcMain.handle('vault:openExternal', handler(async (_, url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('URL inválida.')
  }

  const parsed = new URL(url)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Somente links http e https são permitidos.')
  }

  await shell.openExternal(parsed.toString())
  return { success: true }
}))

ipcMain.handle('window:minimize', handler(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize()
  }
  return { success: true }
}))

ipcMain.handle('window:toggleMaximize', handler(() => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Janela indisponível.' }
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }

  return {
    success: true,
    isMaximized: mainWindow.isMaximized()
  }
}))

ipcMain.handle('window:close', handler(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
  }
  return { success: true }
}))

ipcMain.handle('window:getState', handler(() => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Janela indisponível.' }
  }

  return {
    success: true,
    isMaximized: mainWindow.isMaximized()
  }
}))