<script setup>
import { ref, computed } from 'vue';
import { fetchRemoteQuestions } from '../services/profileSync';

const props = defineProps({
  questions: {
    type: Array,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  fontSize: {
    type: Number,
    default: 15
  }
});

const emit = defineEmits([
  'update-questions',
  'close'
]);

const searchQuery = ref('');
const expandedQuestionIds = ref(new Set());
const isSyncing = ref(false);
const syncStatus = ref({ text: '', isError: false });

// Live reactive matching on title/question
const filteredQuestions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.questions;
  return props.questions.filter(q => 
    (q.title || '').toLowerCase().includes(query) ||
    (q.description || '').toLowerCase().includes(query)
  );
});

function toggleQuestion(id) {
  if (expandedQuestionIds.value.has(id)) {
    expandedQuestionIds.value.delete(id);
  } else {
    expandedQuestionIds.value.add(id);
  }
}

function expandAll() {
  filteredQuestions.value.forEach(q => {
    expandedQuestionIds.value.add(q.id);
  });
}

function collapseAll() {
  expandedQuestionIds.value.clear();
}

async function triggerQuestionsSync() {
  isSyncing.value = true;
  syncStatus.value = { text: '', isError: false };

  try {
    const fetchedQuestions = await fetchRemoteQuestions(props.settings);
    if (!Array.isArray(fetchedQuestions) || fetchedQuestions.length === 0) {
      throw new Error('Server returned an empty or invalid questions array.');
    }
    
    // Assign numerical IDs if missing from server response
    const sanitizedQuestions = fetchedQuestions.map((q, index) => ({
      id: q.id || index + 1,
      title: q.title || q.question || 'Untitled Question',
      description: q.description || q.answer || 'No description provided.'
    }));

    emit('update-questions', sanitizedQuestions);
    syncStatus.value = { text: `Successfully synced ${sanitizedQuestions.length} questions from server.`, isError: false };
  } catch (err) {
    console.error('Failed to sync remote questions:', err);
    syncStatus.value = { text: `Sync Failed: ${err.message}`, isError: true };
  } finally {
    isSyncing.value = false;
  }
}
</script>

<template>
  <div class="settings-overlay questions-overlay-view">
    <!-- Header Section -->
    <div class="settings-header" style="align-items: center; justify-content: space-between;">
      <h3 class="settings-title">Interview Questions Database</h3>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button
          type="button"
          class="btn-sync-all"
          style="font-size: 11px; padding: 4px 10px; margin: 0; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; gap: 4px; border-radius: 6px; cursor: pointer;"
          :disabled="isSyncing"
          @click="triggerQuestionsSync"
          title="Fetch latest questions from remote server"
        >
          <span v-if="isSyncing" class="btn-spinner" style="width: 10px; height: 10px;"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          {{ isSyncing ? 'Syncing...' : 'Fetch Questions' }}
        </button>
        <button class="btn-icon btn-close-questions" @click="emit('close')" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Sync status banner -->
    <div v-if="syncStatus.text" style="padding: 8px 12px; border-radius: 6px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;" :style="{ background: syncStatus.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: syncStatus.isError ? '#ef4444' : '#10b981', border: syncStatus.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)' }">
      <span>{{ syncStatus.text }}</span>
      <button @click="syncStatus.text = ''" style="background: transparent; border: none; color: inherit; cursor: pointer; font-weight: bold;" type="button">✕</button>
    </div>

    <!-- Search bar and layout utilities -->
    <div class="search-utilities-wrapper">
      <div class="search-bar-container">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="question-search-input"
          placeholder="Search by title or description..."
        />
        <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''" type="button">✕</button>
      </div>
      
      <div class="bulk-action-buttons">
        <button @click="expandAll" class="btn-text-action" type="button">Expand All</button>
        <span class="action-divider">|</span>
        <button @click="collapseAll" class="btn-text-action" type="button">Collapse All</button>
      </div>
    </div>

    <!-- Questions Feed/Content Wrapper -->
    <div class="settings-form questions-list-scroll">
      <div v-if="filteredQuestions.length === 0" class="empty-search-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); opacity: 0.5; margin-bottom: 8px;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p>No questions matched your search query.</p>
      </div>
      
      <div v-else class="questions-accordion">
        <div 
          v-for="q in filteredQuestions" 
          :key="q.id" 
          class="question-card"
          :class="{ 'is-expanded': expandedQuestionIds.has(q.id) }"
        >
          <!-- Accordion Header (Question Title) -->
          <div class="question-card-header" @click="toggleQuestion(q.id)">
            <div class="question-title-section">
              <span class="badge-prefix">Q.</span>
              <h4 class="question-title" :style="{ fontSize: (fontSize - 1.5) + 'px' }">{{ q.title }}</h4>
            </div>
            <div class="toggle-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <!-- Accordion Content (Description) -->
          <div class="question-card-body">
            <div class="body-label">Description</div>
            <p class="question-description" :style="{ fontSize: (fontSize - 2.5) + 'px' }">{{ q.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.questions-overlay-view {
  display: flex;
  flex-direction: column;
}

.search-utilities-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.search-bar-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  opacity: 0.8;
  pointer-events: none;
}

.question-search-input {
  width: 100%;
  padding: 8px 32px 8px 30px;
  background: var(--bg-input, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  color: var(--text-main, #f1f5f9);
  font-size: 12px;
  outline: none;
  transition: all 0.2s ease;
}

.question-search-input:focus {
  border-color: var(--accent-color, #3b82f6);
  background: rgba(255, 255, 255, 0.07);
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}

.clear-search-btn:hover {
  color: var(--text-main);
}

.bulk-action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.btn-text-action {
  background: transparent;
  border: none;
  color: var(--accent-color, #3b82f6);
  cursor: pointer;
  padding: 2px 4px;
  font-weight: 500;
  transition: color 0.15s ease;
}

.btn-text-action:hover {
  color: var(--text-main);
  text-decoration: underline;
}

.action-divider {
  color: var(--border-color);
  opacity: 0.5;
}

.questions-list-scroll {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
}

.empty-search-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 12px;
}

.questions-accordion {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
}

.question-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.question-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
}

.question-card.is-expanded {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--accent-color, #3b82f6);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.question-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
}

.question-title-section {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex: 1;
  text-align: left;
}

.badge-prefix {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-color, #3b82f6);
  background: rgba(59, 130, 246, 0.15);
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1;
  margin-top: 2px;
}

.question-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-main, #f1f5f9);
  line-height: 1.4;
}

.toggle-indicator {
  color: var(--text-muted);
  opacity: 0.7;
  transition: transform 0.25s ease;
  margin-left: 10px;
  display: flex;
  align-items: center;
}

.question-card.is-expanded .toggle-indicator {
  transform: rotate(180deg);
  color: var(--accent-color);
  opacity: 1;
}

.question-card-body {
  max-height: 0;
  padding: 0 14px;
  opacity: 0;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
}

.question-card.is-expanded .question-card-body {
  max-height: 300px;
  padding: 4px 14px 14px 28px;
  opacity: 1;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.body-label {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.question-description {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
