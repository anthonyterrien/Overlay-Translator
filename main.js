const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow;
let overlayWindow;
let serverProcess;

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load configuration
function loadConfig() {
  const defaultConfig = {
    color: '#FFFFFF',
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    scrollEnabled: false,
    backgroundColor: 'transparent',
    backgroundOpacity: 100,
    padding: '10px',
    paddingHorizontal: '0px',
    marginLeft: '0px',
    marginRight: '0px',
    maxLines: 5
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const stats = fs.statSync(CONFIG_FILE);

      // Limit config file size to 100KB to prevent memory issues
      if (stats.size > 102400) {
        console.error('Config file too large (>100KB), using default config');
        return defaultConfig;
      }

      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);

      // Validate loaded config
      if (typeof config !== 'object' || config === null) {
        console.error('Invalid config file format, using default config');
        return defaultConfig;
      }

      return config;
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return defaultConfig;
}

// Save configuration
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving config:', err);
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Overlay Translator - Configuration',
    autoHideMenuBar: true, // Hide menu bar (press Alt to show temporarily)
    backgroundColor: '#0D0D0D', // Modern dark background
    frame: true, // Keep native window frame
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default' // Modern style on macOS
  });

  // Remove application menu completely
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.focus();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Overlay - OBS Source'
  });

  overlayWindow.loadURL('http://localhost:3000/live');

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function startServer() {
  // Start the Express server
  serverProcess = fork(path.join(__dirname, 'src/server/server.js'));

  serverProcess.on('message', (msg) => {
    if (msg.type === 'server-ready') {
      console.log(`Server started on port ${msg.port}`);
    }
  });

  serverProcess.on('error', (err) => {
    console.error('Server process error:', err);
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', async (event, config) => {
  const success = saveConfig(config);
  if (success) {
    // Notify all windows about config change
    if (mainWindow) {
      mainWindow.webContents.send('config-updated', config);
    }
    if (overlayWindow) {
      overlayWindow.webContents.send('config-updated', config);
    }
  }
  return { success, config };
});

ipcMain.handle('open-overlay-window', () => {
  createOverlayWindow();
});

app.whenReady().then(() => {
  startServer();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});