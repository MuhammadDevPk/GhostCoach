<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  msg: {
    type: Object,
    required: true,
    validator: (value) => {
      return typeof value.text === 'string' && typeof value.time === 'string' && typeof value.label === 'string';
    }
  },
  isLatest: {
    type: Boolean,
    default: false
  },
  fontSize: {
    type: Number,
    required: true
  },
  teleprompterHighlight: {
    type: Object,
    default: null
  }
});

const isCollapsed = ref(true);

// Identifies if this message is a screenshot prompt containing verbose OCR text
const isScreenshotCard = computed(() => {
  return props.msg.label === 'You (Screen)' && props.msg.text.length > 80;
});

// Decodes HTML entities safely
const decodedText = computed(() => {
  const escapedString = props.msg.text;
  if (!escapedString) return '';

  // Clean, standard browser element decoding
  const txt = document.createElement('textarea');
  txt.innerHTML = escapedString;
  return txt.value;
});

/**
 * Returns HTML with the active teleprompter range wrapped in <mark class="tp-highlight">.
 * Falls back to plain decodedText if no highlight matches this message.
 * All text segments are HTML-escaped to prevent XSS through v-html.
 */
const highlightedText = computed(() => {
  const decoded = decodedText.value;
  if (!decoded || !props.teleprompterHighlight) return decoded;

  const { text: teleText, startIndex, endIndex } = props.teleprompterHighlight;
  if (!teleText || startIndex >= endIndex) return decoded;

  // Check if the teleprompter text appears in this message
  const offset = decoded.indexOf(teleText);
  if (offset === -1) return decoded; // not this message

  const absStart = Math.max(0, offset + startIndex);
  const absEnd = Math.min(decoded.length, offset + endIndex);
  if (absStart >= absEnd) return decoded;

  // Escape HTML in each segment to prevent XSS (we're using v-html)
  const esc = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const before = esc(decoded.substring(0, absStart));
  const marked = esc(decoded.substring(absStart, absEnd));
  const after  = esc(decoded.substring(absEnd));

  return `${before}<mark class="tp-highlight">${marked}</mark>${after}`;
});

const emit = defineEmits(['delete']);
</script>

<template>
  <div
    :id="'msg-' + msg.id"
    class="message-card"
    :class="{
      'is-latest': isLatest && !msg.isUser,
      'is-user': msg.isUser,
      'is-ai': msg.isAi,
      'is-error': msg.isError
    }"
  >
    <!-- Renders full text if not a long screenshot OCR card, or if it has been expanded -->
    <div
      v-if="!isScreenshotCard || !isCollapsed"
      class="message-text"
      :style="{ fontSize: fontSize + 'px' }"
      v-html="highlightedText"
    ></div>

    <!-- Renders a brief thumbnail notation for collapsed OCR text -->
    <div
      v-else
      class="message-text screenshot-collapsed-placeholder"
      :style="{ fontSize: fontSize + 'px', fontStyle: 'italic', opacity: 0.85 }"
    >
      [Captured Screen Snapshot] 📸
    </div>

    <!-- Interactive toggle for long OCR content card -->
    <div v-if="isScreenshotCard" class="screenshot-toggle-container">
      <button
        class="btn-screenshot-toggle"
        @click="isCollapsed = !isCollapsed"
        type="button"
      >
        {{ isCollapsed ? 'See Context' : 'See Less' }}
      </button>
    </div>

    <div class="message-meta">
      <span
        class="message-label"
        :class="{
          'label-user': msg.isUser,
          'label-ai': msg.isAi,
          'label-error': msg.isError
        }"
      >
        {{ msg.label }}
      </span>
      <span>{{ msg.time }}</span>
      <button
        class="btn-delete-msg"
        @click="emit('delete', msg.id)"
        type="button"
      >
        ✕
      </button>
    </div>
  </div>
</template>
