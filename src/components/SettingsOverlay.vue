<script setup>
import { ref, watch } from 'vue';
import { parseResumeFile } from '../services/fileParser';
import { fetchRemoteProfile } from '../services/profileSync';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  },
  aiSettings: {
    type: Object,
    required: true
  },
  activeMode: {
    type: String,
    required: true
  },
  messagesCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits([
  'save',
  'save-silent',
  'reset-to-defaults',
  'clear-messages',
  'close'
]);

const activeSettingsTab = ref('websocket');
const isFileParsing = ref(false);

const vAutoResize = {
  mounted(el) {
    const adjust = () => {
      el.style.height = 'auto';
      const offset = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + offset}px`;
    };
    el.addEventListener('input', adjust);
    adjust();
    el._adjust = adjust;
  },
  updated(el) {
    if (el._adjust) el._adjust();
  },
  unmounted(el) {
    if (el._adjust) {
      el.removeEventListener('input', el._adjust);
    }
  }
};

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Protect token counts and latency by restricting uploads to 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert('Resume file exceeds the 5MB size limit.');
    return;
  }

  isFileParsing.value = true;
  try {
    const text = await parseResumeFile(file);
    localAiSettings.value.resumeText = text;
    localAiSettings.value.resumeFileName = file.name;
  } catch (err) {
    console.error(err);
    alert('Parsing error: ' + err.message);
  } finally {
    isFileParsing.value = false;
    event.target.value = ''; // Reset input element
  }
};

const clearResume = () => {
  localAiSettings.value.resumeText = '';
  localAiSettings.value.resumeFileName = '';
};

// Clone props locally to avoid direct prop mutation (Anti-pattern in Vue)
const localSettings = ref(JSON.parse(JSON.stringify(props.settings)));
const localAiSettings = ref(JSON.parse(JSON.stringify(props.aiSettings)));
const localActiveMode = ref(props.activeMode);

// Ensure key fields are arrays for robust rendering
['geminiKey', 'groqKey', 'openrouterKey', 'githubKey'].forEach(key => {
  if (typeof localAiSettings.value[key] === 'string') {
    localAiSettings.value[key] = localAiSettings.value[key] ? [localAiSettings.value[key]] : [''];
  } else if (!Array.isArray(localAiSettings.value[key]) || localAiSettings.value[key].length === 0) {
    localAiSettings.value[key] = [''];
  }
});

// Key visibility tracking map
const showKeys = ref({});

const toggleKeyVisibility = (keyField, index) => {
  const mapKey = `${keyField}-${index}`;
  showKeys.value[mapKey] = !showKeys.value[mapKey];
};

// Sync local state if external props change
watch(() => props.settings, (newVal) => {
  localSettings.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });

watch(() => props.aiSettings, (newVal) => {
  localAiSettings.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });

watch(() => props.activeMode, (newVal) => {
  localActiveMode.value = newVal;
});

const isSyncing = ref({
  all: false,
  ai_training: false,
  candidate_profile: false,
  resume: false
});

const syncStatus = ref({ text: '', isError: false });

const handleSave = () => {
  emit('save', {
    settings: JSON.parse(JSON.stringify(localSettings.value)),
    aiSettings: JSON.parse(JSON.stringify(localAiSettings.value)),
    activeMode: localActiveMode.value
  });
};

const handleRemoteSync = async (target = 'all') => {
  // Guard against unexpected target values
  const VALID_TARGETS = ['all', 'ai_training', 'candidate_profile', 'resume'];
  if (!VALID_TARGETS.includes(target)) {
    console.warn(`handleRemoteSync: unknown target "${target}" — ignoring.`);
    return;
  }

  isSyncing.value[target] = true;
  syncStatus.value = { text: '', isError: false };

  try {
    const updates = await fetchRemoteProfile({
      settings: localSettings.value,
      target
    });

    if (updates.systemInstruction !== undefined) {
      localAiSettings.value.systemInstruction = updates.systemInstruction;
    }
    if (updates.persona !== undefined) {
      localAiSettings.value.persona = updates.persona;
    }
    if (updates.resumeText !== undefined) {
      localAiSettings.value.resumeText = updates.resumeText;
      localAiSettings.value.resumeFileName = updates.resumeFileName || 'remote_resume.pdf';
    }

    // Auto save updated settings
    const hasRealUpdates = Object.keys(updates).filter(k => k!== 'resumeError').length > 0;
    if(hasRealUpdates) {
      emit('save-silent', {
        settings: JSON.parse(JSON.stringify(localSettings.value)),
        aiSettings: JSON.parse(JSON.stringify(localAiSettings.value)),
        activeMode: localActiveMode.value
      });
      emit('clear-messages');
    }

    let msg = 'Profile data synchronized successfully!';
    if (target === 'ai_training') msg = 'AI Training Guidelines synchronized!';
    else if (target === 'candidate_profile') msg = 'Candidate Persona synchronized!';
    else if (target === 'resume') msg = 'Remote Resume fetched & parsed!';

    if (updates.resumeError) {
      msg += ` (Note: ${updates.resumeError})`;
    }

    syncStatus.value = { text: msg, isError: false };
  } catch (err) {
    console.error('Failed to sync remote profile:', err);
    syncStatus.value = { text: err.message || 'Sync failed.', isError: true };
  } finally {
    isSyncing.value[target] = false;
  }
};

</script>

<template>
  <div class="settings-overlay">
    <div class="settings-header" style="align-items: center; justify-content: space-between;">
      <h3 class="settings-title">Ghost Coach Config</h3>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button
          type="button"
          class="btn-sync-all"
          style="font-size: 11px; padding: 4px 10px; margin: 0; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; gap: 4px; border-radius: 6px; cursor: pointer;"
          :disabled="isSyncing.all"
          @click="handleRemoteSync('all')"
          title="Fetch All 3 Profile Parts (AI Training, Persona & Resume) from Server and clear chat history"
        >
          <span v-if="isSyncing.all" class="btn-spinner" style="width: 10px; height: 10px;"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          {{ isSyncing.all ? 'Syncing...' : 'Fetch All' }}
        </button>
        <button class="btn-icon" @click="$emit('close')" >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="settings-tabs">
      <button
        class="tab-btn"
        :class="{ 'active': activeSettingsTab === 'websocket' }"
        @click="activeSettingsTab = 'websocket'"
        type="button"
      >
        WebSocket Config
      </button>
      <button
        class="tab-btn"
        :class="{ 'active': activeSettingsTab === 'ai' }"
        @click="activeSettingsTab = 'ai'"
        type="button"
      >
        AI Guidance
      </button>
      <button
        class="tab-btn"
        :class="{ 'active': activeSettingsTab === 'candidate' }"
        @click="activeSettingsTab = 'candidate'"
        type="button"
      >
        Candidate Profile
      </button>
      <button
        class="tab-btn"
        :class="{ 'active': activeSettingsTab === 'appearance' }"
        @click="activeSettingsTab = 'appearance'"
        type="button"
      >
        Appearance
      </button>
    </div>

    <!-- Sync Status Notification Banner -->
    <div v-if="syncStatus.text" style="margin: 8px 16px 0; padding: 8px 12px; border-radius: 6px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;" :style="{ background: syncStatus.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: syncStatus.isError ? '#ef4444' : '#10b981', border: syncStatus.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)' }">
      <span>{{ syncStatus.text }}</span>
      <button @click="syncStatus.text = ''" style="background: transparent; border: none; color: inherit; cursor: pointer; font-weight: bold; margin-left: 8px;" type="button">✕</button>
    </div>

    <div class="settings-form">
      <!-- WebSocket Tab Contents -->
      <template v-if="activeSettingsTab === 'websocket'">
        <div class="form-group">
          <label>Host Domain</label>
          <input v-model="localSettings.host" type="text" placeholder="e.g. localhost or yourdomain.com" />
        </div>

        <div class="form-group">
          <label>WebSocket Reverb Port</label>
          <input v-model="localSettings.port" type="text" placeholder="e.g. 8080 or 443" />
        </div>

        <div class="form-group">
          <label>Web API HTTP Port (Laravel Web Server)</label>
          <input v-model="localSettings.apiPort" type="text" placeholder="e.g. 8000" />
        </div>

        <div class="form-group">
          <label>App Key</label>
          <input v-model="localSettings.appKey" type="text" placeholder="Reverb Key string" />
        </div>

        <div class="form-group">
          <label>Connection Scheme</label>
          <input v-model="localSettings.scheme" type="text" placeholder="https or http" />
        </div>

        <div class="form-group">
          <label>WebSocket Channel</label>
          <input v-model="localSettings.channel" type="text" placeholder="e.g. interview-channel" />
        </div>

        <div class="form-group">
          <label>Event Name</label>
          <input v-model="localSettings.event" type="text" placeholder="e.g. .TipSentEvent" />
        </div>
      </template>

      <!-- AI Tab Contents -->
      <template v-else-if="activeSettingsTab === 'ai'">
        <div class="form-group">
          <label>Active Mode</label>
          <select v-model="localActiveMode" class="form-select">
            <option value="both">Both (WebSockets + AI)</option>
            <option value="ws">WebSocket Only</option>
            <option value="ai">AI Guidance Only</option>
          </select>
        </div>

        <div class="form-group">
          <label>AI Provider</label>
          <select v-model="localAiSettings.provider" class="form-select">
            <option value="gemini">Google Gemini</option>
            <option value="groq">Groq</option>
            <option value="openrouter">OpenRouter</option>
            <option value="github">GitHub Models</option>
          </select>
        </div>

        <!-- Provider Specific fields -->
        <div v-if="localAiSettings.provider === 'gemini'" class="provider-fields">
          <div class="form-group">
            <label>Gemini API Keys</label>
            <div v-for="(key, index) in localAiSettings.geminiKey" :key="index" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
              <input
                v-model="localAiSettings.geminiKey[index]"
                :type="showKeys['geminiKey-' + index] ? 'text' : 'password'"
                placeholder="AIzaSy..."
                style="flex: 1;"
              />
              <button
                type="button"
                style="color: var(--text-muted); background: rgba(255, 255, 255, 0.06); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); cursor: pointer;"
                @click="toggleKeyVisibility('geminiKey', index)"
              >
                <svg v-if="showKeys['geminiKey-' + index]" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button
                v-if="localAiSettings.geminiKey.length > 1"
                type="button"
                style="color: #ef4444; background: rgba(239, 68, 68, 0.15); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;"
                @click="localAiSettings.geminiKey.splice(index, 1)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="btn-primary"
              style="font-size: 11px; padding: 6px 12px; margin-top: 4px; background: rgba(255, 255, 255, 0.08); color: var(--text-main); border: 1px dashed var(--border-color); width: auto;"
              @click="localAiSettings.geminiKey.push('')"
            >
              + Add API Key
            </button>
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.geminiModel" type="text" placeholder="gemini-2.5-flash" />
          </div>
        </div>

        <div v-else-if="localAiSettings.provider === 'groq'" class="provider-fields">
          <div class="form-group">
            <label>Groq API Keys</label>
            <div v-for="(key, index) in localAiSettings.groqKey" :key="index" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
              <input
                v-model="localAiSettings.groqKey[index]"
                :type="showKeys['groqKey-' + index] ? 'text' : 'password'"
                placeholder="gsk_..."
                style="flex: 1;"
              />
              <button
                type="button"
                style="color: var(--text-muted); background: rgba(255, 255, 255, 0.06); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); cursor: pointer;"
                @click="toggleKeyVisibility('groqKey', index)"
              >
                <svg v-if="showKeys['groqKey-' + index]" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button
                v-if="localAiSettings.groqKey.length > 1"
                type="button"
                style="color: #ef4444; background: rgba(239, 68, 68, 0.15); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;"
                @click="localAiSettings.groqKey.splice(index, 1)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="btn-primary"
              style="font-size: 11px; padding: 6px 12px; margin-top: 4px; background: rgba(255, 255, 255, 0.08); color: var(--text-main); border: 1px dashed var(--border-color); width: auto;"
              @click="localAiSettings.groqKey.push('')"
            >
              + Add API Key
            </button>
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.groqModel" type="text" placeholder="llama-3.3-70b-versatile" />
          </div>
        </div>

        <div v-else-if="localAiSettings.provider === 'openrouter'" class="provider-fields">
          <div class="form-group">
            <label>OpenRouter API Keys</label>
            <div v-for="(key, index) in localAiSettings.openrouterKey" :key="index" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
              <input
                v-model="localAiSettings.openrouterKey[index]"
                :type="showKeys['openrouterKey-' + index] ? 'text' : 'password'"
                placeholder="sk-or-v1-..."
                style="flex: 1;"
              />
              <button
                type="button"
                style="color: var(--text-muted); background: rgba(255, 255, 255, 0.06); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); cursor: pointer;"
                @click="toggleKeyVisibility('openrouterKey', index)"
              >
                <svg v-if="showKeys['openrouterKey-' + index]" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button
                v-if="localAiSettings.openrouterKey.length > 1"
                type="button"
                style="color: #ef4444; background: rgba(239, 68, 68, 0.15); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;"
                @click="localAiSettings.openrouterKey.splice(index, 1)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="btn-primary"
              style="font-size: 11px; padding: 6px 12px; margin-top: 4px; background: rgba(255, 255, 255, 0.08); color: var(--text-main); border: 1px dashed var(--border-color); width: auto;"
              @click="localAiSettings.openrouterKey.push('')"
            >
              + Add API Key
            </button>
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.openrouterModel" type="text" placeholder="google/gemini-2.5-flash" />
          </div>
        </div>

        <div v-else-if="localAiSettings.provider === 'github'" class="provider-fields">
          <div class="form-group">
            <label>GitHub Tokens / API Keys</label>
            <div v-for="(key, index) in localAiSettings.githubKey" :key="index" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
              <input
                v-model="localAiSettings.githubKey[index]"
                :type="showKeys['githubKey-' + index] ? 'text' : 'password'"
                placeholder="ghp_... or github_pat_..."
                style="flex: 1;"
              />
              <button
                type="button"
                style="color: var(--text-muted); background: rgba(255, 255, 255, 0.06); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); cursor: pointer;"
                @click="toggleKeyVisibility('githubKey', index)"
              >
                <svg v-if="showKeys['githubKey-' + index]" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button
                v-if="localAiSettings.githubKey.length > 1"
                type="button"
                style="color: #ef4444; background: rgba(239, 68, 68, 0.15); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;"
                @click="localAiSettings.githubKey.splice(index, 1)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="btn-primary"
              style="font-size: 11px; padding: 6px 12px; margin-top: 4px; background: rgba(255, 255, 255, 0.08); color: var(--text-main); border: 1px dashed var(--border-color); width: auto;"
              @click="localAiSettings.githubKey.push('')"
            >
              + Add API Key
            </button>
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.githubModel" type="text" placeholder="gpt-4o-mini" />
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="margin: 0;">AI Guidance Instructions (System Prompt)</label>
            <button
              type="button"
              style="font-size: 10px; padding: 3px 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
              :disabled="isSyncing.ai_training"
              @click="handleRemoteSync('ai_training')"
              title="Fetch AI Training guidelines from server & clear chat"
            >
              <span v-if="isSyncing.ai_training" class="btn-spinner" style="width: 8px; height: 8px;"></span>
              <span>📡 Fetch Guidelines</span>
            </button>
          </div>
          <textarea
            v-model="localAiSettings.systemInstruction"
            v-auto-resize
            class="form-textarea"
            rows="4"
            placeholder="e.g. your role is to answer human like interview questions..."
          ></textarea>
        </div>
      </template>

      <!-- Candidate Profile Tab Contents -->
      <template v-else-if="activeSettingsTab === 'candidate'">
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="margin: 0;">Your Persona / Interview Persona</label>
            <button
              type="button"
              style="font-size: 10px; padding: 3px 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
              :disabled="isSyncing.candidate_profile"
              @click="handleRemoteSync('candidate_profile')"
              title="Fetch Candidate Persona summary from server & clear chat"
            >
              <span v-if="isSyncing.candidate_profile" class="btn-spinner" style="width: 8px; height: 8px;"></span>
              <span>📡 Fetch Persona</span>
            </button>
          </div>
          <textarea
            v-model="localAiSettings.persona"
            v-auto-resize
            class="form-textarea"
            rows="4"
            placeholder="e.g. You are Haider. Speak in a human-like, conversational tone. Be clear and structural..."
          ></textarea>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="margin: 0;">Upload Resume (.txt, .pdf, .docx)</label>
            <button
              type="button"
              style="font-size: 10px; padding: 3px 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
              :disabled="isSyncing.resume"
              @click="handleRemoteSync('resume')"
              title="Fetch & parse remote resume PDF/document from server & clear chat"
            >
              <span v-if="isSyncing.resume" class="btn-spinner" style="width: 8px; height: 8px;"></span>
              <span>📡 Fetch Remote Resume</span>
            </button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <input
              type="file"
              accept=".txt,.pdf,.docx"
              @change="handleFileUpload"
              :disabled="isFileParsing"
              style="display: none;"
              id="resume-file-input"
            />
            <label
              for="resume-file-input"
              class="btn-primary"
              style="display: inline-block; text-align: center; cursor: pointer; padding: 10px; margin: 0; background: var(--border-color); color: var(--text-main);"
            >
              {{ isFileParsing ? 'Parsing Resume...' : 'Choose File' }}
            </label>

            <div v-if="localAiSettings.resumeFileName" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-input); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
              <span style="font-size: 12px; color: var(--text-main); word-break: break-all;">
                📄 {{ localAiSettings.resumeFileName }}
              </span>
              <button
                @click="clearResume"
                type="button"
                style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 11px; font-weight: bold;"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Appearance Tab Contents -->
      <template v-else-if="activeSettingsTab === 'appearance'">
        <!-- <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-weight: 500;">
            <input v-model="localSettings.teleprompterEnabled" type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent-color); cursor: pointer;" />
            Enable Teleprompter Auto-Run
          </label>
        </div> -->

        <div class="form-group">
          <label>Main App Background Color</label>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
            <input v-model="localSettings.appBgColor" type="color" style="width: 50px; height: 32px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: transparent; padding: 0;" />
            <span style="font-family: monospace; font-size: 13px; color: var(--text-muted);">{{ localSettings.appBgColor || '#0e0e12' }}</span>
          </div>
        </div>
        <div class="form-group">
          <label>Main App Background Opacity ({{ Math.round((localSettings.appBgOpacity ?? 1.0) * 100) }}%)</label>
          <input v-model.number="localSettings.appBgOpacity" type="range" min="0" max="1" step="0.05" style="width: 100%; height: 6px; border-radius: 3px; accent-color: var(--accent-color); cursor: pointer;" />
        </div>

        <div class="form-group">
          <label>Teleprompter Background Color</label>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
            <input v-model="localSettings.teleprompterBgColor" type="color" style="width: 50px; height: 32px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: transparent; padding: 0;" />
            <span style="font-family: monospace; font-size: 13px; color: var(--text-muted);">{{ localSettings.teleprompterBgColor || '#191922' }}</span>
          </div>
        </div>
        <div class="form-group">
          <label>Teleprompter Background Opacity ({{ Math.round((localSettings.teleprompterBgOpacity ?? 0.95) * 100) }}%)</label>
          <input v-model.number="localSettings.teleprompterBgOpacity" type="range" min="0" max="1" step="0.05" style="width: 100%; height: 6px; border-radius: 3px; accent-color: var(--accent-color); cursor: pointer;" />
        </div>
      </template>

      <button class="btn-primary" @click="handleSave" type="button">Save & Apply</button>
      <button class="btn-primary" @click="$emit('reset-to-defaults')" style="background: rgba(255, 255, 255, 0.1); color: var(--text-main); margin-top: 0;" type="button">
        Reset to Defaults
      </button>
      <button v-if="messagesCount > 0" class="btn-primary" @click="$emit('clear-messages')" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; margin-top: 0;" type="button">
        Clear Feed History
      </button>
    </div>
  </div>
</template>
