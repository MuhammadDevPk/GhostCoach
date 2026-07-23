<script setup>
import { ref, watch } from 'vue';
import { parseResumeFile } from '../services/fileParser';

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
  'reset-to-defaults',
  'clear-messages',
  'close'
]);

const activeSettingsTab = ref('websocket');
const isFileParsing = ref(false);

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

const handleSave = () => {
  emit('save', {
    settings: JSON.parse(JSON.stringify(localSettings.value)),
    aiSettings: JSON.parse(JSON.stringify(localAiSettings.value)),
    activeMode: localActiveMode.value
  });
};
</script>

<template>
  <div class="settings-overlay">
    <div class="settings-header">
      <h3 class="settings-title">Ghost Coach Config</h3>
      <button class="btn-icon" @click="$emit('close')" title="Close Settings">
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
    </div>

    <div class="settings-form">
      <!-- WebSocket Tab Contents -->
      <template v-if="activeSettingsTab === 'websocket'">
        <div class="form-group">
          <label>Host Domain</label>
          <input v-model="localSettings.host" type="text" placeholder="e.g. yourdomain.com" />
        </div>

        <div class="form-group">
          <label>Port</label>
          <input v-model="localSettings.port" type="text" placeholder="e.g. 443" />
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
            <label>Gemini API Key</label>
            <input v-model="localAiSettings.geminiKey" type="password" placeholder="AIzaSy..." />
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.geminiModel" type="text" placeholder="gemini-2.5-flash" />
          </div>
        </div>

        <div v-else-if="localAiSettings.provider === 'groq'" class="provider-fields">
          <div class="form-group">
            <label>Groq API Key</label>
            <input v-model="localAiSettings.groqKey" type="password" placeholder="gsk_..." />
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.groqModel" type="text" placeholder="llama-3.3-70b-versatile" />
          </div>
        </div>

        <div v-else-if="localAiSettings.provider === 'openrouter'" class="provider-fields">
          <div class="form-group">
            <label>OpenRouter API Key</label>
            <input v-model="localAiSettings.openrouterKey" type="password" placeholder="sk-or-v1-..." />
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.openrouterModel" type="text" placeholder="google/gemini-2.5-flash" />
          </div>
        </div>

        <div v-else-if="localAiSettings.provider === 'github'" class="provider-fields">
          <div class="form-group">
            <label>GitHub Token</label>
            <input v-model="localAiSettings.githubKey" type="password" placeholder="ghp_... or github_pat_..." />
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input v-model="localAiSettings.githubModel" type="text" placeholder="gpt-4o-mini" />
          </div>
        </div>

        <div class="form-group">
          <label>AI Guidance Instructions (System Prompt)</label>
          <textarea
            v-model="localAiSettings.systemInstruction"
            class="form-textarea"
            rows="4"
            placeholder="e.g. your role is to answer human like interview questions..."
          ></textarea>
        </div>
      </template>

      <!-- Candidate Profile Tab Contents -->
      <template v-else-if="activeSettingsTab === 'candidate'">
        <div class="form-group">
          <label>Your Persona / Interview Persona</label>
          <textarea
            v-model="localAiSettings.persona"
            class="form-textarea"
            rows="4"
            placeholder="e.g. You are Haider. Speak in a human-like, conversational tone. Be clear and structural..."
          ></textarea>
        </div>

        <div class="form-group">
          <label>Upload Resume (.txt, .pdf, .docx)</label>
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
