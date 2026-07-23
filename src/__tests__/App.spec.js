import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

// Mock Electron window methods
global.window.electron = {
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn()
  }
};

// Mock voice service
vi.mock('../services/voice', () => ({
  startSpeechRecognition: vi.fn(),
  stopSpeechRecognition: vi.fn(),
  SpeechToText: class {
    constructor() {}
    start() {}
    stop() {}
  }
}));

// Mock AI service
vi.mock('../services/ai', () => ({
  sendChatMessage: vi.fn().mockResolvedValue({
    text: 'Mocked AI Answer',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30
    }
  })
}));

// Mock Echo & Pusher
vi.mock('laravel-echo', () => {
  return {
    default: class {
      constructor() {
        this.connector = {
          pusher: {
            connection: {
              bind: () => {}
            }
          }
        };
      }
      private() {
        return {
          listen: () => this
        };
      }
      channel() {
        return {
          listen: () => this
        };
      }
      disconnect() {}
    }
  };
});
vi.mock('pusher-js', () => {
  return {
    default: vi.fn()
  };
});

describe('App.vue Main Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with empty messages and history', () => {
    const wrapper = mount(App);
    
    // We expect the message feed to render empty state initially
    expect(wrapper.findComponent({ name: 'MessageFeed' }).props('messages')).toEqual([]);
  });

  it('can clear messages and chat history completely', async () => {
    const wrapper = mount(App);
    const vm = wrapper.vm;

    // Simulate pushing some test messages
    vm.messages.push({ id: '1', text: 'Prompt 1', time: '12:00', label: 'You', isUser: true });
    vm.chatHistory.push({ role: 'user', content: 'Prompt 1' });

    expect(vm.messages.length).toBe(1);
    expect(vm.chatHistory.length).toBe(1);

    // Call clear
    vm.clearMessages();

    expect(vm.messages.length).toBe(0);
    expect(vm.chatHistory.length).toBe(0);
  });

  it('deletes a single message and rebuilds chat history correctly', async () => {
    const wrapper = mount(App);
    const vm = wrapper.vm;

    // Push two user turns and their responses
    vm.messages.push(
      { id: 'u1', text: 'Question 1', time: '12:00', label: 'You', isUser: true },
      { id: 'a1', text: 'Answer 1', time: '12:01', label: 'AI Guide', isAi: true },
      { id: 'u2', text: 'Question 2', time: '12:02', label: 'You', isUser: true },
      { id: 'a2', text: 'Answer 2', time: '12:03', label: 'AI Guide', isAi: true }
    );

    vm.chatHistory.push(
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Answer 1' },
      { role: 'user', content: 'Question 2' },
      { role: 'assistant', content: 'Answer 2' }
    );

    expect(vm.messages.length).toBe(4);
    expect(vm.chatHistory.length).toBe(4);

    // Delete "Question 2"
    vm.deleteMessage('u2');

    // The messages array should contain only 3 items now
    expect(vm.messages.length).toBe(3);
    expect(vm.messages.map(m => m.id)).not.toContain('u2');

    // The chatHistory array should be rebuilt, excluding "Question 2"
    expect(vm.chatHistory.length).toBe(3);
    expect(vm.chatHistory).toEqual([
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Answer 1' },
      { role: 'assistant', content: 'Answer 2' }
    ]);
  });
});
