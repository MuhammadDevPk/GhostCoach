import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MessageCard from '../MessageCard.vue';

describe('MessageCard.vue', () => {
  const defaultMsg = {
    id: 'test-1',
    text: 'Hello World',
    time: '12:00:00 PM',
    label: 'Remote Broadcast'
  };

  it('renders standard message content and labels correctly', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: defaultMsg,
        fontSize: 15,
        isLatest: false
      }
    });

    expect(wrapper.find('.message-text').text()).toBe('Hello World');
    expect(wrapper.find('.message-label').text()).toBe('Remote Broadcast');
    expect(wrapper.find('.message-meta span:nth-of-type(2)').text()).toBe('12:00:00 PM');
  });

  it('applies correct CSS class for user messages', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: { ...defaultMsg, isUser: true, label: 'You' },
        fontSize: 15,
        isLatest: false
      }
    });

    expect(wrapper.classes()).toContain('is-user');
    expect(wrapper.find('.message-label').classes()).toContain('label-user');
  });

  it('applies correct CSS class for AI messages', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: { ...defaultMsg, isAi: true, label: 'AI Guide' },
        fontSize: 15,
        isLatest: false
      }
    });

    expect(wrapper.classes()).toContain('is-ai');
    expect(wrapper.find('.message-label').classes()).toContain('label-ai');
  });

  it('applies correct CSS class for error messages', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: { ...defaultMsg, isError: true, label: 'AI Error' },
        fontSize: 15,
        isLatest: false
      }
    });

    expect(wrapper.classes()).toContain('is-error');
    expect(wrapper.find('.message-label').classes()).toContain('label-error');
  });

  it('applies is-latest class for latest broadcast message', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: defaultMsg,
        fontSize: 15,
        isLatest: true
      }
    });

    expect(wrapper.classes()).toContain('is-latest');
  });

  it('does not apply is-latest class if latest message is a user message', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: { ...defaultMsg, isUser: true },
        fontSize: 15,
        isLatest: true
      }
    });

    expect(wrapper.classes()).not.toContain('is-latest');
  });

  it('decodes HTML entities in message text', () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: { ...defaultMsg, text: 'Hello &amp; Welcome' },
        fontSize: 15,
        isLatest: false
      }
    });

    // v-html renders innerHTML so we check the element text
    expect(wrapper.find('.message-text').text()).toBe('Hello & Welcome');
  });

  it('emits delete event with message id when delete button is clicked', async () => {
    const wrapper = mount(MessageCard, {
      props: {
        msg: defaultMsg,
        fontSize: 15,
        isLatest: false
      }
    });

    await wrapper.find('.btn-delete-msg').trigger('click');
    expect(wrapper.emitted().delete).toBeTruthy();
    expect(wrapper.emitted().delete[0]).toEqual([defaultMsg.id]);
  });
});
