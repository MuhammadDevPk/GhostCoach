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
      model: 'openai/gpt-oss-120b',
      systemInstruction: 'Test instructions',
      history: [{ role: 'user', content: 'hello' }]
    });

    expect(result.text).toBe('Success response');
    expect(result.usage.totalTokens).toBe(15);
    // Verify fetch was called exactly twice
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails completely if all keys fail', async () => {
    // Use a 429 rate-limit style error — these are 'rotate' errors so each key is tried exactly once
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: 'Rate Limit Exceeded' } })
    });

    await expect(
      sendChatMessage({
        provider: 'groq',
        apiKey: ['bad_key_1', 'bad_key_2'],
        model: 'llaopenai/gpt-oss-120b',
        systemInstruction: 'Test instructions',
        history: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('All configured API keys for groq failed. Last error: Groq API Error: Rate Limit Exceeded');

    // Rate-limit errors rotate immediately (no same-key retry) — one call per key
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts immediately and does not rotate keys if aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const abortError = new DOMException('The user aborted a request.', 'AbortError');
    vi.mocked(fetch).mockRejectedValue(abortError);

    await expect(
      sendChatMessage({
        provider: 'groq',
        apiKey: ['key_1', 'key_2'],
        model: 'openai/gpt-oss-120b',
        systemInstruction: 'Test instructions',
        history: [{ role: 'user', content: 'hello' }],
        signal: controller.signal
      })
    ).rejects.toThrow('The user aborted a request.');

    // Fetch is only called once and then immediately aborts the process (no retries or rotation to key_2)
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
