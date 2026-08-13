<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
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
  },
  teleprompterHighlight: {
    type: Object,
    default: null
  }
});

defineEmits(['send-local-test-prompt', 'delete-message']);

const feedContainer = ref(null);
const showScrollBottomBtn = ref(false);

const scrollToBottom = () => {
  nextTick(() => {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
      showScrollBottomBtn.value = false;
    }
  });
};

// Filter only response messages (exclude user queries) and limit to last 6.
const navResponses = computed(() => {
  return props.messages.filter(m => !m.isUser).slice(-6);
});

// Defining 6 distinct, premium, cohesive theme colors to group Q&A pairs with their indicators
const navColors = [
  // 6 (oldest of the recent 6)
  { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', glow: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }, // Red
  // 5
  { border: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', glow: 'rgba(249, 115, 22, 0.15)', text: '#f97316' }, // Orange
  // 4
  { border: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', glow: 'rgba(234, 179, 8, 0.15)', text: '#eab308' }, // Yellow
  // 3
  { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', glow: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' }, // Green
  // 2
  { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', glow: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' }, // Blue
  // 1 (latest)
  { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', glow: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' }  // Purple
];

// Returns custom style attributes to group a Q&A card visually using navColors.
// Using the absolute index of responses in props.messages ensures colors are stable and sticky
// and don't shift when new messages slide into the navigation view.
const getMessageColorStyle = (msg, index) => {
  let targetResponseId = null;
  if (!msg.isUser) {
    // If it's a response, check if it's within the recent 6 responses list
    const isRecent = navResponses.value.some(r => r.id === msg.id);
    if (isRecent) {
      targetResponseId = msg.id;
    }
  } else {
    // If it's a user query, check if the next message is a response in the recent 6
    const nextMsg = props.messages[index + 1];
    if (nextMsg && !nextMsg.isUser) {
      const isRecent = navResponses.value.some(r => r.id === nextMsg.id);
      if (isRecent) {
        targetResponseId = nextMsg.id;
      }
    }
  }

  if (targetResponseId) {
    const allResponses = props.messages.filter(m => !m.isUser);
    const absoluteIndex = allResponses.findIndex(r => r.id === targetResponseId);
    if (absoluteIndex !== -1) {
      const color = navColors[absoluteIndex % 6];
      return {
        border: `1.5px solid ${color.border}`,
        boxShadow: `0 4px 16px ${color.glow}`,
        background: `linear-gradient(135deg, var(--bg-card) 0%, ${color.bg} 100%)`
      };
    }
  }
  return {};
};

// Returns custom style attributes for navigation buttons based on their absolute index
const getNavButtonStyle = (msg) => {
  const allResponses = props.messages.filter(m => !m.isUser);
  const absoluteIndex = allResponses.findIndex(r => r.id === msg.id);
  if (absoluteIndex !== -1) {
    const color = navColors[absoluteIndex % 6];
    return {
      color: color.text,
      border: `1.5px solid ${color.border}`,
      backgroundColor: color.bg,
      boxShadow: `0 2px 8px ${color.glow}`
    };
  }
  return {};
};

// Scroll the chosen response card smoothly into view. If it was triggered by a user
// question directly preceding it, scroll to that question card instead, aligning it
// to the top of the feed container (block: 'start') so the entire Q&A context is visible.
const scrollToResponse = (msgId) => {
  const index = props.messages.findIndex(m => m.id === msgId);
  if (index !== -1) {
    const targetMsg = (index > 0 && props.messages[index - 1].isUser)
      ? props.messages[index - 1]
      : props.messages[index];

    const element = document.getElementById(`msg-${targetMsg.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

// Check if the user is scrolled up from the bottom of the feed container.
// If they are scrolled up by more than 0px, show the "Scroll to Bottom" indicator button.
const checkScrollPosition = () => {
  if (feedContainer.value) {
    const { scrollTop, clientHeight, scrollHeight } = feedContainer.value;
    showScrollBottomBtn.value = (scrollHeight - scrollTop - clientHeight) > 0;
  }
};

const handleScroll = () => {
  checkScrollPosition();
};

// Check scroll position when messages update, load states transition, or live voice capture updates.
// This ensures the floating arrow button reacts dynamically without forcing scrolls on the user.
watch(() => props.messages.length, () => {
  nextTick(checkScrollPosition);
});
watch(() => props.isLoading, () => {
  nextTick(checkScrollPosition);
});
watch(() => props.voiceInterimText, () => {
  nextTick(checkScrollPosition);
});

onMounted(() => {
  if (feedContainer.value) {
    feedContainer.value.addEventListener('scroll', handleScroll);
  }
  // Scroll to bottom on initial mount
  scrollToBottom();
});

onUnmounted(() => {
  if (feedContainer.value) {
    feedContainer.value.removeEventListener('scroll', handleScroll);
  }
});
</script>

<template>
  <div class="feed-container-wrapper">
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
          :teleprompter-highlight="teleprompterHighlight"
          :style="getMessageColorStyle(msg, index)"
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

    <!-- Scroll to Bottom Floating Button -->
    <button
      v-if="showScrollBottomBtn"
      class="scroll-bottom-btn"
      @click="scrollToBottom"
      type="button"
      title="Scroll to bottom"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
      </svg>
    </button>

    <!-- Floating Response Navigation Panel -->
    <div v-if="navResponses.length > 0" class="response-navigator">
      <button
        v-for="(msg, index) in navResponses"
        :key="msg.id"
        class="nav-num-btn"
        :style="getNavButtonStyle(msg)"
        @click="scrollToResponse(msg.id)"
        :title="msg.text ? msg.text.substring(0, 80) + '...' : ''"
      >
        {{ navResponses.length - index }}
      </button>
    </div>
  </div>
</template>
