<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { sendChatMessage } from './services/ai';
import { SpeechToText } from './services/voice';

// Component Imports
import AppHeader from './components/AppHeader.vue';
import MessageFeed from './components/MessageFeed.vue';
import ChatInput from './components/ChatInput.vue';
import SettingsOverlay from './components/SettingsOverlay.vue';

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
  systemInstruction: 'your role is to answer human like interview questions. I will share questions and you will only provide interview answers. and nothing more.',
  persona: '',
  resumeText: '',
  resumeFileName: ''
};

// Application reactive states
const settings = ref({ ...DEFAULT_SETTINGS });
const aiSettings = ref({ ...DEFAULT_AI_SETTINGS });
const activeMode = ref('both'); // 'ws' | 'ai' | 'both'

const showSettings = ref(false);
const showChatInput = ref(true);
const messages = ref([]);
const chatHistory = ref([]);
const newQuestion = ref('');
const isLoading = ref(false);

const connectionState = ref('disconnected'); // 'connected' | 'connecting' | 'disconnected'
const fontSize = ref(15);

// Voice STT state variables
const isMicListening = ref(false);
const voiceInterimText = ref('');
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
}

// Save configuration updates and trigger reconnect
function saveSettings() {
  localStorage.setItem('reverb_settings', JSON.stringify(settings.value));
  localStorage.setItem('ai_settings', JSON.stringify(aiSettings.value));
  localStorage.setItem('active_mode', activeMode.value);
  showSettings.value = false;
  connectEcho();
}

// Handle incoming save event from Settings component
function handleSaveSettings(payload) {
  settings.value = payload.settings;
  aiSettings.value = payload.aiSettings;
  activeMode.value = payload.activeMode;
  saveSettings();
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

// Delete a single message and update LLM context history accordingly
function deleteMessage(messageId) {
  messages.value = messages.value.filter(m => m.id !== messageId);
  // Rebuild chat history from the remaining user and AI messages in the feed
  chatHistory.value = messages.value
    .filter(m => m.isUser || m.isAi)
    .map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.text
    }));
}

// Toggle bottom chat input
function toggleChatInput() {
  showChatInput.value = !showChatInput.value;
  localStorage.setItem('show_chat_input', showChatInput.value);
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

  isLoading.value = true;

  try {
    const responseText = await sendChatMessage({
      provider,
      apiKey,
      model: modelName,
      systemInstruction: aiSettings.value.systemInstruction,
      history: chatHistory.value,
      persona: aiSettings.value.persona,
      resumeText: aiSettings.value.resumeText
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
    <AppHeader
      :connection-state="connectionState"
      :font-size="fontSize"
      :show-chat-input="showChatInput"
      :show-settings="showSettings"
      @decrease-font="decreaseFont"
      @increase-font="increaseFont"
      @toggle-chat-input="toggleChatInput"
      @toggle-settings="showSettings = !showSettings"
      @minimize="minimizeApp"
      @close="closeApp"
    />

    <MessageFeed
      :messages="messages"
      :active-mode="activeMode"
      :settings="settings"
      :ai-settings="aiSettings"
      :font-size="fontSize"
      :is-loading="isLoading"
      :voice-interim-text="voiceInterimText"
      @send-local-test-prompt="sendLocalTestPrompt"
      @delete-message="deleteMessage"
    />

    <ChatInput
      v-if="showChatInput"
      v-model="newQuestion"
      :is-mic-listening="isMicListening"
      :is-loading="isLoading"
      @toggle-mic="toggleMic"
      @submit="sendQuestion"
    />

    <SettingsOverlay
      v-if="showSettings"
      :settings="settings"
      :ai-settings="aiSettings"
      :active-mode="activeMode"
      :messages-count="messages.length"
      @save="handleSaveSettings"
      @reset-to-defaults="resetToDefaults"
      @clear-messages="clearMessages"
      @close="showSettings = false"
    />
  </div>
</template>
