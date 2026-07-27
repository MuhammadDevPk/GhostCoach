import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatMessage } from '../ai';

describe('ai.js key rotation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('rotates to next key on failure and succeeds', async () => {
    // First fetch call fails, second succeeds
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Rate Limit Exceeded' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        })
      });

    const result = await sendChatMessage({
      provider: 'groq',
      apiKey: ['invalid_key', 'valid_key'],
      model: 'llama-3.3-70b-versatile',
      systemInstruction: 'Test instructions',
      history: [{ role: 'user', content: 'hello' }]
    });

    expect(result.text).toBe('Success response');
    expect(result.usage.totalTokens).toBe(15);
    // Verify fetch was called exactly twice
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails completely if all keys fail', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API Key' } })
    });

    await expect(
      sendChatMessage({
        provider: 'groq',
        apiKey: ['bad_key_1', 'bad_key_2'],
        model: 'llama-3.3-70b-versatile',
        systemInstruction: 'Test instructions',
        history: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('All configured API keys for groq failed. Last error: Groq API Error: Invalid API Key');

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
