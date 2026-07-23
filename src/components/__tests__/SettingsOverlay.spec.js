import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsOverlay from '../SettingsOverlay.vue';

// Mock the fileParser to avoid JSDOM global issues during component mount
vi.mock('../../services/fileParser', () => {
  return {
    parseResumeFile: vi.fn().mockResolvedValue('Mock resume content')
  };
});

describe('SettingsOverlay.vue', () => {
  const defaultProps = {
    settings: {
      host: 'localhost',
      port: '80',
      appKey: 'key',
      scheme: 'http',
      channel: 'test',
      event: 'event'
    },
    aiSettings: {
      provider: 'gemini',
      geminiKey: 'key',
      geminiModel: 'gemini-2.5-flash',
      systemInstruction: 'default instructions',
      persona: 'default persona',
      resumeText: 'default resume text',
      resumeFileName: 'resume.txt'
    },
    activeMode: 'both',
    messagesCount: 0
  };

  it('renders correctly and switches tabs when clicked', async () => {
    const wrapper = mount(SettingsOverlay, {
      props: defaultProps
    });

    // Check title
    expect(wrapper.find('.settings-title').text()).toBe('Ghost Coach Config');

    // Default active tab should be websocket, so look for Host Domain input
    expect(wrapper.find('input[type="text"]').element.value).toBe('localhost');

    // Click on AI Guidance tab (2nd button)
    const tabButtons = wrapper.findAll('.tab-btn');
    await tabButtons[1].trigger('click');

    // Now input fields should be AI config fields (e.g. select dropdown)
    expect(wrapper.find('.form-select').element.value).toBe('both');

    // Click on Candidate Profile tab (3rd button)
    await tabButtons[2].trigger('click');

    // Textarea should have candidate persona value
    expect(wrapper.find('.form-textarea').element.value).toBe('default persona');
  });

  it('emits save event with modified payload on save click', async () => {
    const wrapper = mount(SettingsOverlay, {
      props: defaultProps
    });

    // Change Host input field
    const hostInput = wrapper.find('input[type="text"]');
    await hostInput.setValue('new-host.com');

    // Switch to Candidate Profile tab and change persona text
    await wrapper.findAll('.tab-btn')[2].trigger('click');
    const personaTextarea = wrapper.find('.form-textarea');
    await personaTextarea.setValue('Imran - Senior Dev');

    // Trigger save (ensure we click the button, not a class-matched label)
    const saveBtn = wrapper.find('button.btn-primary');
    await saveBtn.trigger('click');

    // Assert event was emitted
    const saveEmitted = wrapper.emitted('save');
    expect(saveEmitted).toBeTruthy();
    expect(saveEmitted[0][0].settings.host).toBe('new-host.com');
    expect(saveEmitted[0][0].aiSettings.persona).toBe('Imran - Senior Dev');
  });

  it('emits reset-to-defaults on button click', async () => {
    const wrapper = mount(SettingsOverlay, {
      props: defaultProps
    });

    // Find Reset button specifically using button tags
    const resetBtn = wrapper.findAll('button.btn-primary')[1];
    await resetBtn.trigger('click');

    expect(wrapper.emitted('reset-to-defaults')).toBeTruthy();
  });

  it('emits clear-messages only if messageCount > 0 and clear button is clicked', async () => {
    // Case 1: messagesCount is 0, clear button should not render
    let wrapper = mount(SettingsOverlay, {
      props: defaultProps
    });
    expect(wrapper.find('button[style*="background: rgba(239, 68, 68"]').exists()).toBe(false);

    // Case 2: messagesCount is 5
    wrapper = mount(SettingsOverlay, {
      props: {
        ...defaultProps,
        messagesCount: 5
      }
    });

    const clearBtn = wrapper.findAll('button.btn-primary')[2];
    await clearBtn.trigger('click');

    expect(wrapper.emitted('clear-messages')).toBeTruthy();
  });
});
