<script setup>
import { computed } from 'vue';

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
    class="message-card" 
    :class="{ 
      'is-latest': isLatest && !msg.isUser, 
      'is-user': msg.isUser, 
      'is-ai': msg.isAi, 
      'is-error': msg.isError 
    }"
  >
    <div 
      class="message-text" 
      :style="{ fontSize: fontSize + 'px' }" 
      v-html="highlightedText"
    ></div>
    
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
        title="Delete message from history"
        type="button"
      >
        ✕
      </button>
    </div>
  </div>
</template>
