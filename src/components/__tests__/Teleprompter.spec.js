import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Teleprompter from '../Teleprompter.vue';

// Mock requestAnimationFrame and cancelAnimationFrame
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockImplementation(cb => setTimeout(cb, 16)));
  vi.stubGlobal('cancelAnimationFrame', vi.fn().mockImplementation(id => clearTimeout(id)));
});

describe('Teleprompter.vue', () => {
  const defaultText = 'This is a test prompt for the scrolling teleprompter.';

  it('renders and displays correct text', () => {
    const wrapper = mount(Teleprompter, {
      props: { text: defaultText }
    });

    expect(wrapper.find('.teleprompter-text').text()).toBe(defaultText);
    expect(wrapper.find('.time-indicator').exists()).toBe(true);
  });

  it('toggles play/pause state when play button is clicked', async () => {
    const wrapper = mount(Teleprompter, {
      props: { text: defaultText }
    });

    const playBtn = wrapper.find('.btn-play');
    expect(playBtn.exists()).toBe(true);

    // Initial state is playing
    expect(wrapper.find('.btn-play svg rect').exists()).toBe(true); // Pause bar icon shown

    // Click pause
    await playBtn.trigger('click');
    expect(wrapper.find('.btn-play svg polygon').exists()).toBe(true); // Play triangle icon shown

    // Click play again
    await playBtn.trigger('click');
    expect(wrapper.find('.btn-play svg rect').exists()).toBe(true);
  });

  it('increases and decreases font size on button click', async () => {
    const wrapper = mount(Teleprompter, {
      props: { text: defaultText }
    });

    const display = wrapper.find('.sizing .value-display');
    expect(display.text()).toBe('28px');

    const increaseBtn = wrapper.findAll('.sizing .btn-tool')[1]; // second button is A+
    const decreaseBtn = wrapper.findAll('.sizing .btn-tool')[0]; // first button is A-

    await increaseBtn.trigger('click');
    expect(display.text()).toBe('30px');

    await decreaseBtn.trigger('click');
    await decreaseBtn.trigger('click');
    expect(display.text()).toBe('26px');
  });

  it('increases and decreases speed on button click', async () => {
    const wrapper = mount(Teleprompter, {
      props: { text: defaultText }
    });

    const display = wrapper.find('.speed .value-display');
    expect(display.text()).toBe('1.5x');

    const increaseBtn = wrapper.findAll('.speed .btn-tool')[1]; // S+
    const decreaseBtn = wrapper.findAll('.speed .btn-tool')[0]; // S-

    await increaseBtn.trigger('click');
    expect(display.text()).toBe('1.75x');

    await decreaseBtn.trigger('click');
    await decreaseBtn.trigger('click');
    expect(display.text()).toBe('1.25x');
  });

  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(Teleprompter, {
      props: { text: defaultText }
    });

    const closeBtn = wrapper.find('.btn-close-tool');
    await closeBtn.trigger('click');

    expect(wrapper.emitted().close).toBeTruthy();
  });

  it('emits close event when Escape key is pressed', async () => {
    const wrapper = mount(Teleprompter, {
      props: { text: defaultText },
      attachTo: document.body // Attach to body to capture window listeners
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(wrapper.emitted().close).toBeTruthy();
    wrapper.unmount();
  });
});
