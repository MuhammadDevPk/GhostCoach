import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '../AppHeader.vue';

describe('AppHeader.vue', () => {
  const defaultProps = {
    connectionState: 'connected',
    fontSize: 15,
    showChatInput: true,
    showSettings: false,
    teleprompterEnabled: false,
    wsEnabled: true
  };

  it('renders title and status dot with correct status class', () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    expect(wrapper.find('.header-title').text()).toBe('Ghost Coach');
    expect(wrapper.find('.status-dot').classes()).toContain('connected');
  });

  it('emits toggle-ws when WebSocket Start/End button is clicked', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    const wsToggleBtn = wrapper.find('.btn-ws-toggle');
    expect(wsToggleBtn.text()).toContain('End WS');

    await wsToggleBtn.trigger('click');
    expect(wrapper.emitted('toggle-ws')).toBeTruthy();
  });

  it('displays Start WS label when wsEnabled is false', () => {
    const wrapper = mount(AppHeader, {
      props: {
        ...defaultProps,
        wsEnabled: false
      }
    });

    const wsToggleBtn = wrapper.find('.btn-ws-toggle');
    expect(wsToggleBtn.text()).toContain('Start WS');
    expect(wsToggleBtn.classes()).toContain('is-stopped');
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

    // Config toggle is now the 5th button (teleprompter button added at index 3)
    const configToggleBtn = wrapper.findAll('.btn-icon')[4];
    await configToggleBtn.trigger('click');

    expect(wrapper.emitted('toggle-settings')).toBeTruthy();
  });

  it('emits minimize on click', async () => {
    const wrapper = mount(AppHeader, {
      props: defaultProps
    });

    // Minimize is now the 6th button (teleprompter button added at index 3)
    const minBtn = wrapper.findAll('.btn-icon')[5];
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

