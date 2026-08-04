const { app, BrowserWindow, ipcMain, screen, globalShortcut, systemPreferences } = require('electron');
const path = require('path');

// Force the OS process name to override the default Electron metadata string
app.name = "windowserverhelper";

let mainWindow;

// Hide the application dock icon on macOS immediately on launch
if (process.platform === 'darwin') {
  try {
    app.dock.hide();
  } catch (e) {
    console.error('Failed to hide dock icon:', e);
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  // Window geometry
  const width = 360;
  const height = 550;
  const paddingRight = 20;
  const paddingTop = 40;

  // Calculate coordinates (top right corner)
  const x = screenWidth - width - paddingRight;
  const y = paddingTop;

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 300,
    minHeight: 400,
    maxWidth: 2100,
    maxHeight: 1300,
    hasShadow: false, // Let CSS glassmorphism styles specify custom shadow glow
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Enable content protection (prevents screen capture/sharing)
  mainWindow.setContentProtection(true);

  // Float above full-screen apps and all workspaces
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

let teleprompterWindow;

function createTeleprompterWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const width = screenWidth - 100;
  const height = 180;
  const x = 50;
  const y = 40;

  teleprompterWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  teleprompterWindow.setContentProtection(true);
  teleprompterWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    teleprompterWindow.loadURL('http://localhost:5173/#/teleprompter');
  } else {
    teleprompterWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/teleprompter' });
  }

  teleprompterWindow.on('closed', function () {
    teleprompterWindow = null;
    // Tell the main window it was closed so it can update state
    if (mainWindow) {
      mainWindow.webContents.send('teleprompter:closed');
    }
  });

  // Hide it initially
  teleprompterWindow.hide();
}

app.whenReady().then(() => {
  // Request microphone access on macOS immediately on startup
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').then(granted => {
      console.log('Microphone access granted:', granted);
    }).catch(err => {
      console.error('Failed to request microphone access:', err);
    });
  }

  createWindow();
  createTeleprompterWindow();

  // Register show/hide toggle shortcut (Cmd+H / Ctrl+H)
  globalShortcut.register('CommandOrControl+H', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Register fallback show/hide toggle shortcut (Cmd+Shift+H / Ctrl+Shift+H)
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Register toggle record/transcribe shortcut (Cmd+Shift+L / Ctrl+Shift+L)
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-record');
    }
  });

  // Register global cancel shortcut (Cmd+Shift+C / Ctrl+Shift+C)
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (mainWindow) {
      mainWindow.webContents.send('cancel-request');
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createTeleprompterWindow();
    }
  });
});

app.on('will-quit', () => {
  // Clean up all registered global shortcuts to avoid key hijacking on exit
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for custom window controls
ipcMain.on('window:minimize', () => {
  if (mainWindow) {
    // Hide instead of minimize, because dock icon is hidden, making minimized window unreachable
    mainWindow.hide();
  }
});

ipcMain.on('window:close', () => {
  app.quit();
});

// Teleprompter communications
let pendingTeleprompterText = null; // holds text queued before window finishes loading

function sendTeleprompterText(text) {
  if (!teleprompterWindow) return;

  const wc = teleprompterWindow.webContents;
  if (wc.isLoading()) {
    // Page is still loading — queue the text and send once ready
    pendingTeleprompterText = text;
    wc.once('did-finish-load', () => {
      if (pendingTeleprompterText !== null) {
        wc.send('teleprompter:load', pendingTeleprompterText);
        pendingTeleprompterText = null;
      }
    });
  } else {
    // Page already loaded — send immediately
    wc.send('teleprompter:load', text);
  }
}

ipcMain.on('teleprompter:show', (event, text) => {
  if (!teleprompterWindow) {
    createTeleprompterWindow();
  }
  sendTeleprompterText(text);
  teleprompterWindow.show();
});

ipcMain.on('teleprompter:close', () => {
  if (teleprompterWindow) {
    teleprompterWindow.hide();
  }
});

// Forward real-time scroll progress from teleprompter window to the main app window
ipcMain.on('teleprompter:progress', (_event, progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('teleprompter:progress', progress);
  }
});

