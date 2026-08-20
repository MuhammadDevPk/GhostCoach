import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import QuestionsOverlay from '../QuestionsOverlay.vue';
import { fetchRemoteQuestions } from '../../services/profileSync';

vi.mock('../../services/profileSync', () => ({
  fetchRemoteQuestions: vi.fn()
}));

describe('QuestionsOverlay.vue', () => {
  const defaultQuestions = [
    { id: 1, title: 'What is Vue?', description: 'A progressive framework.' },
    { id: 2, title: 'What is Vuex?', description: 'State management pattern.' }
  ];

  const defaultProps = {
    questions: defaultQuestions,
    settings: { host: 'localhost', scheme: 'http', port: '8080' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and filters questions via search bar', async () => {
    const wrapper = mount(QuestionsOverlay, {
      props: defaultProps
    });

    expect(wrapper.find('.settings-title').text()).toBe('Interview Questions Database');
    expect(wrapper.findAll('.question-card').length).toBe(2);

    // Type in search bar to match "Vuex"
    const searchInput = wrapper.find('.question-search-input');
    await searchInput.setValue('Vuex');

    // Only one question card should match
    expect(wrapper.findAll('.question-card').length).toBe(1);
    expect(wrapper.find('.question-title').text()).toBe('What is Vuex?');
  });

  it('toggles expansion of question descriptions when headers are clicked', async () => {
    const wrapper = mount(QuestionsOverlay, {
      props: defaultProps
    });

    const cardHeader = wrapper.find('.question-card-header');
    const card = wrapper.find('.question-card');

    // Initially description height is collapsed (not expanded)
    expect(card.classes()).not.toContain('is-expanded');

    // Click header
    await cardHeader.trigger('click');
    expect(card.classes()).toContain('is-expanded');

    // Click header again
    await cardHeader.trigger('click');
    expect(card.classes()).not.toContain('is-expanded');
  });

  it('triggers questions remote sync and emits update-questions on success', async () => {
    const mockSyncedQuestions = [
      { id: 1, title: 'New Question 1', description: 'Updated Answer 1' }
    ];
    vi.mocked(fetchRemoteQuestions).mockResolvedValueOnce(mockSyncedQuestions);

    const wrapper = mount(QuestionsOverlay, {
      props: defaultProps
    });

    const syncBtn = wrapper.find('.btn-sync-all');
    await syncBtn.trigger('click');

    expect(fetchRemoteQuestions).toHaveBeenCalledWith(defaultProps.settings);
    
    // Wait for the async sync block to resolve
    await vi.waitFor(() => {
      const updateEmitted = wrapper.emitted('update-questions');
      expect(updateEmitted).toBeTruthy();
      expect(updateEmitted[0][0]).toEqual(mockSyncedQuestions);
    });

    expect(wrapper.find('div[style*="rgba(16, 185, 129"]').text()).toContain('Successfully synced 1 questions');
  });

  it('allows adding a custom question', async () => {
    const wrapper = mount(QuestionsOverlay, {
      props: defaultProps
    });

    // Initially form is hidden
    expect(wrapper.find('.crud-form-card').exists()).toBe(false);

    // Click Add Custom Question
    const addBtn = wrapper.find('.crud-header-actions button');
    await addBtn.trigger('click');

    expect(wrapper.find('.crud-form-card').exists()).toBe(true);

    // Fill inputs
    const inputs = wrapper.findAll('.crud-form-card .question-search-input');
    await inputs[0].setValue('New Query?');
    await inputs[1].setValue('Answer description goes here.');

    // Save
    const saveBtn = wrapper.find('.crud-form-card .btn-sync-all');
    await saveBtn.trigger('click');

    const updateEmitted = wrapper.emitted('update-questions');
    expect(updateEmitted).toBeTruthy();
    expect(updateEmitted[0][0].length).toBe(3);
    expect(updateEmitted[0][0][2].title).toBe('New Query?');
  });

  it('allows editing a custom question', async () => {
    const wrapper = mount(QuestionsOverlay, {
      props: defaultProps
    });

    // Expand the first card to see Edit button
    await wrapper.find('.question-card-header').trigger('click');

    const editBtn = wrapper.find('.question-card-body .btn-text-action');
    await editBtn.trigger('click');

    // Should render edit view card
    expect(wrapper.find('.edit-mode-card').exists()).toBe(true);

    const editTitleInput = wrapper.find('.edit-mode-card input');
    await editTitleInput.setValue('Updated Vue?');

    const saveChangesBtn = wrapper.find('.edit-mode-card .btn-sync-all');
    await saveChangesBtn.trigger('click');

    const updateEmitted = wrapper.emitted('update-questions');
    expect(updateEmitted).toBeTruthy();
    expect(updateEmitted[0][0][0].title).toBe('Updated Vue?');
  });

  it('allows deleting a custom question', async () => {
    window.confirm = vi.fn().mockReturnValueOnce(true);

    const wrapper = mount(QuestionsOverlay, {
      props: defaultProps
    });

    // Expand the first card to see Delete button
    await wrapper.find('.question-card-header').trigger('click');

    const deleteBtn = wrapper.findAll('.question-card-body .btn-text-action')[1];
    await deleteBtn.trigger('click');

    expect(window.confirm).toHaveBeenCalled();
    const updateEmitted = wrapper.emitted('update-questions');
    expect(updateEmitted).toBeTruthy();
    expect(updateEmitted[0][0].length).toBe(1); // 2 original, 1 deleted
  });
});
