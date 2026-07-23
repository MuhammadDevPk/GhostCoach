const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');

// Force the OS process name to override the default Electron metadata string
app.name = "Ghost Coach";

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

app.whenReady().then(() => {
  createWindow();

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

  // Register toggle record/transcribe shortcut (Cmd+Shift+L / Ctrl+Shift+L)
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-record');
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
    mainWindow.minimize();
  }
});

ipcMain.on('window:close', () => {
  app.quit();
});
