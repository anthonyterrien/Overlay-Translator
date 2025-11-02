const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, '../../config.json');
const WHISPERING_UI_WS = 'ws://localhost:5000/translate';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Default configuration
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

// Load configuration from file or create default
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
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

app.post('/api/config', (req, res) => {
  currentConfig = { ...currentConfig, ...req.body };
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
  console.log('Client connected to overlay WebSocket');
  clients.add(ws);

  // Send current config to new client
  ws.send(JSON.stringify({
    type: 'config',
    data: currentConfig
  }));

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

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Overlay URL: http://localhost:${PORT}/live`);
  console.log(`Config URL: http://localhost:${PORT}/config`);

  // Connect to Whispering-UI
  connectToWhisperingUI();

  // Notify parent process (Electron) that server is ready
  if (process.send) {
    process.send({ type: 'server-ready', port: PORT });
  }
});

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  if (whisperingWs) {
    whisperingWs.close();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  if (configWatcher) {
    configWatcher.close();
  }
  server.close();
  process.exit(0);
});