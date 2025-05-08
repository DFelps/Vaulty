const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const electronReload = require('electron-reload');

let loginWindow;
let passwordWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 448,
    height: 475,
    frame: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  loginWindow.loadFile('renderer/vaulty_login.html');

  loginWindow.center();

  // Quando a janela de login for fechada
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createPasswordWindow() {
  passwordWindow = new BrowserWindow({
    width: 1024,
    height: 750,
    frame: true,
    resizable: true,  // A janela agora pode ser redimensionada
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  passwordWindow.loadFile('renderer/vaulty_interface.html');

  passwordWindow.once('ready-to-show', () => {
    passwordWindow.show();  // Exibe a janela assim que estiver pronta
  });

  passwordWindow.on('closed', () => {
    passwordWindow = null;
  });
}

electronReload(__dirname, {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  createLoginWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

ipcMain.on('open-password-window', () => {
  openPasswordWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function openPasswordWindow() {
  // Fechar a janela de login
  if (loginWindow) {
    loginWindow.close();
  }

  // Criar e abrir a janela de senha
  createPasswordWindow();
}