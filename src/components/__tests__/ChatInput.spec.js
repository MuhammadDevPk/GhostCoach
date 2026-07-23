import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatInput from '../ChatInput.vue';

describe('ChatInput.vue', () => {
  it('binds modelValue via two-way communication and updates correctly', async () => {
    const wrapper = mount(ChatInput, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': (e) => wrapper.setProps({ modelValue: e }),
        isMicListening: false,
        isLoading: false
      }
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Hello AI Coach');

    expect(wrapper.props('modelValue')).toBe('Hello AI Coach');
  });

  it('emits toggle-mic when mic button is clicked', async () => {
    const wrapper = mount(ChatInput, {
      props: {
        modelValue: '',
        isMicListening: false,
        isLoading: false
      }
    });

    const micBtn = wrapper.find('.btn-mic');
    await micBtn.trigger('click');

    expect(wrapper.emitted('toggle-mic')).toBeTruthy();
  });

  it('applies recording class to mic button when active', () => {
    const wrapper = mount(ChatInput, {
      props: {
        modelValue: '',
        isMicListening: true,
        isLoading: false
      }
    });

    const micBtn = wrapper.find('.btn-mic');
    expect(micBtn.classes()).toContain('recording');
  });

  it('emits submit when enter key is pressed inside textarea', async () => {
    const wrapper = mount(ChatInput, {
      props: {
        modelValue: 'Some question',
        isMicListening: false,
        isLoading: false
      }
    });

    const textarea = wrapper.find('textarea');
    await textarea.trigger('keydown.enter');

    expect(wrapper.emitted('submit')).toBeTruthy();
  });

  it('disables the send button when input is empty or loading', async () => {
    // Case 1: Empty input
    let wrapper = mount(ChatInput, {
      props: {
        modelValue: '   ',
        isMicListening: false,
        isLoading: false
      }
    });
    expect(wrapper.find('.btn-send').element.disabled).toBe(true);

    // Case 2: Loading active
    wrapper = mount(ChatInput, {
      props: {
        modelValue: 'Valid query',
        isMicListening: false,
        isLoading: true
      }
    });
    expect(wrapper.find('.btn-send').element.disabled).toBe(true);
  });
});
