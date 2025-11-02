const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// limited functionality without exposing the entire Node.js API
contextBridge.exposeInMainWorld('api', {
  // System info
  platform: process.platform,
  version: process.version,

  // Configuration management
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  onConfigUpdated: (callback) => ipcRenderer.on('config-updated', (event, config) => callback(config)),

  // Window management
  openOverlayWindow: () => ipcRenderer.invoke('open-overlay-window'),

  // WebSocket connection for live preview
  connectWebSocket: (url) => {
    const ws = new WebSocket(url);
    return ws;
  }
});