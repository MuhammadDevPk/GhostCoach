<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Expose Pusher to window as required by Laravel Echo
window.Pusher = Pusher;

// Define default Reverb configuration
const DEFAULT_SETTINGS = {
  host: 'ws.helper-ext.larawork.com',
  port: '443',
  appKey: 'datgek4pdi3rxen8drie',
  scheme: 'https',
  channel: 'interview',
  event: '.guidance.created' // Prepend dot to listen to custom event literally (prevents Echo namespace prefixing)
};

// Application reactive states
const settings = ref({ ...DEFAULT_SETTINGS });
const showSettings = ref(false);
const messages = ref([]);
const connectionState = ref('disconnected'); // 'connected' | 'connecting' | 'disconnected'
const feedContainer = ref(null);
const fontSize = ref(15);

// Active Echo instance pointer
let echoInstance = null;

// Load settings from localStorage and bootstrap connection
onMounted(() => {
  const savedSettings = localStorage.getItem('reverb_settings');
  if (savedSettings) {
    try {
      settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (e) {
      console.error('Failed to parse saved settings', e);
    }
  }

  const savedFontSize = localStorage.getItem('prompt_font_size');
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize) || 15;
  }

  connectEcho();
});

function increaseFont() {
  if (fontSize.value < 32) {
    fontSize.value += 1;
    localStorage.setItem('prompt_font_size', fontSize.value);
  }
}

function decreaseFont() {
  if (fontSize.value > 11) {
    fontSize.value -= 1;
    localStorage.setItem('prompt_font_size', fontSize.value);
  }
}

// Initialize / Reconnect Laravel Echo
function connectEcho() {
  // If we already have an active Echo instance, clean it up
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch (e) {
      console.error('Error disconnecting existing Echo instance:', e);
    }
  }

  connectionState.value = 'connecting';

  try {
    const useTLS = settings.value.scheme === 'https';

    echoInstance = new Echo({
      broadcaster: 'reverb',
      key: settings.value.appKey,
      wsHost: settings.value.host,
      wsPort: parseInt(settings.value.port) || 80,
      wssPort: parseInt(settings.value.port) || 443,
      forceTLS: useTLS,
      enabledTransports: ['ws', 'wss'],
      disableStats: true
    });

    // Monitor underlying Pusher connection states
    const pusher = echoInstance.connector.pusher;

    if (pusher && pusher.connection) {
      pusher.connection.bind('state_change', (states) => {
        // Map Pusher connection state changes to app status
        if (states.current === 'connected') {
          connectionState.value = 'connected';
        } else if (states.current === 'connecting') {
          connectionState.value = 'connecting';
        } else {
          connectionState.value = 'disconnected';
        }
      });

      // Fallback handlers
      pusher.connection.bind('connected', () => { connectionState.value = 'connected'; });
      pusher.connection.bind('disconnected', () => { connectionState.value = 'disconnected'; });
      pusher.connection.bind('failed', () => { connectionState.value = 'disconnected'; });
    }

    // Subscribe and listen to the designated channel and event
    let eventName = settings.value.event;
    if (eventName && eventName.includes('.') && !eventName.startsWith('.') && !eventName.startsWith('\\')) {
      eventName = '.' + eventName;
    }

    echoInstance.channel(settings.value.channel)
      .listen(eventName, (data) => {
        handleIncomingMessage(data);
      });

  } catch (error) {
    console.error('Failed to initialize Echo client:', error);
    connectionState.value = 'disconnected';
  }
}

// Handle incoming message data
function handleIncomingMessage(data, isLocalTest = false) {
  // Extract text body from data envelope
  let text = '';
  if (typeof data === 'string') {
    text = data;
  } else if (data && typeof data === 'object') {
    text = data.response?.text || data.question?.text || data.message || data.text || data.prompt || data.tip || JSON.stringify(data);
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  messages.value.push({
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    text,
    time: timestamp,
    label: isLocalTest ? 'Test Mode' : 'Remote Broadcast'
  });

  // Keep feed scrolled to bottom on new prompts
  nextTick(() => {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
    }
  });
}

function decodeHtml(escapedString) {
  if (!escapedString) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = escapedString;
  return txt.value;
}

// Save configuration updates and trigger reconnect
function saveSettings() {
  localStorage.setItem('reverb_settings', JSON.stringify(settings.value));
  showSettings.value = false;
  connectEcho();
}

// Reset settings to defaults
function resetToDefaults() {
  settings.value = { ...DEFAULT_SETTINGS };
  localStorage.setItem('reverb_settings', JSON.stringify(settings.value));
  connectEcho();
}

// Send local simulated prompt to test the visual layout
function sendLocalTestPrompt() {
  const testPrompts = [
    "Wrap up the current topic in 30 seconds and transition to the core question.",
    "Great response. Ask about their scaling challenges next.",
    "Speak slightly slower. The audio feed has a slight echo.",
    "Remote team is checking the backup stream, keep going.",
    "Ask them to elaborate on the architecture diagram."
  ];
  const randomIndex = Math.floor(Math.random() * testPrompts.length);
  handleIncomingMessage(testPrompts[randomIndex], true);
}

// Clear all message history
function clearMessages() {
  messages.value = [];
}

// Electron System Window Calls
function minimizeApp() {
  if (window.electronAPI && window.electronAPI.minimizeWindow) {
    window.electronAPI.minimizeWindow();
  } else {
    console.log('Minimize API not available (Browser environment)');
  }
}

function closeApp() {
  if (window.electronAPI && window.electronAPI.closeWindow) {
    window.electronAPI.closeWindow();
  } else {
    console.log('Close API not available (Browser environment)');
  }
}
</script>

<template>
  <div class="app-container">
    <!-- Header with window dragging support & status -->
    <header class="app-header">
      <div class="header-left">
        <span
          class="status-dot"
          :class="{
            'connected': connectionState === 'connected',
            'connecting': connectionState === 'connecting',
            'disconnected': connectionState === 'disconnected'
          }"
          :title="'Status: ' + connectionState"
        ></span>
        <span class="header-title">Prompt Feed</span>
      </div>

      <!-- Custom window controls -->
      <div class="header-controls">
        <button class="btn-icon" @click="decreaseFont" title="Decrease font size" style="font-size: 10px; font-weight: bold; width: 20px;">A-</button>
        <span style="font-size: 11px; color: var(--text-muted); min-width: 14px; text-align: center;">{{ fontSize }}</span>
        <button class="btn-icon" @click="increaseFont" title="Increase font size" style="font-size: 11px; font-weight: bold; width: 20px;">A+</button>
        <div style="width: 1px; height: 14px; background: var(--border-color); margin: 0 2px;"></div>
        
        <button class="btn-icon" @click="showSettings = !showSettings" title="Configure Reverb settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
        <button class="btn-icon" @click="minimizeApp" title="Minimize Window">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="btn-icon btn-close" @click="closeApp" title="Quit App">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Message Bubble Scroller Feed -->
    <main ref="feedContainer" class="feed-content">
      <div v-if="messages.length === 0" class="feed-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>No prompt notifications received yet.</p>
        <p style="font-size: 11px; opacity: 0.8;">
          Listening on <strong>{{ settings.host }}:{{ settings.port }}</strong><br>
          Channel: <em>{{ settings.channel }}</em>
        </p>
        <button class="btn-primary" @click="sendLocalTestPrompt" style="padding: 6px 12px; font-size: 11px; margin-top: 12px;">
          Send Local Test Prompt
        </button>
      </div>

      <div v-else v-for="(msg, index) in messages" :key="msg.id" class="message-card" :class="{ 'is-latest': index === messages.length - 1 }">
        <div class="message-text" :style="{ fontSize: fontSize + 'px' }" v-html="decodeHtml(msg.text)"></div>
        <div class="message-meta">
          <span class="message-label">{{ msg.label }}</span>
          <span>{{ msg.time }}</span>
        </div>
      </div>
    </main>

    <!-- Settings Overlay Drawer -->
    <div v-if="showSettings" class="settings-overlay">
      <div class="settings-header">
        <h3 class="settings-title">Reverb Client Config</h3>
        <button class="btn-icon" @click="showSettings = false">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-form">
        <div class="form-group">
          <label>Host Domain</label>
          <input v-model="settings.host" type="text" placeholder="e.g. yourdomain.com" />
        </div>

        <div class="form-group">
          <label>Port</label>
          <input v-model="settings.port" type="text" placeholder="e.g. 443" />
        </div>

        <div class="form-group">
          <label>App Key</label>
          <input v-model="settings.appKey" type="text" placeholder="Reverb Key string" />
        </div>

        <div class="form-group">
          <label>Connection Scheme</label>
          <input v-model="settings.scheme" type="text" placeholder="https or http" />
        </div>

        <div class="form-group">
          <label>WebSocket Channel</label>
          <input v-model="settings.channel" type="text" placeholder="e.g. interview-channel" />
        </div>

        <div class="form-group">
          <label>Event Name</label>
          <input v-model="settings.event" type="text" placeholder="e.g. .TipSentEvent" />
        </div>

        <button class="btn-primary" @click="saveSettings">Save & Reconnect</button>
        <button class="btn-primary" @click="resetToDefaults" style="background: rgba(255, 255, 255, 0.1); color: var(--text-main); margin-top: 0;">
          Reset to Defaults
        </button>
        <button v-if="messages.length > 0" class="btn-primary" @click="clearMessages" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; margin-top: 0;">
          Clear Feed History
        </button>
      </div>
    </div>
  </div>
</template>
