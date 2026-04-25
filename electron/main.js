const { app, BrowserWindow, ipcMain, Menu, shell, Tray, nativeImage } = require('electron')
const path = require('path')
const { VaultService } = require('./vault-service')

const isDev = !app.isPackaged

let cachedOpenAtLogin = false

let mainWindow = null
let tray = null
let isQuitting = false

const vault = new VaultService()

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  showMainWindow()
})

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
  return path.join(__dirname, '..', 'build', 'icon.ico')
}

function getTrayIcon() {
  const iconPath = getWindowIcon()
  const icon = nativeImage.createFromPath(iconPath)
  return icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 })
}

function applyLoginSettings(openAtLogin = true) {
  cachedOpenAtLogin = openAtLogin

  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true,
    args: ['--hidden']
  })
}

function isOpenAtLoginEnabled() {
  return cachedOpenAtLogin
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

function hideToTray(reason = 'Sessão bloqueada e enviada para a bandeja.') {
  if (!mainWindow || mainWindow.isDestroyed()) return

  vault.lock()
  emitForcedLock(reason)
  mainWindow.hide()
}

function updateTrayMenu() {
  if (!tray) return

  const openAtLogin = isOpenAtLoginEnabled()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Vaulty',
      click: () => showMainWindow()
    },
    {
      label: 'Bloquear cofre',
      click: () => {
        vault.lock()
        emitForcedLock('Cofre bloqueado pela bandeja do sistema.')
      }
    },
    { type: 'separator' },
    {
      label: openAtLogin
        ? 'Iniciar com Windows: ligado'
        : 'Iniciar com Windows: desligado',
      click: () => {
        applyLoginSettings(!openAtLogin)
        setTimeout(updateTrayMenu, 300)
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

function createTray() {
  if (tray) return

  tray = new Tray(getTrayIcon())
  tray.setToolTip('Vaulty')

  tray.on('click', () => {
    showMainWindow()
  })

  tray.on('double-click', () => {
    showMainWindow()
  })

  updateTrayMenu()
}

function createWindow(options = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return
  }

  const startHidden = Boolean(options.startHidden)

  mainWindow = new BrowserWindow({
    width: 1220,
    height: 895,
    minWidth: 1000,
    minHeight: 700,
    title: 'Vaulty',
    backgroundColor: '#0b1020',
    frame: false,
    roundedCorners: true,
    titleBarStyle: 'hidden',
    icon: getWindowIcon(),
    show: !startHidden,
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

  mainWindow.on('minimize', (event) => {
    event.preventDefault()
    hideToTray('Sessão bloqueada ao minimizar a janela.')
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return

    event.preventDefault()
    hideToTray('Sessão bloqueada e enviada para a bandeja.')
  })

  mainWindow.on('maximize', emitWindowState)
  mainWindow.on('unmaximize', emitWindowState)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)

    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  cachedOpenAtLogin = app.getLoginItemSettings().openAtLogin

  createTray()

  const startHidden = process.argv.includes('--hidden') && !isDev
  createWindow({ startHidden })

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', (event) => {
  if (process.platform !== 'darwin') {
    event.preventDefault()
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

ipcMain.handle('vault:toggleFavorite', handler((_, id) => vault.toggleFavorite(id)))

ipcMain.handle('categories:list', handler(() => vault.listCategories()))
ipcMain.handle('categories:create', handler((_, name) => vault.createCategory(name)))
ipcMain.handle('categories:delete', handler((_, id) => vault.deleteCategory(id)))

ipcMain.handle('vault:exportBackup', handler(() => vault.exportBackup()))
ipcMain.handle('vault:importBackup', handler(() => vault.importBackup()))

ipcMain.handle('drive:getSettings', handler(() => vault.getDriveSettings()))
ipcMain.handle('drive:saveSettings', handler((_, payload) => vault.saveDriveSettings(payload)))
ipcMain.handle('drive:getStatus', handler(() => vault.getDriveStatus()))
ipcMain.handle('drive:syncNow', handler(() => vault.syncDriveNow()))

ipcMain.handle('recovery:getStatus', handler(() => vault.getRecoveryStatus()))
ipcMain.handle('recovery:generateKey', handler(() => vault.generateRecoveryKey()))
ipcMain.handle('recovery:recoverWithKey', handler((_, payload) => vault.recoverWithRecoveryKey(payload)))

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
  hideToTray('Sessão bloqueada ao minimizar a janela.')
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
  hideToTray('Sessão bloqueada e enviada para a bandeja.')
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