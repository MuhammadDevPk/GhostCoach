import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '../AppHeader.vue';

describe('AppHeader.vue', () => {
  const defaultProps = {
    connectionState: 'connected',
    fontSize: 15,
    showChatInput: true,
    showSettings: false
  };

  it('renders title and status dot with correct status class', () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    expect(wrapper.find('.header-title').text()).toBe('Ghost Coach');
    expect(wrapper.find('.status-dot').classes()).toContain('connected');
  });

  it('reflects connecting state style', () => {
    const wrapper = mount(AppHeader, {
      props: {
        ...defaultProps,
        connectionState: 'connecting'
      }
    });

    expect(wrapper.find('.status-dot').classes()).toContain('connecting');
  });

  it('reflects disconnected state style', () => {
    const wrapper = mount(AppHeader, {
      props: {
        ...defaultProps,
        connectionState: 'disconnected'
      }
    });

    expect(wrapper.find('.status-dot').classes()).toContain('disconnected');
  });

  it('emits decrease-font and increase-font on click events', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    // Font buttons: A- is first button, A+ is second button
    const buttons = wrapper.findAll('.btn-icon');
    const decreaseBtn = buttons[0];
    const increaseBtn = buttons[1];

    await decreaseBtn.trigger('click');
    expect(wrapper.emitted('decrease-font')).toBeTruthy();

    await increaseBtn.trigger('click');
    expect(wrapper.emitted('increase-font')).toBeTruthy();
  });

  it('emits toggle-chat-input on chat icon click', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    // Chat toggle is the 3rd button
    const chatToggleBtn = wrapper.findAll('.btn-icon')[2];
    await chatToggleBtn.trigger('click');

    expect(wrapper.emitted('toggle-chat-input')).toBeTruthy();
  });

  it('emits toggle-settings on config icon click', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    // Config toggle is the 4th button
    const configToggleBtn = wrapper.findAll('.btn-icon')[3];
    await configToggleBtn.trigger('click');

    expect(wrapper.emitted('toggle-settings')).toBeTruthy();
  });

  it('emits minimize on click', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    // Minimize is the 5th button
    const minBtn = wrapper.findAll('.btn-icon')[4];
    await minBtn.trigger('click');

    expect(wrapper.emitted('minimize')).toBeTruthy();
  });

  it('emits close on click', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    // Close is the last close icon
    const closeBtn = wrapper.find('.btn-close');
    await closeBtn.trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
