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
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggle-mic', 'submit']);

const handleSubmit = () => {
  if (modelValue.value.trim() && !props.isLoading) {
    emit('submit');
  }
};
</script>

<template>
  <footer class="chat-input-bar">
    <!-- Microphone Button -->
    <button 
      class="btn-icon btn-mic" 
      :class="{ 'recording': isMicListening }" 
      @click="$emit('toggle-mic')" 
      :title="isMicListening ? 'Stop Voice Detection' : 'Start Voice Detection'"
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    </button>

    <textarea
      v-model="modelValue"
      placeholder="Ask AI Coach or speak..."
      @keydown.enter.exact.prevent="$emit('submit')"
      rows="1"
    ></textarea>
    
    <button 
      class="btn-send" 
      @click="$emit('submit')" 
      :disabled="isLoading || !modelValue.trim()" 
      title="Send Question"
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
