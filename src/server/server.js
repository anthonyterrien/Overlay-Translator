const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, '../../config.json');
const WHISPERING_UI_WS = 'ws://localhost:5000/translate';
const WHISPERING_CONTROL_WS = 'ws://localhost:5000';

// Get local IP address - prioritize real network over virtual interfaces
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  // Collect all non-internal IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({
          name: name,
          address: iface.address,
          priority: calculateInterfacePriority(name, iface.address)
        });
      }
    }
  }

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Return the highest priority IP, or fallback to localhost
  if (candidates.length > 0) {
    console.log('Available network interfaces:');
    candidates.forEach(c => console.log(`  ${c.name}: ${c.address} (priority: ${c.priority})`));
    console.log(`Selected IP: ${candidates[0].address} (${candidates[0].name})`);
    return candidates[0].address;
  }

  return 'localhost'; // Fallback
}

// Calculate priority for network interface
function calculateInterfacePriority(interfaceName, ipAddress) {
  let priority = 0;
  const name = interfaceName.toLowerCase();

  // Highest priority: Common home/office networks (192.168.0.x, 192.168.1.x, 10.0.0.x)
  if (ipAddress.startsWith('192.168.0.') || ipAddress.startsWith('192.168.1.')) {
    priority += 100;
  } else if (ipAddress.startsWith('10.0.0.')) {
    priority += 90;
  } else if (ipAddress.startsWith('192.168.')) {
    priority += 80;
  } else if (ipAddress.startsWith('10.')) {
    priority += 70;
  } else if (ipAddress.startsWith('172.')) {
    priority += 60;
  }

  // Boost WiFi/Ethernet interfaces
  if (name.includes('wi-fi') || name.includes('wifi') || name.includes('wlan')) {
    priority += 50;
  } else if (name.includes('ethernet') || name.includes('eth')) {
    priority += 45;
  }

  // Penalize virtual/bridge interfaces
  if (name.includes('virtualbox') || name.includes('vmware') || name.includes('vethernet') ||
      name.includes('vbox') || name.includes('docker') || name.includes('bridge') ||
      name.includes('tap') || name.includes('tun') || name.includes('hyper-v')) {
    priority -= 100;
  }

  return priority;
}

let currentPort = PORT;
let localIP = getLocalIPAddress();

// Production mode - disable verbose logs
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const log = {
  info: (...args) => !IS_PRODUCTION && console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  translation: (...args) => !IS_PRODUCTION && console.log('[TRANSLATION]', ...args)
};

// Middleware
// CORS configuration - allow localhost and local network access
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  `http://${localIP}:3000`, // Allow local network access
  `http://${localIP}:3001`,
  `http://${localIP}:3002`,
  `http://${localIP}:3003`,
  `http://${localIP}:3004`  // Cover possible port conflicts
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin matches localhost or local IP patterns
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isLocalIP = origin.startsWith(`http://${localIP}:`);

    if (isLocalhost || isLocalIP || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Limit JSON body size to 1MB to prevent DoS attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../../public')));

// Default configuration
const defaultConfig = {
  color: '#FFFFFF',
  fontSize: '24px',
  fontFamily: 'Arial, sans-serif',
  textAlign: 'center',
  backgroundColor: 'transparent',
  backgroundOpacity: 100,
  padding: '10px',
  paddingHorizontal: '0px',
  marginLeft: '0px',
  marginRight: '0px'
};

// Validation functions
function isValidHexColor(color) {
  return /^#[0-9A-F]{6}$/i.test(color) || color === 'transparent';
}

function isValidPixelValue(value) {
  return /^\d+px$/.test(value);
}

function isValidFontFamily(family) {
  // Allow common font families and basic CSS font stacks
  return typeof family === 'string' && family.length > 0 && family.length < 200;
}

function isValidTextAlign(align) {
  return ['left', 'center', 'right'].includes(align);
}

function isValidOpacity(opacity) {
  return Number.isInteger(opacity) && opacity >= 1 && opacity <= 100;
}

function validateConfig(config) {
  const errors = [];

  // Validate color
  if (config.color !== undefined && !isValidHexColor(config.color)) {
    errors.push('Invalid color format. Must be hex color (e.g., #FFFFFF) or "transparent"');
  }

  // Validate fontSize
  if (config.fontSize !== undefined) {
    if (!isValidPixelValue(config.fontSize)) {
      errors.push('Invalid fontSize format. Must be in pixels (e.g., 24px)');
    } else {
      const size = parseInt(config.fontSize);
      if (size < 12 || size > 72) {
        errors.push('fontSize must be between 12px and 72px');
      }
    }
  }

  // Validate fontFamily
  if (config.fontFamily !== undefined && !isValidFontFamily(config.fontFamily)) {
    errors.push('Invalid fontFamily');
  }

  // Validate textAlign
  if (config.textAlign !== undefined && !isValidTextAlign(config.textAlign)) {
    errors.push('textAlign must be one of: left, center, right');
  }

  // Validate backgroundColor
  if (config.backgroundColor !== undefined && !isValidHexColor(config.backgroundColor)) {
    errors.push('Invalid backgroundColor format. Must be hex color or "transparent"');
  }

  // Validate backgroundOpacity
  if (config.backgroundOpacity !== undefined && !isValidOpacity(config.backgroundOpacity)) {
    errors.push('backgroundOpacity must be an integer between 1 and 100');
  }

  // Validate padding values
  ['padding', 'paddingHorizontal', 'marginLeft', 'marginRight'].forEach(field => {
    if (config[field] !== undefined) {
      if (!isValidPixelValue(config[field])) {
        errors.push(`Invalid ${field} format. Must be in pixels (e.g., 10px)`);
      } else {
        const value = parseInt(config[field]);
        if (value < 0 || value > 500) {
          errors.push(`${field} must be between 0px and 500px`);
        }
      }
    }
  });

  return errors;
}

// Load configuration from file or create default
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const stats = fs.statSync(CONFIG_FILE);

      // Limit config file size to 100KB to prevent memory issues
      if (stats.size > 102400) {
        log.error('Config file too large (>100KB), using default config');
        return defaultConfig;
      }

      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);

      // Validate loaded config
      if (typeof config !== 'object' || config === null) {
        log.error('Invalid config file format, using default config');
        return defaultConfig;
      }

      return config;
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return defaultConfig;
}

// Save configuration to file
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving config:', err);
    return false;
  }
}

let currentConfig = loadConfig();

// Watch config file for changes
let configWatcher = null;
try {
  configWatcher = fs.watch(CONFIG_FILE, (eventType, filename) => {
    if (eventType === 'change') {
      console.log('Config file changed, reloading...');
      // Small delay to ensure file write is complete
      setTimeout(() => {
        currentConfig = loadConfig();
        broadcastConfigUpdate();
      }, 100);
    }
  });
  console.log('Watching config file for changes...');
} catch (err) {
  console.error('Error watching config file:', err);
}

// API Routes
app.get('/api/config', (req, res) => {
  res.json(currentConfig);
});

// Server info endpoint (IP, port, URLs)
app.get('/api/server-info', (req, res) => {
  res.json({
    port: currentPort,
    localIP: localIP,
    urls: {
      live: `http://${localIP}:${currentPort}/live`,
      config: `http://${localIP}:${currentPort}/config`,
      liveLocalhost: `http://localhost:${currentPort}/live`,
      configLocalhost: `http://localhost:${currentPort}/config`
    }
  });
});

app.post('/api/config', (req, res) => {
  // Validate incoming configuration
  const validationErrors = validateConfig(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid configuration',
      details: validationErrors
    });
  }

  // Only update fields that are actually provided and valid
  const allowedFields = [
    'color', 'fontSize', 'fontFamily', 'textAlign',
    'backgroundColor', 'backgroundOpacity',
    'padding', 'paddingHorizontal', 'marginLeft', 'marginRight'
  ];

  const updatedConfig = { ...currentConfig };
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updatedConfig[field] = req.body[field];
    }
  });

  currentConfig = updatedConfig;

  if (saveConfig(currentConfig)) {
    // Broadcast config update to all connected clients
    broadcastConfigUpdate();
    res.json({ success: true, config: currentConfig });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

// Serve HTML pages
app.get('/live', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/live.html'));
});

app.get('/config', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/config.html'));
});

// WebSocket clients (overlay pages)
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  log.info('Client connected to overlay WebSocket');
  clients.add(ws);

  // Send current config to new client
  ws.send(JSON.stringify({
    type: 'config',
    data: currentConfig
  }));

  // Send Whispering Tiger status
  ws.send(JSON.stringify({
    type: 'whispering_status',
    data: { connected: whisperingControlWs !== null && whisperingControlWs.readyState === WebSocket.OPEN }
  }));

  // Send Whispering Tiger settings if available
  if (Object.keys(whisperingSettings).length > 0) {
    ws.send(JSON.stringify({
      type: 'whispering_settings',
      data: whisperingSettings
    }));
  }

  // Handle messages from clients
  ws.on('message', (data) => {
    try {
      // Limit message size to 10KB to prevent DoS
      if (data.length > 10240) {
        log.warn('WebSocket message too large, ignoring');
        return;
      }

      const message = JSON.parse(data.toString());

      // Validate message structure
      if (!message.type || typeof message.type !== 'string') {
        log.warn('Invalid WebSocket message format');
        return;
      }

      // Handle Whispering Tiger setting changes from client
      if (message.type === 'whispering_setting_change') {
        // Validate setting name and value
        if (!message.name || typeof message.name !== 'string' || message.name.length > 100) {
          log.warn('Invalid setting name');
          return;
        }

        if (message.value === undefined || (typeof message.value !== 'string' && typeof message.value !== 'number')) {
          log.warn('Invalid setting value');
          return;
        }

        const success = sendWhisperingSetting(message.name, message.value);
        // Send confirmation back to client
        ws.send(JSON.stringify({
          type: 'whispering_setting_response',
          success: success,
          name: message.name,
          value: message.value
        }));
      }
    } catch (err) {
      console.error('Error parsing client message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from overlay WebSocket');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    clients.delete(ws);
  });
});

// Broadcast translation to all connected clients
function broadcastTranslation(text) {
  const message = JSON.stringify({
    type: 'translation',
    data: text
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast config update to all connected clients
function broadcastConfigUpdate() {
  const message = JSON.stringify({
    type: 'config',
    data: currentConfig
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Whispering Tiger Control WebSocket
let whisperingControlWs = null;
let controlReconnectTimeout = null;
let whisperingSettings = {};

// Connect to Whispering Tiger Control WebSocket
function connectToWhisperingControl() {
  try {
    whisperingControlWs = new WebSocket(WHISPERING_CONTROL_WS);

    whisperingControlWs.on('open', () => {
      console.log('Connected to Whispering Tiger Control WebSocket');
      broadcastWhisperingStatus(true);
    });

    whisperingControlWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Store settings when received
        if (message.type === 'translate_settings' && message.data) {
          whisperingSettings = message.data;
          broadcastWhisperingSettings();
        }

        // Store available languages
        if (message.type === 'installed_languages' && message.data) {
          whisperingSettings.installed_languages = message.data;
          broadcastWhisperingSettings();
        }

        // Store whisper languages
        if (message.type === 'whisper_languages' && message.data) {
          whisperingSettings.whisper_languages = message.data;
          broadcastWhisperingSettings();
        }
      } catch (err) {
        log.error('Error parsing Whispering Control message:', err);
      }
    });

    whisperingControlWs.on('close', () => {
      console.log('Disconnected from Whispering Control WebSocket. Reconnecting in 5 seconds...');
      whisperingControlWs = null;
      broadcastWhisperingStatus(false);
      controlReconnectTimeout = setTimeout(connectToWhisperingControl, 5000);
    });

    whisperingControlWs.on('error', (err) => {
      console.error('Whispering Control WebSocket error:', err.message);
    });
  } catch (err) {
    console.error('Failed to connect to Whispering Control:', err.message);
    controlReconnectTimeout = setTimeout(connectToWhisperingControl, 5000);
  }
}

// Send setting change to Whispering Tiger
function sendWhisperingSetting(name, value) {
  if (whisperingControlWs && whisperingControlWs.readyState === WebSocket.OPEN) {
    const message = JSON.stringify({
      type: 'setting_change',
      name: name,
      value: value
    });
    whisperingControlWs.send(message);
    console.log('Sent setting to Whispering Tiger:', name, value);
    return true;
  } else {
    console.error('Whispering Control WebSocket not connected');
    return false;
  }
}

// Broadcast Whispering Tiger connection status
function broadcastWhisperingStatus(connected) {
  const message = JSON.stringify({
    type: 'whispering_status',
    data: { connected }
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast Whispering Tiger settings
function broadcastWhisperingSettings() {
  const message = JSON.stringify({
    type: 'whispering_settings',
    data: whisperingSettings
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Connect to Whispering-UI WebSocket
let whisperingWs = null;
let reconnectTimeout = null;

function connectToWhisperingUI() {
  try {
    whisperingWs = new WebSocket(WHISPERING_UI_WS);

    whisperingWs.on('open', () => {
      console.log('Connected to Whispering-UI WebSocket');
    });

    whisperingWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Filter for processing_data type messages
        if (message.type === 'processing_data') {
          // Extract translated text, fallback to data field
          const translatedText = message.translated || message.data;

          if (translatedText) {
            console.log('Received translation:', translatedText);
            broadcastTranslation(translatedText);
          }
        }
      } catch (err) {
        console.error('Error parsing Whispering-UI message:', err);
      }
    });

    whisperingWs.on('close', () => {
      console.log('Disconnected from Whispering-UI WebSocket. Reconnecting in 5 seconds...');
      whisperingWs = null;
      reconnectTimeout = setTimeout(connectToWhisperingUI, 5000);
    });

    whisperingWs.on('error', (err) => {
      console.error('Whispering-UI WebSocket error:', err.message);
    });
  } catch (err) {
    console.error('Failed to connect to Whispering-UI:', err.message);
    reconnectTimeout = setTimeout(connectToWhisperingUI, 5000);
  }
}

// Start server with error handling for port conflicts
function startServer(port = PORT, maxRetries = 5) {
  server.listen(port, () => {
    currentPort = port; // Update current port
    localIP = getLocalIPAddress(); // Refresh IP in case it changed

    console.log(`Server running on http://localhost:${port}`);
    console.log(`Local IP: ${localIP}`);
    console.log(`Overlay URL (OBS): http://${localIP}:${port}/live`);
    console.log(`Config URL (Remote): http://${localIP}:${port}/config`);

    // Connect to Whispering-UI
    connectToWhisperingUI();
    connectToWhisperingControl();

    // Notify parent process (Electron) that server is ready
    if (process.send) {
      process.send({
        type: 'server-ready',
        port: port,
        localIP: localIP
      });
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      const retriesLeft = maxRetries - 1;

      if (retriesLeft > 0) {
        console.warn(`Port ${port} is already in use, trying port ${nextPort}...`);
        // Close the current server before trying a new port
        server.close();
        startServer(nextPort, retriesLeft);
      } else {
        console.error(`Failed to start server: All ports from ${PORT} to ${port} are in use`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

// Start the server
startServer();

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  if (whisperingWs) {
    whisperingWs.close();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  if (whisperingControlWs) {
    whisperingControlWs.close();
  }
  if (controlReconnectTimeout) {
    clearTimeout(controlReconnectTimeout);
  }
  if (configWatcher) {
    configWatcher.close();
  }
  server.close();
  process.exit(0);
});