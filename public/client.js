// Configuration management
let currentConfig = {
  color: '#FFFFFF',
  fontSize: '24px',
  fontFamily: 'Arial, sans-serif',
  textAlign: 'left',
  scrollEnabled: false,
  backgroundColor: 'transparent',
  padding: '10px',
  maxLines: 5
};

// DOM elements
const form = document.getElementById('config-form');
const previewText = document.getElementById('preview-text');
const previewBox = document.getElementById('preview-box');
const statusMessage = document.getElementById('status-message');

// Form inputs
const colorInput = document.getElementById('color');
const colorTextInput = document.getElementById('color-text');
const fontSizeInput = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSize-value');
const fontFamilyInput = document.getElementById('fontFamily');
const textAlignInput = document.getElementById('textAlign');
const maxLinesInput = document.getElementById('maxLines');
const maxLinesValue = document.getElementById('maxLines-value');
const paddingInput = document.getElementById('padding');
const paddingValue = document.getElementById('padding-value');
const scrollEnabledInput = document.getElementById('scrollEnabled');
const backgroundColorInput = document.getElementById('backgroundColor');
const backgroundColorTextInput = document.getElementById('backgroundColor-text');
const resetBtn = document.getElementById('reset-btn');

// Load configuration on page load
window.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupEventListeners();
});

// Load configuration from server
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      currentConfig = config;
      updateFormFields(config);
      updatePreview();
    }
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
  maxLinesInput.value = config.maxLines;
  maxLinesValue.textContent = config.maxLines;

  const paddingNum = parseInt(config.padding);
  paddingInput.value = paddingNum;
  paddingValue.textContent = config.padding;

  scrollEnabledInput.checked = config.scrollEnabled;

  if (config.backgroundColor === 'transparent') {
    backgroundColorInput.value = '#000000';
    backgroundColorTextInput.value = 'transparent';
  } else {
    backgroundColorInput.value = config.backgroundColor;
    backgroundColorTextInput.value = config.backgroundColor;
  }
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

  // Max lines
  maxLinesInput.addEventListener('input', (e) => {
    maxLinesValue.textContent = e.target.value;
    updatePreview();
  });

  // Padding
  paddingInput.addEventListener('input', (e) => {
    paddingValue.textContent = `${e.target.value}px`;
    updatePreview();
  });

  // Scroll enabled
  scrollEnabledInput.addEventListener('change', updatePreview);

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

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveConfig();
  });

  // Reset button
  resetBtn.addEventListener('click', async () => {
    if (confirm('Reset to default configuration?')) {
      await resetConfig();
    }
  });
}

// Update preview
function updatePreview() {
  const config = getConfigFromForm();

  previewText.style.color = config.color;
  previewText.style.fontSize = config.fontSize;
  previewText.style.fontFamily = config.fontFamily;
  previewText.style.textAlign = config.textAlign;

  previewBox.style.backgroundColor = config.backgroundColor;
  previewBox.style.padding = config.padding;
}

// Get configuration from form
function getConfigFromForm() {
  return {
    color: colorTextInput.value,
    fontSize: `${fontSizeInput.value}px`,
    fontFamily: fontFamilyInput.value,
    textAlign: textAlignInput.value,
    scrollEnabled: scrollEnabledInput.checked,
    backgroundColor: backgroundColorTextInput.value,
    padding: `${paddingInput.value}px`,
    maxLines: parseInt(maxLinesInput.value)
  };
}

// Save configuration
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

    if (response.ok) {
      const result = await response.json();
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

// Reset configuration to default
async function resetConfig() {
  const defaultConfig = {
    color: '#FFFFFF',
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'left',
    scrollEnabled: false,
    backgroundColor: 'transparent',
    padding: '10px',
    maxLines: 5
  };

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(defaultConfig)
    });

    if (response.ok) {
      const result = await response.json();
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