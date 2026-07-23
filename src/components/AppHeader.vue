<script setup>
defineProps({
  connectionState: {
    type: String,
    required: true,
    validator: (value) => ['connected', 'connecting', 'disconnected'].includes(value)
  },
  fontSize: {
    type: Number,
    required: true
  },
  showChatInput: {
    type: Boolean,
    required: true
  },
  showSettings: {
    type: Boolean,
    required: true
  }
});

defineEmits([
  'decrease-font',
  'increase-font',
  'toggle-chat-input',
  'toggle-settings',
  'minimize',
  'close'
]);
</script>

<template>
  <!-- Header with window dragging support & status -->
  <header class="app-header">
    <div class="header-left">
      <span
        class="status-dot"
        :class="{
          'connected': connectionState === 'connected',
          'connecting': connectionState === 'connecting',
          'disconnected': connectionState === 'disconnected'
        }"
        :title="'Status: ' + connectionState"
      ></span>
      <span class="header-title">Ghost Coach</span>
    </div>

    <!-- Custom window controls -->
    <div class="header-controls">
      <button 
        class="btn-icon" 
        @click="$emit('decrease-font')" 
        title="Decrease font size" 
        style="font-size: 10px; font-weight: bold; width: 20px;"
      >
        A-
      </button>
      <span style="font-size: 11px; color: var(--text-muted); min-width: 14px; text-align: center;">
        {{ fontSize }}
      </span>
      <button 
        class="btn-icon" 
        @click="$emit('increase-font')" 
        title="Increase font size" 
        style="font-size: 11px; font-weight: bold; width: 20px;"
      >
        A+
      </button>
      
      <div style="width: 1px; height: 14px; background: var(--border-color); margin: 0 2px;"></div>

      <!-- Chat Input Toggle Button -->
      <button 
        class="btn-icon" 
        :class="{ 'active': showChatInput }" 
        @click="$emit('toggle-chat-input')" 
        title="Toggle AI Chat Input"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      <button 
        class="btn-icon" 
        :class="{ 'active': showSettings }"
        @click="$emit('toggle-settings')" 
        title="Configure App Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <button class="btn-icon" @click="$emit('minimize')" title="Minimize Window">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <button class="btn-icon btn-close" @click="$emit('close')" title="Quit App">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </header>
</template>
