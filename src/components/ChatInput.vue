<script setup>
const modelValue = defineModel({
  type: String,
  default: ''
});

const props = defineProps({
  isMicListening: {
    type: Boolean,
    default: false
  },
  isMicAutoSending: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggle-mic', 'toggle-mic-autosend', 'submit', 'cancel']);

const handleSubmit = () => {
  if (modelValue.value.trim() && !props.isLoading) {
    emit('submit');
  }
};

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
</script>

<template>
  <footer class="chat-input-bar">
    <!-- Standard Microphone Button (Review Before Send) -->
    <button
      class="btn-icon btn-mic"
      :class="{ 'recording': isMicListening && !isMicAutoSending }"
      @click="$emit('toggle-mic')"
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    </button>

    <!-- Combined Mic + Send Button (Record, Transcribe & Auto-Send) -->
    <button
      class="btn-icon btn-mic-autosend"
      :class="{ 'recording': isMicAutoSending }"
      @click="$emit('toggle-mic-autosend')"
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Microphone -->
        <path d="M9 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
        <path d="M15 10v1a6 6 0 0 1-12 0v-1"></path>
        <line x1="9" y1="17" x2="9" y2="21"></line>
        <!-- Fast Send Arrow -->
        <path d="M16 4l5 4-5 4"></path>
        <line x1="21" y1="8" x2="14" y2="8"></line>
      </svg>
    </button>

    <!-- Cancel Request Button -->
    <button
      v-if="isLoading || isMicListening"
      class="btn-icon btn-cancel"
      @click="$emit('cancel')"
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <textarea
      v-model="modelValue"
      v-auto-resize
      placeholder="Ask AI Coach or speak..."
      @keydown.enter.exact.prevent="handleSubmit"
      rows="1"
    ></textarea>

    <button
      class="btn-send"
      @click="$emit('submit')"
      :disabled="isLoading || !modelValue.trim()"
      type="button"
    >
      <svg v-if="!isLoading" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
      <span v-else class="btn-spinner"></span>
    </button>
  </footer>
</template>