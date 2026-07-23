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
      v-html="decodedText"
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
