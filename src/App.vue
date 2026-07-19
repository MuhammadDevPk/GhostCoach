<script setup>
import { ref, onMounted, nextTick, computed, onBeforeUnmount } from 'vue';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { sendChatMessage } from './services/ai';
import { SpeechToText } from './services/voice';

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

// Define default AI settings
const DEFAULT_AI_SETTINGS = {
  enabled: true,
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  groqModel: 'llama-3.3-70b-versatile',
  openrouterModel: 'google/gemini-2.5-flash',
  githubModel: 'gpt-4o-mini',
  geminiKey: '',
  groqKey: '',
  openrouterKey: '',
  githubKey: '',
  systemInstruction: 'your role is to answer human like interview questions. I will share questions and you will only provide interview answers. and nothing more.'
};

// Application reactive states
const settings = ref({ ...DEFAULT_SETTINGS });
const aiSettings = ref({ ...DEFAULT_AI_SETTINGS });
const activeMode = ref('both'); // 'ws' | 'ai' | 'both'
const activeSettingsTab = ref('websocket'); // 'websocket' | 'ai'

const showSettings = ref(false);
const showChatInput = ref(true);
const messages = ref([]);
const chatHistory = ref([]);
const newQuestion = ref('');
const isLoading = ref(false);

const connectionState = ref('disconnected'); // 'connected' | 'connecting' | 'disconnected'
const feedContainer = ref(null);
const fontSize = ref(15);

// Voice STT state variables
const isMicListening = ref(false);
const voiceInterimText = ref('');
const voiceFinalText = ref('');
let sttInstance = null;

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

  const savedAiSettings = localStorage.getItem('ai_settings');
  if (savedAiSettings) {
    try {
      aiSettings.value = { ...DEFAULT_AI_SETTINGS, ...JSON.parse(savedAiSettings) };
    } catch (e) {
      console.error('Failed to parse saved AI settings', e);
    }
  }

  const savedActiveMode = localStorage.getItem('active_mode');
  if (savedActiveMode) {
    activeMode.value = savedActiveMode;
  }

  const savedShowChatInput = localStorage.getItem('show_chat_input');
  if (savedShowChatInput !== null) {
    showChatInput.value = savedShowChatInput === 'true';
  }

  const savedFontSize = localStorage.getItem('prompt_font_size');
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize) || 15;
  }

  // Setup Speech-to-Text Instance for manual toggle-to-record transcription
  sttInstance = new SpeechToText({
    onTranscript: (text) => {
      handleVoiceInputFinalized(text);
    },
    onStatusChange: (status) => {
      isMicListening.value = status;
    },
    onError: (errMessage) => {
      console.error('STT Error:', errMessage);
      handleIncomingMessage(`Voice Error: ${errMessage}`, true);
      voiceInterimText.value = '';
    }
  });

  connectEcho();
});

onBeforeUnmount(() => {
  if (sttInstance) {
    sttInstance.stop();
  }
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
    echoInstance = null;
  }

  // If activeMode is AI-only, do not attempt WebSocket connection
  if (activeMode.value === 'ai') {
    connectionState.value = 'disconnected';
    return;
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
  localStorage.setItem('ai_settings', JSON.stringify(aiSettings.value));
  localStorage.setItem('active_mode', activeMode.value);
  showSettings.value = false;
  connectEcho();
}

// Reset settings to defaults
function resetToDefaults() {
  settings.value = { ...DEFAULT_SETTINGS };
  aiSettings.value = { ...DEFAULT_AI_SETTINGS };
  activeMode.value = 'both';
  localStorage.setItem('reverb_settings', JSON.stringify(settings.value));
  localStorage.setItem('ai_settings', JSON.stringify(aiSettings.value));
  localStorage.setItem('active_mode', 'both');
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
  chatHistory.value = [];
}

// Toggle bottom chat input
function toggleChatInput() {
  showChatInput.value = !showChatInput.value;
  localStorage.setItem('show_chat_input', showChatInput.value);
  
  nextTick(() => {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
    }
  });
}

// Toggle microphone audio transcription
function toggleMic() {
  if (!sttInstance) return;
  if (isMicListening.value) {
    voiceInterimText.value = 'Transcribing...';
    sttInstance.stop().then(() => {
      voiceInterimText.value = '';
    });
  } else {
    // Extract active provider and API keys for transcription
    const provider = aiSettings.value.provider;
    const geminiKey = aiSettings.value.geminiKey;
    const groqKey = aiSettings.value.groqKey;
    const geminiModel = aiSettings.value.geminiModel;

    voiceInterimText.value = 'Recording voice... Click mic again to stop.';
    sttInstance.start({ provider, geminiKey, groqKey, geminiModel })
      .catch(err => {
        console.error('Failed to start voice recognition:', err);
        handleIncomingMessage(`Voice Error: ${err.message}`, true);
        voiceInterimText.value = '';
      });
  }
}

// Handle voice capture finalized event
function handleVoiceInputFinalized(text) {
  voiceInterimText.value = '';
  if (!text) return;
  // Fill the input area with transcribed text for the user to review/edit
  newQuestion.value = text;
}

// Send query to AI provider
async function sendQuestion() {
  const query = newQuestion.value.trim();
  if (!query || isLoading.value) return;

  // Determine active key & model
  let apiKey = '';
  let modelName = '';
  const provider = aiSettings.value.provider;

  if (provider === 'gemini') {
    apiKey = aiSettings.value.geminiKey;
    modelName = aiSettings.value.geminiModel;
  } else if (provider === 'groq') {
    apiKey = aiSettings.value.groqKey;
    modelName = aiSettings.value.groqModel;
  } else if (provider === 'openrouter') {
    apiKey = aiSettings.value.openrouterKey;
    modelName = aiSettings.value.openrouterModel;
  } else if (provider === 'github') {
    apiKey = aiSettings.value.githubKey;
    modelName = aiSettings.value.githubModel;
  }

  if (!apiKey) {
    handleIncomingMessage(`Error: API Key is missing for AI provider "${provider}". Please configure it in Settings.`, true);
    return;
  }

  // Clear input field immediately
  newQuestion.value = '';
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Add User bubble to UI
  messages.value.push({
    id: 'user-' + Date.now() + Math.random().toString(36).substr(2, 9),
    text: query,
    time: timestamp,
    label: 'You',
    isUser: true
  });

  // Append user turn to context history
  chatHistory.value.push({ role: 'user', content: query });

  nextTick(() => {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
    }
  });

  isLoading.value = true;

  try {
    const responseText = await sendChatMessage({
      provider,
      apiKey,
      model: modelName,
      systemInstruction: aiSettings.value.systemInstruction,
      history: chatHistory.value
    });

    const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Add AI response to UI
    messages.value.push({
      id: 'ai-' + Date.now() + Math.random().toString(36).substr(2, 9),
      text: responseText,
      time: replyTimestamp,
      label: 'AI Guide',
      isAi: true
    });

    // Append assistant response to context history
    chatHistory.value.push({ role: 'assistant', content: responseText });

  } catch (error) {
    console.error('AI Request Failed:', error);
    const errTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    messages.value.push({
      id: 'err-' + Date.now() + Math.random().toString(36).substr(2, 9),
      text: `Error calling AI: ${error.message || error}`,
      time: errTimestamp,
      label: 'AI Error',
      isError: true
    });

    // Remove the failed user prompt from conversation history to avoid corrupted context flow
    chatHistory.value.pop();
  } finally {
    isLoading.value = false;
    nextTick(() => {
      if (feedContainer.value) {
        feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
      }
    });
  }
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
        <span class="header-title">Ghost Coach</span>
      </div>

      <!-- Custom window controls -->
      <div class="header-controls">
        <button class="btn-icon" @click="decreaseFont" title="Decrease font size" style="font-size: 10px; font-weight: bold; width: 20px;">A-</button>
        <span style="font-size: 11px; color: var(--text-muted); min-width: 14px; text-align: center;">{{ fontSize }}</span>
        <button class="btn-icon" @click="increaseFont" title="Increase font size" style="font-size: 11px; font-weight: bold; width: 20px;">A+</button>
        
        <div style="width: 1px; height: 14px; background: var(--border-color); margin: 0 2px;"></div>

        <!-- Chat Input Toggle Button -->
        <button 
          class="btn-icon" 
          :class="{ 'active': showChatInput }" 
          @click="toggleChatInput" 
          title="Toggle AI Chat Input"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <button class="btn-icon" @click="showSettings = !showSettings" title="Configure App Settings">
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
        <p v-if="activeMode === 'ai'">AI Guidance mode active. Ask your coach a question below!</p>
        <p v-else>No prompt notifications received yet.</p>
        <p style="font-size: 11px; opacity: 0.8;">
          <span v-if="activeMode !== 'ai'">
            Listening on <strong>{{ settings.host }}:{{ settings.port }}</strong><br>
            Channel: <em>{{ settings.channel }}</em>
          </span>
          <span v-if="activeMode === 'both'"><br>— and —<br></span>
          <span v-if="activeMode !== 'ws'">
            AI Provider: <strong>{{ aiSettings.provider }}</strong>
          </span>
        </p>
        <button v-if="activeMode !== 'ai'" class="btn-primary" @click="sendLocalTestPrompt" style="padding: 6px 12px; font-size: 11px; margin-top: 12px;">
          Send Local Test Prompt
        </button>
      </div>

      <div v-else v-for="(msg, index) in messages" :key="msg.id" 
        class="message-card" 
        :class="{ 
          'is-latest': index === messages.length - 1 && !msg.isUser, 
          'is-user': msg.isUser, 
          'is-ai': msg.isAi, 
          'is-error': msg.isError 
        }"
      >
        <div class="message-text" :style="{ fontSize: fontSize + 'px' }" v-html="decodeHtml(msg.text)"></div>
        <div class="message-meta">
          <span class="message-label" :class="{ 'label-user': msg.isUser, 'label-ai': msg.isAi, 'label-error': msg.isError }">
            {{ msg.label }}
          </span>
          <span>{{ msg.time }}</span>
        </div>
      </div>

      <!-- Typing / Loading Indicator Bubble -->
      <div v-if="isLoading" class="message-card is-ai is-loading">
        <div class="typing-indicator" :style="{ fontSize: fontSize + 'px' }">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="message-meta">
          <span class="message-label label-ai">AI Guide</span>
          <span>Thinking...</span>
        </div>
      </div>

      <!-- Interim Voice Preview Overlay -->
      <div v-if="voiceInterimText" class="voice-interim-preview">
        <span class="pulse-dot-recording"></span>
        <span class="preview-label">Voice Capture:</span>
        <span class="preview-text">{{ voiceInterimText }}</span>
      </div>
    </main>

    <!-- Bottom Chat Input Bar -->
    <footer v-if="showChatInput" class="chat-input-bar">
      <!-- Microphone Button -->
      <button 
        class="btn-icon btn-mic" 
        :class="{ 'recording': isMicListening }" 
        @click="toggleMic" 
        :title="isMicListening ? 'Stop Voice Detection' : 'Start Voice Detection'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      </button>

      <textarea
        v-model="newQuestion"
        placeholder="Ask AI Coach or speak..."
        @keydown.enter.exact.prevent="sendQuestion"
        rows="1"
      ></textarea>
      <button class="btn-send" @click="sendQuestion" :disabled="isLoading || !newQuestion.trim()" title="Send Question">
        <svg v-if="!isLoading" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span v-else class="btn-spinner"></span>
      </button>
    </footer>

    <!-- Settings Overlay Drawer -->
    <div v-if="showSettings" class="settings-overlay">
      <div class="settings-header">
        <h3 class="settings-title">Ghost Coach Config</h3>
        <button class="btn-icon" @click="showSettings = false">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="settings-tabs">
        <button 
          class="tab-btn" 
          :class="{ 'active': activeSettingsTab === 'websocket' }" 
          @click="activeSettingsTab = 'websocket'"
        >
          WebSocket Config
        </button>
        <button 
          class="tab-btn" 
          :class="{ 'active': activeSettingsTab === 'ai' }" 
          @click="activeSettingsTab = 'ai'"
        >
          AI Guidance
        </button>
      </div>

      <div class="settings-form">
        <!-- WebSocket Tab Contents -->
        <template v-if="activeSettingsTab === 'websocket'">
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
        </template>

        <!-- AI Tab Contents -->
        <template v-else-if="activeSettingsTab === 'ai'">
          <div class="form-group">
            <label>Active Mode</label>
            <select v-model="activeMode" class="form-select">
              <option value="both">Both (WebSockets + AI)</option>
              <option value="ws">WebSocket Only</option>
              <option value="ai">AI Guidance Only</option>
            </select>
          </div>

          <div class="form-group">
            <label>AI Provider</label>
            <select v-model="aiSettings.provider" class="form-select">
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
              <option value="github">GitHub Models</option>
            </select>
          </div>

          <!-- Provider Specific fields -->
          <div v-if="aiSettings.provider === 'gemini'" class="provider-fields">
            <div class="form-group">
              <label>Gemini API Key</label>
              <input v-model="aiSettings.geminiKey" type="password" placeholder="AIzaSy..." />
            </div>
            <div class="form-group">
              <label>Model Name</label>
              <input v-model="aiSettings.geminiModel" type="text" placeholder="gemini-2.5-flash" />
            </div>
          </div>

          <div v-else-if="aiSettings.provider === 'groq'" class="provider-fields">
            <div class="form-group">
              <label>Groq API Key</label>
              <input v-model="aiSettings.groqKey" type="password" placeholder="gsk_..." />
            </div>
            <div class="form-group">
              <label>Model Name</label>
              <input v-model="aiSettings.groqModel" type="text" placeholder="llama-3.3-70b-versatile" />
            </div>
          </div>

          <div v-else-if="aiSettings.provider === 'openrouter'" class="provider-fields">
            <div class="form-group">
              <label>OpenRouter API Key</label>
              <input v-model="aiSettings.openrouterKey" type="password" placeholder="sk-or-v1-..." />
            </div>
            <div class="form-group">
              <label>Model Name</label>
              <input v-model="aiSettings.openrouterModel" type="text" placeholder="google/gemini-2.5-flash" />
            </div>
          </div>

          <div v-else-if="aiSettings.provider === 'github'" class="provider-fields">
            <div class="form-group">
              <label>GitHub Token</label>
              <input v-model="aiSettings.githubKey" type="password" placeholder="ghp_... or github_pat_..." />
            </div>
            <div class="form-group">
              <label>Model Name</label>
              <input v-model="aiSettings.githubModel" type="text" placeholder="gpt-4o-mini" />
            </div>
          </div>

          <div class="form-group">
            <label>AI Guidance Instructions (System Prompt)</label>
            <textarea 
              v-model="aiSettings.systemInstruction" 
              class="form-textarea" 
              rows="4" 
              placeholder="e.g. your role is to answer human like interview questions..."
            ></textarea>
          </div>
        </template>

        <button class="btn-primary" @click="saveSettings">Save & Apply</button>
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
