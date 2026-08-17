<script setup>
const shortcuts = [
  {
    name: 'Show / Hide Overlay Window',
    keys: ['Cmd+H', 'Cmd+Shift+H']
  },
  {
    name: 'Toggle Microphone (Listen & Transcribe)',
    keys: ['Cmd+Shift+L']
  },
  {
    name: 'Microphone Auto-Send (Listen & Submit)',
    keys: ['Cmd+Shift+:', 'Cmd+Shift+;']
  },
  {
    name: 'Capture Entire Screen (AI Answer)',
    keys: ['Cmd+Shift+"', "Cmd+Shift+'"]
  },
  {
    name: 'Crop Selection Screenshot (Click 📸)',
    keys: ['Mouse Drag']
  },
  {
    name: 'Cancel Active AI Generation',
    keys: ['Cmd+Shift+C']
  },
  {
    name: 'Merge Session Responses (Combine Answers)',
    keys: ['Cmd+Shift+K']
  },
  {
    name: 'Record Interim Audio Checkpoint',
    keys: ['Cmd+Shift+P']
  }
];
</script>

<template>
  <div class="shortcuts-container">
    <div class="shortcuts-header">
      <h3>System-Wide Hotkeys</h3>
      <p>These global shortcuts can be triggered from any active window while Ghost Coach is running in the background.</p>
    </div>
    
    <div class="shortcuts-list">
      <div v-for="item in shortcuts" :key="item.name" class="shortcut-item">
        <span class="shortcut-name">{{ item.name }}</span>
        <div class="shortcut-keys">
          <span v-for="(key, index) in item.keys" :key="key" style="display: inline-flex; align-items: center;">
            <kbd class="shortcut-key">{{ key }}</kbd>
            <span v-if="index < item.keys.length - 1" class="key-separator">/</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 16px;
  text-align: left;
}

.shortcuts-header h3 {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: var(--text-main);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.shortcuts-header p {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.shortcut-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.shortcut-item:first-child {
  padding-top: 0;
}

.shortcut-name {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.shortcut-keys {
  display: flex;
  gap: 2px;
  align-items: center;
}

.shortcut-key {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: var(--text-main);
  font-size: 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 2px 6px;
  box-shadow: 0 1px 0px rgba(0, 0, 0, 0.3), inset 0 1px 0px rgba(255, 255, 255, 0.05);
  font-weight: 600;
  white-space: nowrap;
}

.key-separator {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0 4px;
  font-weight: 600;
}
</style>
