<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';

const props = defineProps({
  text: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close', 'progress']);

const isPlaying = ref(true);
const speed = ref(1.5); // scroll speed (pixels per frame)
const fontSize = ref(28); // font size in px
const containerRef = ref(null);
const textRef = ref(null);

const scrollPosition = ref(0);
const bgColor = ref('#191922');
const bgOpacity = ref(0.95);
const localText = ref(props.text);
let animationFrameId = null;
// Frame counter: throttle progress IPC sends to ~8fps instead of 60fps
let _progressFrameCount = 0;

// Initialize scroll position when text changes; restart animation if it was stopped by auto-close
watch(() => props.text, (newVal) => {
  localText.value = newVal;
  resetScroll();
  isPlaying.value = true; // ensure we're not left in paused state from previous run
  _progressFrameCount = 0;
  if (!animationFrameId) {
    // Loop was stopped by auto-close — restart it for the new text
    animationFrameId = requestAnimationFrame(animate);
  }
}, { immediate: true });

function resetScroll() {
  if (containerRef.value) {
    // Start text off-screen to the right
    scrollPosition.value = containerRef.value.clientWidth;
  } else {
    scrollPosition.value = 400; // fallback
  }
}

function animate() {
  if (isPlaying.value && textRef.value && containerRef.value) {
    scrollPosition.value -= speed.value;
    
    // Auto-close when text fully scrolls off-screen to the left
    const textWidth = textRef.value.clientWidth;
    if (scrollPosition.value < -textWidth) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      emitProgress(null); // clear app highlight
      emit('close');
      return;
    }

    // Emit progress to app every 8 frames (~7.5fps) — enough for smooth highlight tracking
    _progressFrameCount++;
    if (_progressFrameCount % 8 === 0) {
      emitProgress(computeHighlightRange());
    }
  }
  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Compute which character range of localText is currently visible
 * in the center 500px window of the teleprompter banner.
 * Uses linear character distribution as a fast approximation.
 */
function computeHighlightRange() {
  if (!textRef.value || !containerRef.value || !localText.value) return null;
  const containerWidth = containerRef.value.clientWidth;
  const textWidth = textRef.value.clientWidth;
  const totalChars = localText.value.length;
  if (totalChars === 0 || textWidth === 0) return null;

  const CENTER_WINDOW_PX = 500;
  const centerLeft = (containerWidth - CENTER_WINDOW_PX) / 2;
  const centerRight = centerLeft + CENTER_WINDOW_PX;

  // Each character i is roughly at: scrollPosition + (i / totalChars) * textWidth
  const startIndex = Math.max(0,
    Math.floor(((centerLeft - scrollPosition.value) / textWidth) * totalChars)
  );
  const endIndex = Math.min(totalChars,
    Math.ceil(((centerRight - scrollPosition.value) / textWidth) * totalChars)
  );

  if (startIndex >= endIndex) return null;
  return { text: localText.value, startIndex, endIndex };
}

/**
 * Send highlight progress to the main app window.
 * Works in both in-app overlay mode (Vue emit) and Electron separate-window mode (IPC).
 */
function emitProgress(progress) {
  emit('progress', progress);
  if (window.electronAPI && typeof window.electronAPI.sendTeleprompterProgress === 'function') {
    window.electronAPI.sendTeleprompterProgress(progress);
  }
}

onMounted(() => {
  resetScroll();
  animationFrameId = requestAnimationFrame(animate);

  const savedSettings = localStorage.getItem('reverb_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      bgColor.value = parsed.teleprompterBgColor || '#191922';
      bgOpacity.value = parsed.teleprompterBgOpacity !== undefined ? parsed.teleprompterBgOpacity : 0.95;
    } catch (e) {
      console.error('Failed to parse settings for teleprompter background styling', e);
    }
  }

  // Bind IPC load event for external window loading
  if (window.electronAPI && typeof window.electronAPI.onLoadTeleprompter === 'function') {
    window.electronAPI.onLoadTeleprompter((loadedText) => {
      localText.value = loadedText;
      resetScroll();
      isPlaying.value = true;
      _progressFrameCount = 0;
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(animate);
      }
    });
  }
  
  // Listen for Escape / Arrow keys locally
  window.addEventListener('keydown', handleKeyDown, true);

  // Sync background color changes in real-time from settings
  window.addEventListener('storage', handleStorageChange);
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  emitProgress(null); // clear app highlight on unmount
  window.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('storage', handleStorageChange);
});

function handleStorageChange(e) {
  if (e.key === 'reverb_settings' && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue);
      bgColor.value = parsed.teleprompterBgColor || '#191922';
      bgOpacity.value = parsed.teleprompterBgOpacity !== undefined ? parsed.teleprompterBgOpacity : 0.95;
    } catch (err) {
      console.error('Failed to parse storage update for teleprompter background styling', err);
    }
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close');
    return;
  }
  // Arrow keys manually seek through text (pause is not required)
  const SEEK_PX = 120; // ~1 word width
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    // Seeking backward = move text to the right (increase scrollPosition)
    if (textRef.value && containerRef.value) {
      const maxBack = containerRef.value.clientWidth; // can't go past start
      scrollPosition.value = Math.min(scrollPosition.value + SEEK_PX, maxBack);
      emitProgress(computeHighlightRange());
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    // Seeking forward = move text to the left (decrease scrollPosition)
    if (textRef.value) {
      const minForward = -textRef.value.clientWidth;
      scrollPosition.value = Math.max(scrollPosition.value - SEEK_PX, minForward);
      emitProgress(computeHighlightRange());
    }
  }
}

/**
 * Mouse wheel handler — allows horizontal scrolling through the teleprompter text.
 * Bound via @wheel.prevent on the banner container (native scroll is suppressed).
 * Prefers horizontal deltaX (trackpad two-finger swipe), falls back to vertical deltaY.
 */
function handleWheel(e) {
  const WHEEL_SENSITIVITY = 2.5; // pixels moved per wheel delta unit
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  scrollPosition.value -= delta * WHEEL_SENSITIVITY;

  // Clamp to valid range so you can't scroll past start or end
  if (textRef.value && containerRef.value) {
    const maxRight = containerRef.value.clientWidth; // fully off-screen right
    const maxLeft = -textRef.value.clientWidth;      // fully off-screen left
    scrollPosition.value = Math.max(maxLeft, Math.min(maxRight, scrollPosition.value));
  }

  // Immediately emit updated progress on wheel interaction
  emitProgress(computeHighlightRange());
}


function togglePlay() {
  isPlaying.value = !isPlaying.value;
}

// Ensure speed limits are safely clamped to avoid infinite loops or crazy speeds
function increaseSpeed() {
  if (speed.value < 6) {
    speed.value = parseFloat((speed.value + 0.25).toFixed(2));
  }
}

function decreaseSpeed() {
  if (speed.value > 0.25) {
    speed.value = parseFloat((speed.value - 0.25).toFixed(2));
  }
}

function increaseFont() {
  if (fontSize.value < 60) {
    fontSize.value += 2;
  }
}

function decreaseFont() {
  if (fontSize.value > 16) {
    fontSize.value -= 2;
  }
}

// Calculate remaining reading time
const timeRemaining = computed(() => {
  if (!textRef.value || !containerRef.value) return '00:00';
  const textWidth = textRef.value.clientWidth;
  const remainingPixels = scrollPosition.value + textWidth;
  if (remainingPixels <= 0) return '00:00';
  
  // Assuming 60 frames per second
  const framesLeft = remainingPixels / speed.value;
  const secondsLeft = Math.ceil(framesLeft / 60);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

</script>

<template>
  <div class="teleprompter-overlay">
    <div class="teleprompter-bg-overlay" :style="{ backgroundColor: bgColor, opacity: bgOpacity }"></div>
    <div
      class="teleprompter-banner"
      ref="containerRef"
      @wheel.prevent="handleWheel"
    >
      <div 
        class="teleprompter-text" 
        ref="textRef"
        :style="{ 
          transform: `translateX(${scrollPosition}px)`, 
          fontSize: `${fontSize}px` 
        }"
      >
        {{ localText }}
      </div>
    </div>
    
    <div class="teleprompter-toolbar">
      <div class="toolbar-section time-indicator">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>{{ timeRemaining }} left</span>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-section controls">
        <button class="btn-tool" @click="resetScroll" title="Restart Scroll">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0-.57-8.38l5.67-5.67"></path>
          </svg>
        </button>

        <button class="btn-tool btn-play" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
          <svg v-if="isPlaying" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-section sizing">
        <button class="btn-tool" @click="decreaseFont" title="Decrease Font">A-</button>
        <span class="value-display">{{ fontSize }}px</span>
        <button class="btn-tool" @click="increaseFont" title="Increase Font">A+</button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-section speed">
        <button class="btn-tool" @click="decreaseSpeed" title="Decrease Speed">S-</button>
        <span class="value-display">{{ speed }}x</span>
        <button class="btn-tool" @click="increaseSpeed" title="Increase Speed">S+</button>
      </div>

      <div class="toolbar-divider"></div>

      <button class="btn-tool btn-close-tool" @click="$emit('close')" title="Close (Esc)">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>
