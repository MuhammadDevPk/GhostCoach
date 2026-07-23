<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import MessageCard from './MessageCard.vue';

const props = defineProps({
  messages: {
    type: Array,
    required: true
  },
  activeMode: {
    type: String,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  aiSettings: {
    type: Object,
    required: true
  },
  fontSize: {
    type: Number,
    required: true
  },
  isLoading: {
    type: Boolean,
    required: true
  },
  voiceInterimText: {
    type: String,
    required: true
  }
});

defineEmits(['send-local-test-prompt', 'delete-message']);

const feedContainer = ref(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
    }
  });
};

// Scroll to bottom on updates to message list, loading status, or live voice capture text
watch(() => props.messages.length, scrollToBottom);
watch(() => props.isLoading, scrollToBottom);
watch(() => props.voiceInterimText, scrollToBottom);

onMounted(() => {
  scrollToBottom();
});
</script>

<template>
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
      <button 
        v-if="activeMode !== 'ai'" 
        class="btn-primary" 
        @click="$emit('send-local-test-prompt')" 
        style="padding: 6px 12px; font-size: 11px; margin-top: 12px;"
      >
        Send Local Test Prompt
      </button>
    </div>

    <!-- Render Message Card Components -->
    <template v-else>
      <MessageCard
        v-for="(msg, index) in messages"
        :key="msg.id"
        :msg="msg"
        :is-latest="index === messages.length - 1"
        :font-size="fontSize"
        @delete="$emit('delete-message', $event)"
      />
    </template>

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
</template>
