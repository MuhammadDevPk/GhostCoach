<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { sendChatMessage } from './services/ai';
import { SpeechToText } from './services/voice';
import { extractTextFromImage } from './services/ocr';

// Component Imports
import AppHeader from './components/AppHeader.vue';
import MessageFeed from './components/MessageFeed.vue';
import ChatInput from './components/ChatInput.vue';
import SettingsOverlay from './components/SettingsOverlay.vue';
import Teleprompter from './components/Teleprompter.vue';

// Expose Pusher to window as required by Laravel Echo
window.Pusher = Pusher;

// Define default Reverb configuration
const DEFAULT_SETTINGS = {
  host: 'ws.helper-ext.larawork.com',
  port: '443',                 // WebSocket Reverb port
  apiPort: '8000',             // Web API HTTP port (Laravel Web Server)
  appKey: 'datgek4pdi3rxen8drie',
  scheme: 'https',
  channel: 'interview',
  event: '.guidance.created', // Prepend dot to listen to custom event literally (prevents Echo namespace prefixing)
  appBgColor: '#0e0e12',
  appBgOpacity: 1.0,
  teleprompterBgColor: '#191922',
  teleprompterBgOpacity: 0.95,
  teleprompterEnabled: true,  // auto-run on AI replies
  wsEnabled: true             // WebSocket connection enabled state (can be toggled from header)
};

// Define default AI settings
const DEFAULT_AI_SETTINGS = {
  enabled: true,
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  groqModel: 'openai/gpt-oss-120b',
  openrouterModel: 'google/gemini-2.5-flash',
  githubModel: 'gpt-4o-mini',
  geminiKey: [''],
  groqKey: [''],
  openrouterKey: [''],
  githubKey: [''],
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
const totalSessionTokens = ref(0);
const showTeleprompter = ref(false);
const teleprompterText = ref('');
// Real-time highlight range received from the teleprompter (null = no active highlight)
const teleprompterHighlight = ref(null);
const isTeleprompterMode = window.location.hash === '#/teleprompter';
let activeAbortController = null;

const connectionState = ref('disconnected'); // 'connected' | 'connecting' | 'disconnected'
const fontSize = ref(15);

// Voice STT state variables
const isMicListening = ref(false);
const isMicAutoSending = ref(false);
const voiceInterimText = ref('');
let sttInstance = null;

// Segmented Voice Sync and Blending States
const lastCheckpointResponse = ref('');
const lastRemainingResponse = ref('');
const hasCheckpointSent = ref(false);

// Active Echo instance pointer
let echoInstance = null;

// Load settings from localStorage and bootstrap connection
onMounted(() => {
  if (isTeleprompterMode) {
    if (window.electronAPI && typeof window.electronAPI.onLoadTeleprompter === 'function') {
      window.electronAPI.onLoadTeleprompter((text) => {
        teleprompterText.value = text;
      });
    }
    return; // Don't connect Echo, STT or listeners on the teleprompter window
  }
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

  // Normalize string keys into arrays for rotation compatibility
  ['geminiKey', 'groqKey', 'openrouterKey', 'githubKey'].forEach(key => {
    if (typeof aiSettings.value[key] === 'string') {
      aiSettings.value[key] = aiSettings.value[key] ? [aiSettings.value[key]] : [''];
    } else if (!Array.isArray(aiSettings.value[key]) || aiSettings.value[key].length === 0) {
      aiSettings.value[key] = [''];
    }
  });

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

  // Listen for global shortcut record toggle from main process
  if (window.electronAPI && typeof window.electronAPI.onToggleRecord === 'function') {
    window.electronAPI.onToggleRecord(() => {
      toggleMic();
    });
  }

  // Listen for global shortcut record & autosend toggle from main process
  if (window.electronAPI && typeof window.electronAPI.onToggleRecordAutosend === 'function') {
    window.electronAPI.onToggleRecordAutosend(() => {
      toggleMicAutoSend();
    });
  }

  // Listen for global shortcut partial checkpoint record from main process
  if (window.electronAPI && typeof window.electronAPI.onCheckpointRecord === 'function') {
    window.electronAPI.onCheckpointRecord(() => {
      handleCheckpointRecord();
    });
  }

  // Listen for global shortcut combine responses from main process
  if (window.electronAPI && typeof window.electronAPI.onCombineResponses === 'function') {
    window.electronAPI.onCombineResponses(() => {
      combineResponses();
    });
  }

  // Listen for global shortcut cancel from main process
  if (window.electronAPI && typeof window.electronAPI.onCancelRequest === 'function') {
    window.electronAPI.onCancelRequest(() => {
      cancelCurrentAction();
    });
  }

  // Listen for desktop screenshots captured from main process
  if (window.electronAPI && typeof window.electronAPI.onScreenshotCaptured === 'function') {
    window.electronAPI.onScreenshotCaptured((screenshotDataUrl) => {
      handleScreenshotCaptured(screenshotDataUrl);
    });
  }

  // Listen for desktop screenshot failures from main process
  if (window.electronAPI && typeof window.electronAPI.onScreenshotError === 'function') {
    window.electronAPI.onScreenshotError((errMessage) => {
      console.error('Screenshot Capture Failed:', errMessage);
      handleIncomingMessage(`Screenshot Error: ${errMessage}`, true);
    });
  }

  // Listen for external teleprompter window closed event to clear text and highlight
  if (window.electronAPI && typeof window.electronAPI.onTeleprompterClosed === 'function') {
    window.electronAPI.onTeleprompterClosed(() => {
      teleprompterText.value = '';
      teleprompterHighlight.value = null;
    });
  }

  // Receive real-time scroll progress from the Electron teleprompter window
  if (window.electronAPI && typeof window.electronAPI.onTeleprompterProgress === 'function') {
    window.electronAPI.onTeleprompterProgress((progress) => {
      teleprompterHighlight.value = progress;
    });
  }

  // Setup local window listeners for Escape, Cmd+C, Ctrl+D and Ctrl+Shift+D
  window.addEventListener('keydown', handleLocalKeydown, true);

  connectEcho();
});

onBeforeUnmount(() => {
  if (sttInstance) {
    sttInstance.stop();
  }
  if (!isTeleprompterMode) {
    window.removeEventListener('keydown', handleLocalKeydown, true);
  }
});

function handleSilentSave(payload) {
  settings.value = payload.settings;
  aiSettings.value = payload.aiSettings;
  activeMode.value = payload.activeMode;
  localStorage.setItem('reverb_settings', JSON.stringify(settings.value));
  localStorage.setItem('ai_settings', JSON.stringify(aiSettings.value));
  localStorage.setItem('active_mode', activeMode.value);
  // No showSettings.value = false → panel stays open
  // No connectEcho() → no WebSocket reconnect during sync
}


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

  // If WebSocket is disabled by user or activeMode is AI-only, do not attempt connection
  if (settings.value.wsEnabled === false || activeMode.value === 'ai') {
    connectionState.value = 'disconnected';
    return;
  }

  connectionState.value = 'connecting';

  try {
    const useTLS = settings.value.scheme === 'https';
    let wsHost = (settings.value.host || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').replace(/:\d+$/, '');
    const wsPort = parseInt(settings.value.port) || (useTLS ? 443 : 80);

    echoInstance = new Echo({
      broadcaster: 'reverb',
      key: settings.value.appKey,
      wsHost: wsHost,
      wsPort: wsPort,
      wssPort: wsPort,
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

// Toggle WebSocket connection ON/OFF (Start WS / End WS)
function toggleWs() {
  const nextState = settings.value.wsEnabled === false ? true : false;
  settings.value.wsEnabled = nextState;
  localStorage.setItem('reverb_settings', JSON.stringify(settings.value));

  if (nextState) {
    connectEcho();
  } else {
    if (echoInstance) {
      try {
        echoInstance.disconnect();
      } catch (e) {
        console.error('Error disconnecting Echo instance on toggle:', e);
      }
      echoInstance = null;
    }
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

  // Trigger teleprompter for incoming response (only when auto-run is enabled)
  if (text && settings.value.teleprompterEnabled) {
    runTeleprompter(text);
  }
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
  totalSessionTokens.value = 0;
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

// Local key listener to trigger cancel on Escape or Cmd+C (during active loading or recording)
// Also handles Ctrl+D / Cmd+D to run selected text on teleprompter, and Ctrl+Shift+D / Cmd+Shift+D to append
function handleLocalKeydown(e) {
  if (isLoading.value || isMicListening.value) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelCurrentAction();
      return;
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      cancelCurrentAction();
      return;
    }
  }

  if (e.key.toLowerCase() === 'd') {
    const isControlOrCommand = e.ctrlKey || e.metaKey;
    if (isControlOrCommand) {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        e.preventDefault();
        if (e.shiftKey) {
          appendTeleprompter(selectedText);
        } else {
          runTeleprompter(selectedText);
        }
      }
    }
  }
}

// Cancel the active AI request using AbortController
function cancelActiveAiCall() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

// Cancel and discard active voice recording session without transcribing
function cancelVoiceRecording() {
  if (!sttInstance) return;
  isMicAutoSending.value = false;
  sttInstance.stop(false).then(() => {
    voiceInterimText.value = '';
  });
}

// Cancel current operation: either the active AI generation request or the running voice recording
function cancelCurrentAction() {
  if (isLoading.value) {
    cancelActiveAiCall();
  } else if (isMicListening.value) {
    cancelVoiceRecording();
  }
}

// Close external or local teleprompter
function closeTeleprompterWindow() {
  if (window.electronAPI && typeof window.electronAPI.closeTeleprompter === 'function') {
    window.electronAPI.closeTeleprompter();
  } else {
    showTeleprompter.value = false;
  }
}

// Open teleprompter with manual or automatic text
function runTeleprompter(text) {
  teleprompterText.value = text;
  if (window.electronAPI && typeof window.electronAPI.showTeleprompter === 'function') {
    window.electronAPI.showTeleprompter(text);
  } else {
    showTeleprompter.value = true;
  }
}

// Append new selected text to existing teleprompter marquee
function appendTeleprompter(text) {
  const currentText = teleprompterText.value;
  const separator = '   |   ';
  const newText = currentText ? `${currentText}${separator}${text}` : text;
  teleprompterText.value = newText;

  if (window.electronAPI && typeof window.electronAPI.showTeleprompter === 'function') {
    window.electronAPI.showTeleprompter(newText);
  } else {
    showTeleprompter.value = true;
  }
}

// Toggle bottom chat input
function toggleChatInput() {
  showChatInput.value = !showChatInput.value;
  localStorage.setItem('show_chat_input', showChatInput.value);
}

// Toggle microphone audio transcription (Manual review mode)
function toggleMic() {
  if (!sttInstance) return;
  if (isMicListening.value) {
    voiceInterimText.value = 'Transcribing...';
    sttInstance.stop().then(() => {
      voiceInterimText.value = '';
    });
  } else {
    isMicAutoSending.value = false;
    // Clear recent/latest response references for a clean session
    lastCheckpointResponse.value = '';
    lastRemainingResponse.value = '';
    hasCheckpointSent.value = false;

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

// Toggle microphone audio transcription with Auto-Send to AI
function toggleMicAutoSend() {
  if (!sttInstance) return;
  if (isMicListening.value) {
    voiceInterimText.value = 'Transcribing & sending to AI...';
    sttInstance.stop().then(() => {
      voiceInterimText.value = '';
    });
  } else {
    isMicAutoSending.value = true;
    // Clear recent/latest response references for a clean session
    lastCheckpointResponse.value = '';
    lastRemainingResponse.value = '';
    hasCheckpointSent.value = false;

    const provider = aiSettings.value.provider;
    const geminiKey = aiSettings.value.geminiKey;
    const groqKey = aiSettings.value.groqKey;
    const geminiModel = aiSettings.value.geminiModel;

    voiceInterimText.value = 'Recording (Auto-Send mode)... Click Mic+Send again to finish & send.';
    sttInstance.start({ provider, geminiKey, groqKey, geminiModel })
      .catch(err => {
        console.error('Failed to start voice recognition:', err);
        handleIncomingMessage(`Voice Error: ${err.message}`, true);
        voiceInterimText.value = '';
        isMicAutoSending.value = false;
      });
  }
}

// Handle partial/checkpoint transcription shortcut (Cmd+Shift+P) during listening
async function handleCheckpointRecord() {
  if (!isMicListening.value || !sttInstance) return;

  voiceInterimText.value = 'Capturing partial audio checkpoint...';
  try {
    const audioBlob = await sttInstance.getCheckpointBlob();
    if (!audioBlob) {
      voiceInterimText.value = 'Recording (no new checkpoint audio)...';
      return;
    }

    voiceInterimText.value = 'Transcribing partial audio...';
    const text = await sttInstance.transcribeBlob(audioBlob);
    if (!text) {
      voiceInterimText.value = 'Recording (empty checkpoint)...';
      return;
    }

    // Mark checkpoint as sent BEFORE awaiting AI so that if the user
    // stops recording while the AI is still generating, handleVoiceInputFinalized
    // correctly routes the remaining audio to Part 2 instead of normal send.
    hasCheckpointSent.value = true;
    voiceInterimText.value = 'Checkpoint sent. Still listening...';
    await sendSegmentedQuestion(text, 'checkpoint');
  } catch (err) {
    console.error('Failed to handle checkpoint recording:', err);
    handleIncomingMessage(`Checkpoint Error: ${err.message}`, true);
    voiceInterimText.value = 'Recording (checkpoint failed)...';
  }
}

// Handle voice capture finalized event
function handleVoiceInputFinalized(text) {
  voiceInterimText.value = '';
  const autoSend = isMicAutoSending.value;
  isMicAutoSending.value = false; // reset flag
  if (!text) return;

  if (hasCheckpointSent.value) {
    // We already sent part 1, so this is the remaining audio (part 2)
    sendSegmentedQuestion(text, 'remaining');
  } else {
    // Normal single-segment voice submission
    newQuestion.value = text;
    if (autoSend) {
      sendQuestion();
    }
  }
}

// Send segmented query to AI provider (keeps feed clean and labels steps)
async function sendSegmentedQuestion(query, type) {
  if (!query) return;

  // If an AI call is already in flight (e.g. checkpoint is still generating),
  // wait for it to finish instead of silently dropping the remaining audio.
  if (isLoading.value) {
    await new Promise(resolve => {
      const timer = setInterval(() => {
        if (!isLoading.value) { clearInterval(timer); resolve(); }
      }, 300);
    });
  }

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
    handleIncomingMessage(`Error: API Key is missing for AI provider "${provider}".`, true);
    return;
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const labelSuffix = type === 'checkpoint' ? ' [Part 1]' : ' [Part 2]';

  // Add User bubble to UI
  messages.value.push({
    id: 'user-' + Date.now() + Math.random().toString(36).substr(2, 9),
    text: query,
    time: timestamp,
    label: 'You' + labelSuffix,
    isUser: true
  });

  // Append user turn to context history
  chatHistory.value.push({ role: 'user', content: query });

  isLoading.value = true;
  activeAbortController = new AbortController();

  // Rate-limit aware retry loop — Groq TPM limits can be hit when +P and +L
  // fire two large calls within the same 60-second window. The error message
  // tells us exactly how long to wait ("try again in 4.27s"), so we parse it
  // and retry automatically instead of surfacing a confusing error.
  const MAX_RATE_RETRIES = 2;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RATE_RETRIES; attempt++) {
    try {
      activeAbortController = new AbortController();
      const aiResult = await sendChatMessage({
        provider,
        apiKey,
        model: modelName,
        systemInstruction: aiSettings.value.systemInstruction,
        history: chatHistory.value,
        persona: aiSettings.value.persona,
        resumeText: aiSettings.value.resumeText,
        skipHumanizerReminder: true, // saves ~300 tokens per segmented call to reduce TPM pressure
        signal: activeAbortController.signal
      });

      const responseText = aiResult.text;
      const usage = aiResult.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      totalSessionTokens.value += usage.totalTokens;

      // Save response pointers
      if (type === 'checkpoint') {
        lastCheckpointResponse.value = responseText;
      } else if (type === 'remaining') {
        lastRemainingResponse.value = responseText;
      }

      // Add AI response bubble
      messages.value.push({
        id: 'ai-' + Date.now() + Math.random().toString(36).substr(2, 9),
        text: responseText,
        time: `${usage.completionTokens}/${totalSessionTokens.value}`,
        label: 'AI Guide' + labelSuffix,
        isAi: true
      });

      chatHistory.value.push({ role: 'assistant', content: responseText });

      if (settings.value.teleprompterEnabled) {
        runTeleprompter(responseText);
      }

      // Success — exit retry loop
      lastError = null;
      break;

    } catch (error) {
      lastError = error;

      // Abort errors should never be retried
      if (error.name === 'AbortError') break;

      // Detect rate-limit errors (429 / TPM exceeded)
      const isRateLimit = /rate.?limit|429|tokens per minute|TPM|try again in/i.test(error.message);

      if (isRateLimit && attempt < MAX_RATE_RETRIES - 1) {
        // Parse "try again in X.XX s" from the Groq error message, fall back to 8s
        const waitMatch = error.message.match(/try again in (\d+(?:\.\d+)?)/i);
        const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 1 : 8;

        console.warn(`Rate limit hit for segmented call (${type}), retrying in ${waitSec}s...`);

        // Show a live countdown so the user knows what's happening
        for (let s = waitSec; s > 0; s--) {
          voiceInterimText.value = `Rate limit — retrying in ${s}s...`;
          await new Promise(r => setTimeout(r, 1000));
        }
        voiceInterimText.value = 'Retrying...';
        continue;
      }

      // Non-rate-limit error or out of retries — surface it
      break;
    }
  }

  isLoading.value = false;
  activeAbortController = null;

  // Restore the listening status text if the microphone is still active
  // so the recording badge stays visible and continues pulsing in the UI.
  if (isMicListening.value) {
    voiceInterimText.value = isMicAutoSending.value
      ? 'Recording (Auto-Send mode)... Click Mic+Send again to finish & send.'
      : 'Recording voice... Click mic again to stop.';
  } else {
    voiceInterimText.value = '';
  }

  if (lastError && lastError.name !== 'AbortError') {
    console.error(`Segmented sync failure (${type}):`, lastError);
    handleIncomingMessage(`Sync Error (${type}): ${lastError.message}`, true);
  }
}

// Blend/combine Part 1 and Part 2 responses (Cmd+Shift+K)
async function combineResponses() {
  const answer1 = lastCheckpointResponse.value.trim();
  const answer2 = lastRemainingResponse.value.trim();

  if (!answer1 || !answer2) {
    handleIncomingMessage("Cannot combine responses: You must first record a segmented voice session with a checkpoint.", true);
    return;
  }

  // Simply concatenate the two parts locally instead of hitting the API
  const combinedText = `${answer1}\n\n${answer2}`;

  // Push combined response message to UI
  messages.value.push({
    id: 'combined-' + Date.now(),
    text: combinedText,
    time: `0/${totalSessionTokens.value}`,
    label: 'Combined AI Response',
    isAi: true
  });

  if (settings.value.teleprompterEnabled) {
    runTeleprompter(combinedText);
  }

  // Reset flags after combination is complete
  lastCheckpointResponse.value = '';
  lastRemainingResponse.value = '';
  hasCheckpointSent.value = false;
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
  activeAbortController = new AbortController();

  try {
    const aiResult = await sendChatMessage({
      provider,
      apiKey,
      model: modelName,
      systemInstruction: aiSettings.value.systemInstruction,
      history: chatHistory.value,
      persona: aiSettings.value.persona,
      resumeText: aiSettings.value.resumeText,
      signal: activeAbortController.signal
    });

    const responseText = aiResult.text;
    const usage = aiResult.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Accumulate total tokens used in this session
    totalSessionTokens.value += usage.totalTokens;

    // Update corresponding user message's display metadata to show prompt tokens
    const userMsg = [...messages.value].reverse().find(m => m.isUser);
    if (userMsg) {
      userMsg.time = `${usage.promptTokens}`;
    }

    // Add AI response to UI, showing completion tokens and total session tokens
    messages.value.push({
      id: 'ai-' + Date.now() + Math.random().toString(36).substr(2, 9),
      text: responseText,
      time: `${usage.completionTokens}/${totalSessionTokens.value}`,
      label: 'AI Guide',
      isAi: true
    });

    // Append assistant response to context history
    chatHistory.value.push({ role: 'assistant', content: responseText });

    // Trigger teleprompter for local query response (only when auto-run is enabled)
    if (settings.value.teleprompterEnabled) {
      runTeleprompter(responseText);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      messages.value.push({
        id: 'cancel-' + Date.now() + Math.random().toString(36).substr(2, 9),
        text: 'AI request cancelled.',
        time: 'cancelled',
        label: 'System',
        isError: true
      });
      // Remove the failed user prompt from conversation history to avoid corrupted context flow
      chatHistory.value.pop();
    } else {
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
    }
  } finally {
    isLoading.value = false;
    activeAbortController = null;
  }
}

// Send screenshot query to AI provider
// Helper to check if an API key setting is configured (handling both single strings and arrays of strings)
const hasKey = (keyVal) => {
  if (!keyVal) return false;
  const arr = Array.isArray(keyVal) ? keyVal : [keyVal];
  return arr.some(k => typeof k === 'string' && k.trim() !== '');
};

// Send screenshot query to AI provider
async function sendScreenshotQuestion(query, screenshotBase64) {
  const isGeminiAvailable = hasKey(aiSettings.value.geminiKey);
  const isGroqAvailable = hasKey(aiSettings.value.groqKey);

  let provider = aiSettings.value.provider;
  let apiKey = '';
  let modelName = '';

  // Priority screenshot routing: Gemini (natively multimodal) > Groq (OCR fallback) > Current Provider
  if (isGeminiAvailable) {
    provider = 'gemini';
    apiKey = aiSettings.value.geminiKey;
    modelName = aiSettings.value.geminiModel;
  } else if (isGroqAvailable) {
    provider = 'groq';
    apiKey = aiSettings.value.groqKey;
    modelName = aiSettings.value.groqModel;
  } else {
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
  }

  if (!apiKey) {
    handleIncomingMessage(`Error: API Key is missing for AI provider "${provider}". Please configure it in Settings.`, true);
    return;
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Add User bubble to UI showing screenshot thumbnail indicator
  messages.value.push({
    id: 'user-' + Date.now() + Math.random().toString(36).substr(2, 9),
    text: screenshotBase64 ? '[Captured Screen Snapshot] 📸' : query,
    time: timestamp,
    label: 'You (Screen)',
    isUser: true
  });

  // Append user prompt turn to context history
  chatHistory.value.push({
    role: 'user',
    content: screenshotBase64
      ? 'Identify and answer the core question, prompt, or slide topic shown in this attached screen capture.'
      : query
  });

  isLoading.value = true;
  activeAbortController = new AbortController();

  try {
    const aiResult = await sendChatMessage({
      provider,
      apiKey,
      model: modelName,
      systemInstruction: aiSettings.value.systemInstruction,
      history: chatHistory.value,
      persona: aiSettings.value.persona,
      resumeText: aiSettings.value.resumeText,
      screenshotBase64, // Pass base64 image data URL for vision parsing
      signal: activeAbortController.signal
    });

    const responseText = aiResult.text;
    const usage = aiResult.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    totalSessionTokens.value += usage.totalTokens;

    // Update prompt token count metadata in display
    const userMsg = [...messages.value].reverse().find(m => m.isUser);
    if (userMsg) {
      userMsg.time = `${usage.promptTokens}`;
    }

    // Add AI response to UI
    messages.value.push({
      id: 'ai-' + Date.now() + Math.random().toString(36).substr(2, 9),
      text: responseText,
      time: `${usage.completionTokens}/${totalSessionTokens.value}`,
      label: 'AI Guide (Screen)',
      isAi: true
    });

    chatHistory.value.push({ role: 'assistant', content: responseText });

    if (settings.value.teleprompterEnabled) {
      runTeleprompter(responseText);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      messages.value.push({
        id: 'cancel-' + Date.now() + Math.random().toString(36).substr(2, 9),
        text: 'AI request cancelled.',
        time: 'cancelled',
        label: 'System',
        isError: true
      });
      chatHistory.value.pop();
    } else {
      console.error('Screen AI Request Failed:', error);
      const errTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      messages.value.push({
        id: 'err-' + Date.now() + Math.random().toString(36).substr(2, 9),
        text: `Error calling Screen AI: ${error.message || error}`,
        time: errTimestamp,
        label: 'AI Error',
        isError: true
      });
      chatHistory.value.pop();
    }
  } finally {
    isLoading.value = false;
    activeAbortController = null;
  }
}

// Coordinate the screen text analysis process
async function handleScreenshotCaptured(screenshotDataUrl) {
  isLoading.value = true;
  voiceInterimText.value = 'Analyzing captured screen contents...';

  try {
    const isGeminiAvailable = hasKey(aiSettings.value.geminiKey);
    const isGroqAvailable = hasKey(aiSettings.value.groqKey);

    let chosenProvider = aiSettings.value.provider;
    if (isGeminiAvailable) {
      chosenProvider = 'gemini';
    } else if (isGroqAvailable) {
      chosenProvider = 'groq';
    }

    // Direct multimodal vision support is available for Gemini, OpenRouter, and GitHub Models
    const supportsVision = ['gemini', 'openrouter', 'github'].includes(chosenProvider);

    if (supportsVision) {
      await sendScreenshotQuestion('', screenshotDataUrl);
    } else {
      // Fallback local OCR extraction for purely text-only models
      voiceInterimText.value = 'Running local OCR character extraction...';
      const extractedText = await extractTextFromImage(screenshotDataUrl);

      if (!extractedText || !extractedText.trim()) {
        throw new Error('Local OCR found no readable text in the screenshot. Please make sure the target window is active directly behind the overlay.');
      }

      voiceInterimText.value = 'Refining text prompt...';
      const prompt = `Refine and answer the core question or prompt from this extracted screen text:

${extractedText}`;

      await sendScreenshotQuestion(prompt, null);
    }
  } catch (err) {
    console.error('Failed to process screen capture query:', err);
    handleIncomingMessage(`Screen Capture Error: ${err.message}`, true);
  } finally {
    isLoading.value = false;
    voiceInterimText.value = '';
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
  <div v-if="isTeleprompterMode" class="teleprompter-window-wrapper">
    <Teleprompter
      :text="teleprompterText"
      @close="closeTeleprompterWindow"
      @progress="teleprompterHighlight = $event"
    />
  </div>
  <div v-else class="app-container">
    <div class="app-bg-overlay" :style="{ backgroundColor: settings.appBgColor || '#0e0e12', opacity: settings.appBgOpacity !== undefined ? settings.appBgOpacity : 1.0 }"></div>
    <AppHeader
      :connection-state="connectionState"
      :font-size="fontSize"
      :show-chat-input="showChatInput"
      :show-settings="showSettings"
      :teleprompter-enabled="settings.teleprompterEnabled ?? true"
      :ws-enabled="settings.wsEnabled ?? true"
      @decrease-font="decreaseFont"
      @increase-font="increaseFont"
      @toggle-chat-input="toggleChatInput"
      @toggle-settings="showSettings = !showSettings"
      @toggle-teleprompter="settings.teleprompterEnabled = !settings.teleprompterEnabled"
      @toggle-ws="toggleWs"
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
      :teleprompter-highlight="teleprompterHighlight"
      @send-local-test-prompt="sendLocalTestPrompt"
      @delete-message="deleteMessage"
    />

    <ChatInput
      v-if="showChatInput"
      v-model="newQuestion"
      :is-mic-listening="isMicListening"
      :is-mic-auto-sending="isMicAutoSending"
      :is-loading="isLoading"
      @toggle-mic="toggleMic"
      @toggle-mic-autosend="toggleMicAutoSend"
      @submit="sendQuestion"
      @cancel="cancelCurrentAction"
    />

    <SettingsOverlay
      v-if="showSettings"
      :settings="settings"
      :ai-settings="aiSettings"
      :active-mode="activeMode"
      :messages-count="messages.length"
      @save="handleSaveSettings"
      @save-silent="handleSilentSave"
      @reset-to-defaults="resetToDefaults"
      @clear-messages="clearMessages"
      @close="showSettings = false"
    />

    <Teleprompter
      v-if="showTeleprompter"
      :text="teleprompterText"
      @close="closeTeleprompterWindow"
    />
  </div>
</template>
