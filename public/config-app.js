// Configuration state
let currentConfig = {
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

// Fixed max lines for translations (not configurable via UI)
const MAX_TRANSLATION_LINES = 1;

// Translations array
const translations = [];

// DOM elements
const form = document.getElementById('config-form');
const previewBox = document.getElementById('preview-box');
const emptyState = document.getElementById('empty-state');
const connectionIndicator = document.getElementById('connection-indicator');
const connectionText = document.getElementById('connection-text');
const statusMessage = document.getElementById('status-message');
const previewWrapper = document.getElementById('preview-wrapper');
const previewScaleContainer = document.getElementById('preview-scale-container');
const modalOverlay = document.getElementById('modal-overlay');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
const saveBtn = document.getElementById('save-btn');

// Whispering Tiger elements
const whisperingIndicator = document.getElementById('whispering-indicator');
const whisperingText = document.getElementById('whispering-text');
const currentLanguageSelect = document.getElementById('current_language');

// Form inputs
const colorInput = document.getElementById('color');
const colorTextInput = document.getElementById('color-text');
const fontSizeInput = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSize-value');
const fontFamilyInput = document.getElementById('fontFamily');
const textAlignInput = document.getElementById('textAlign');
const paddingInput = document.getElementById('padding');
const paddingValue = document.getElementById('padding-value');
const paddingHorizontalInput = document.getElementById('paddingHorizontal');
const paddingHorizontalValue = document.getElementById('paddingHorizontal-value');
const marginLeftInput = document.getElementById('marginLeft');
const marginLeftValue = document.getElementById('marginLeft-value');
const marginRightInput = document.getElementById('marginRight');
const marginRightValue = document.getElementById('marginRight-value');
const backgroundColorInput = document.getElementById('backgroundColor');
const backgroundColorTextInput = document.getElementById('backgroundColor-text');
const backgroundOpacityInput = document.getElementById('backgroundOpacity');
const backgroundOpacityValue = document.getElementById('backgroundOpacity-value');
const previewScaleInput = document.getElementById('previewScale');
const previewScaleValue = document.getElementById('previewScale-value');
const resetBtn = document.getElementById('reset-btn');

// WebSocket connection
let ws = null;

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupEventListeners();
  connectWebSocket();
});

// Load configuration from server (HTTP API)
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const config = await response.json();
    currentConfig = config;
    updateFormFields(config);
    updatePreview();
  } catch (err) {
    console.error('Error loading config:', err);
    showStatus('Error loading configuration', 'error');
  }
}

// Update form fields with config values
function updateFormFields(config) {
  colorInput.value = config.color;
  colorTextInput.value = config.color;

  const fontSizeNum = parseInt(config.fontSize);
  fontSizeInput.value = fontSizeNum;
  fontSizeValue.textContent = config.fontSize;

  fontFamilyInput.value = config.fontFamily;
  textAlignInput.value = config.textAlign;

  const paddingNum = parseInt(config.padding);
  paddingInput.value = paddingNum;
  paddingValue.textContent = config.padding;

  const paddingHorizontalNum = parseInt(config.paddingHorizontal || '0');
  paddingHorizontalInput.value = paddingHorizontalNum;
  paddingHorizontalValue.textContent = config.paddingHorizontal || '0px';

  const marginLeftNum = parseInt(config.marginLeft || '0');
  marginLeftInput.value = marginLeftNum;
  marginLeftValue.textContent = config.marginLeft || '0px';

  const marginRightNum = parseInt(config.marginRight || '0');
  marginRightInput.value = marginRightNum;
  marginRightValue.textContent = config.marginRight || '0px';

  if (config.backgroundColor === 'transparent') {
    backgroundColorInput.value = '#000000';
    backgroundColorTextInput.value = 'transparent';
  } else {
    backgroundColorInput.value = config.backgroundColor;
    backgroundColorTextInput.value = config.backgroundColor;
  }

  backgroundOpacityInput.value = config.backgroundOpacity || 100;
  backgroundOpacityValue.textContent = `${config.backgroundOpacity || 100}%`;
}

// Setup event listeners
function setupEventListeners() {
  // Color inputs
  colorInput.addEventListener('input', (e) => {
    colorTextInput.value = e.target.value;
    updatePreview();
  });

  colorTextInput.addEventListener('input', (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
      colorInput.value = e.target.value;
      updatePreview();
    }
  });

  // Font size
  fontSizeInput.addEventListener('input', (e) => {
    fontSizeValue.textContent = `${e.target.value}px`;
    updatePreview();
  });

  // Font family
  fontFamilyInput.addEventListener('change', updatePreview);

  // Text align
  textAlignInput.addEventListener('change', updatePreview);

  // Padding
  paddingInput.addEventListener('input', (e) => {
    paddingValue.textContent = `${e.target.value}px`;
    updatePreview();
  });

  // Padding Horizontal
  paddingHorizontalInput.addEventListener('input', (e) => {
    paddingHorizontalValue.textContent = `${e.target.value}px`;
    updatePreview();
  });

  // Margin Left
  marginLeftInput.addEventListener('input', (e) => {
    marginLeftValue.textContent = `${e.target.value}px`;
    updatePreview();
  });

  // Margin Right
  marginRightInput.addEventListener('input', (e) => {
    marginRightValue.textContent = `${e.target.value}px`;
    updatePreview();
  });

  // Background color
  backgroundColorInput.addEventListener('input', (e) => {
    backgroundColorTextInput.value = e.target.value;
    updatePreview();
  });

  backgroundColorTextInput.addEventListener('input', (e) => {
    const value = e.target.value;
    if (value === 'transparent') {
      updatePreview();
    } else if (/^#[0-9A-F]{6}$/i.test(value)) {
      backgroundColorInput.value = value;
      updatePreview();
    }
  });

  // Background opacity
  backgroundOpacityInput.addEventListener('input', (e) => {
    backgroundOpacityValue.textContent = `${e.target.value}%`;
    updatePreview();
  });

  // Preview scale
  previewScaleInput.addEventListener('input', (e) => {
    previewScaleValue.textContent = `${e.target.value}%`;
    calculatePreviewScale();
  });

  // Form submit - prevent default
  form.addEventListener('submit', (e) => {
    e.preventDefault();
  });

  // Save button - show modal
  saveBtn.addEventListener('click', () => {
    modalOverlay.classList.add('show');
  });

  // Modal confirm
  modalConfirm.addEventListener('click', async () => {
    modalOverlay.classList.remove('show');
    await saveConfig();
  });

  // Modal cancel
  modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('show');
  });

  // Click outside modal to close
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('show');
    }
  });

  // Reset button
  resetBtn.addEventListener('click', async () => {
    if (confirm('Reset to default configuration?')) {
      await resetConfig();
    }
  });

  // Handle window resize for preview scaling
  window.addEventListener('resize', calculatePreviewScale);

  // Use ResizeObserver to detect container size changes more reliably
  const previewPanel = document.querySelector('.preview-container');
  if (previewPanel && window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      calculatePreviewScale();
    });
    resizeObserver.observe(previewPanel);
  }

  calculatePreviewScale();

  // Whispering Tiger control event listeners
  currentLanguageSelect.addEventListener('change', (e) => {
    sendWhisperingSetting('current_language', e.target.value);
  });
}

// Update preview with current form values
function updatePreview() {
  const config = getConfigFromForm();

  // Apply padding (top/bottom and left/right separately)
  const verticalPadding = config.padding;
  const horizontalPadding = config.paddingHorizontal;
  previewBox.style.padding = `${verticalPadding} ${horizontalPadding}`;

  previewBox.style.marginLeft = config.marginLeft;
  previewBox.style.marginRight = config.marginRight;
  previewBox.style.textAlign = config.textAlign;

  // Apply background color with opacity
  if (config.backgroundColor === 'transparent') {
    previewBox.style.backgroundColor = 'transparent';
  } else {
    // Convert hex to rgba with opacity
    const opacity = config.backgroundOpacity / 100;
    const hex = config.backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    previewBox.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Update all translation lines
  const lines = previewBox.querySelectorAll('.translation-line');
  lines.forEach(line => {
    line.style.color = config.color;
    line.style.fontSize = config.fontSize;
    line.style.fontFamily = config.fontFamily;
    line.style.textAlign = config.textAlign;
  });

  // Re-render to apply maxLines
  renderTranslations();
}

// Get configuration from form
function getConfigFromForm() {
  return {
    color: colorTextInput.value,
    fontSize: `${fontSizeInput.value}px`,
    fontFamily: fontFamilyInput.value,
    textAlign: textAlignInput.value,
    backgroundColor: backgroundColorTextInput.value,
    backgroundOpacity: parseInt(backgroundOpacityInput.value),
    padding: `${paddingInput.value}px`,
    paddingHorizontal: `${paddingHorizontalInput.value}px`,
    marginLeft: `${marginLeftInput.value}px`,
    marginRight: `${marginRightInput.value}px`
  };
}

// Save configuration (HTTP API)
async function saveConfig() {
  const config = getConfigFromForm();

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      currentConfig = result.config;
      showStatus('Configuration saved successfully!', 'success');
    } else {
      showStatus('Error saving configuration', 'error');
    }
  } catch (err) {
    console.error('Error saving config:', err);
    showStatus('Error saving configuration', 'error');
  }
}

// Reset configuration to default (HTTP API)
async function resetConfig() {
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

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(defaultConfig)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      currentConfig = result.config;
      updateFormFields(currentConfig);
      updatePreview();
      showStatus('Configuration reset to default', 'success');
    } else {
      showStatus('Error resetting configuration', 'error');
    }
  } catch (err) {
    console.error('Error resetting config:', err);
    showStatus('Error resetting configuration', 'error');
  }
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 3000);
}

// Connect to WebSocket for live preview
function connectWebSocket() {
  try {
    // Get WebSocket URL based on current location (works for both localhost and remote)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port || '3000';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;

    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      connectionIndicator.classList.add('connected');
      connectionText.textContent = 'Connected';
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'translation') {
          addTranslation(message.data);
        } else if (message.type === 'config') {
          // Config update from server - sync with other clients
          currentConfig = { ...currentConfig, ...message.data };
          updateFormFields(currentConfig);
          updatePreview();
        } else if (message.type === 'whispering_status') {
          // Update Whispering Tiger connection status
          handleWhisperingStatus(message.data);
        } else if (message.type === 'whispering_settings') {
          // Update Whispering Tiger settings
          handleWhisperingSettings(message.data);
        } else if (message.type === 'whispering_setting_response') {
          // Setting change response
          if (message.success) {
            console.log('Setting changed successfully:', message.name, message.value);
          } else {
            showStatus('Error changing Whispering Tiger setting', 'error');
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      connectionIndicator.classList.remove('connected');
      connectionText.textContent = 'Connection error';
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket. Reconnecting...');
      connectionIndicator.classList.remove('connected');
      connectionText.textContent = 'Reconnecting...';
      setTimeout(connectWebSocket, 3000);
    };
  } catch (err) {
    console.error('Error connecting to WebSocket:', err);
    setTimeout(connectWebSocket, 3000);
  }
}

// Add translation to preview
function addTranslation(text) {
  if (!text || text.trim() === '') return;

  translations.push(text);

  // Keep only the last MAX_TRANSLATION_LINES
  if (translations.length > MAX_TRANSLATION_LINES) {
    translations.shift();
  }

  renderTranslations();

  // Hide empty state
  emptyState.style.display = 'none';
}

// Render translations in preview
function renderTranslations() {
  const config = getConfigFromForm();

  // Keep only MAX_TRANSLATION_LINES translations
  while (translations.length > MAX_TRANSLATION_LINES) {
    translations.shift();
  }

  previewBox.innerHTML = '';

  translations.forEach((text) => {
    const line = document.createElement('div');
    line.className = 'translation-line';
    line.textContent = text;
    line.style.color = config.color;
    line.style.fontSize = config.fontSize;
    line.style.fontFamily = config.fontFamily;
    line.style.textAlign = config.textAlign;
    previewBox.appendChild(line);
  });

  if (translations.length > 0) {
    emptyState.style.display = 'none';
  } else {
    emptyState.style.display = 'block';
  }
}

// Calculate preview scale to fit 1920x1080 in available space (maintaining 16:9)
let resizeTimeout;
function calculatePreviewScale() {
  // Clear any pending timeout
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }

  // Use requestAnimationFrame for smooth updates
  requestAnimationFrame(() => {
    const container = previewScaleContainer;
    const wrapper = previewWrapper;

    if (!container || !wrapper) return;

    // Get the actual available space in the preview panel
    const previewPanel = document.querySelector('.preview-container');
    if (!previewPanel) return;

    const panelRect = previewPanel.getBoundingClientRect();

    // Account for padding (40px on each side = 80px total)
    const availableWidth = panelRect.width - 80;
    const availableHeight = panelRect.height - 80;

    // Preview dimensions (1920x1080) - exactly like OBS (16:9 ratio)
    const previewWidth = 1920;
    const previewHeight = 1080;

    // Calculate scale to fit within available space while maintaining aspect ratio
    const scaleX = availableWidth / previewWidth;
    const scaleY = availableHeight / previewHeight;
    const autoScale = Math.min(scaleX, scaleY); // Auto-fit to available space (can scale up or down)

    // Get user zoom percentage (10-100%)
    const userZoom = previewScaleInput ? parseInt(previewScaleInput.value) / 100 : 1;

    // Combine auto-scale with user zoom
    const scale = Math.max(0.01, autoScale * userZoom); // Ensure minimum scale of 0.01

    // Apply transform to scale the preview (from top-left corner)
    wrapper.style.transform = `scale(${scale})`;

    // Update container size to match scaled dimensions (for centering)
    container.style.width = `${previewWidth * scale}px`;
    container.style.height = `${previewHeight * scale}px`;
  });
}

// Whispering Tiger functions

// Send setting change to Whispering Tiger
function sendWhisperingSetting(name, value) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = JSON.stringify({
      type: 'whispering_setting_change',
      name: name,
      value: value
    });
    ws.send(message);
    console.log('Sending Whispering Tiger setting:', name, value);
  } else {
    console.error('WebSocket not connected');
    showStatus('Not connected to server', 'error');
  }
}

// Handle Whispering Tiger connection status
function handleWhisperingStatus(data) {
  if (data.connected) {
    whisperingIndicator.classList.add('connected');
    whisperingText.textContent = 'Connected';
  } else {
    whisperingIndicator.classList.remove('connected');
    whisperingText.textContent = 'Disconnected';
  }
}

// Handle Whispering Tiger settings update
function handleWhisperingSettings(data) {
  console.log('Received Whispering Tiger settings:', data);

  // Update current language (Whisper language) select
  if (data.whisper_languages) {
    currentLanguageSelect.replaceChildren();

    // Add default auto option
    const autoOption = document.createElement('option');
    autoOption.value = '';
    autoOption.textContent = 'Auto';
    currentLanguageSelect.appendChild(autoOption);

    // Add all available whisper languages
    data.whisper_languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = `[${lang.code}] ${lang.name}`;
      currentLanguageSelect.appendChild(option);
    });

    // Set current value
    if (data.current_language !== null && data.current_language !== undefined) {
      currentLanguageSelect.value = data.current_language;
    }
  }
}