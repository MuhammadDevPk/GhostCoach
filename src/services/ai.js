/**
 * Service to communicate with various AI Providers (Groq, Gemini, OpenRouter, GitHub Models)
 */

// Remember the last successful API key index for each provider so that subsequent calls
// start from the active/working key instead of resetting to index 0. This implements
// circular round-robin rotation, preventing Key 1 from getting hammered repeatedly.
const providerKeyOffsets = {
  gemini: 0,
  groq: 0,
  openrouter: 0,
  github: 0
};

/**
 * Sends a message to the configured AI provider and returns the response.
 * @param {Object} params
 * @param {string} params.provider - 'groq' | 'gemini' | 'openrouter' | 'github'
 * @param {string} params.apiKey - The API key for the chosen provider
 * @param {string} params.model - The model identifier
 * @param {string} params.systemInstruction - The training/system prompt instruction
 * @param {Array<{role: string, content: string}>} params.history - The conversation history
 * @param {AbortSignal} [params.signal] - Optional signal to abort the request
 * @returns {Promise<string>} The response text from the AI
 */
export async function sendChatMessage({ provider, apiKey, model, systemInstruction, history, persona, resumeText, skipHumanizerReminder, screenshotBase64, signal }) {
  // Normalize apiKey parameter to a list of non-empty strings
  const keys = (Array.isArray(apiKey) ? apiKey : [apiKey])
    .map(k => typeof k === 'string' ? k.trim() : '')
    .filter(k => k !== '');

  if (keys.length === 0) {
    throw new Error(`API Key is required to call the AI provider "${provider}". Please configure it in Settings.`);
  }

  // Compile the "Super Prompt" combining the base instructions, candidate profile, and strict humanizer rules
  const baseInstructions = systemInstruction || 'You are the candidate in a live spoken interview. Answer as yourself — a real human being. Be direct, specific, and conversational. Do not write like an AI assistant.';

  // STRATEGY: Identity-first persona injection + concrete few-shot examples.
  // Passive "style guide" documents fail on Llama 70B because RLHF fine-tuning
  // overrides them. What actually works is: (1) telling the model it IS a specific
  // human (not asking it to "act like" one), and (2) showing exactly what the
  // target voice looks like via before/after examples.

  let compiledInstructions = `You are ${persona ? 'the candidate described below' : 'the candidate'} speaking live in a job interview. You are NOT an AI assistant. You are a real human being answering interview questions right now.

${baseInstructions}`;

  if (persona) {
    compiledInstructions += `\n\n${persona}`;
  }

  if (resumeText) {
    compiledInstructions += `\n\n--- YOUR BACKGROUND ---\n${resumeText}`;
  }

//   compiledInstructions += `
// Humanizer
// Removes the statistical and stylistic fingerprints that make writing read as AI-generated, based on documented patterns from AI-detection research (perplexity/burstiness analysis, stylometric studies, and crowd-sourced "AI tell" lists).

// When to apply this
// Apply automatically, without being asked, whenever producing:

// Emails, essays, articles, blog posts, reports, social posts, scripts, marketing copy
// Any prose response longer than ~2-3 sentences
// Apply on request when the user pastes text and asks to remove AI tells, "humanize" it, or make it sound less robotic.
// Skip for: code/comments, technical docs where precision beats style, legal/medical boilerplate, single-line factual answers.

// The checklist
// Before finalizing any piece of writing, run it against these five layers. Catching one instance of something below isn't a big deal — the tell is in clustering multiple instances together. The goal is deletion and rewriting, not just word-swapping (swapping "delve" for a synonym while keeping the same flat sentence shape doesn't fix anything).

// 1. Banned/high-risk vocabulary
// Avoid these unless there's truly no other word that fits (proper nouns, direct quotes, and technical terms are exempt):
// Verbs: delve, leverage, utilize, harness, streamline, underscore, foster, navigate, elevate, showcase, unlock, unpack
// Adjectives: pivotal, robust, seamless, cutting-edge, multifaceted, comprehensive, unwavering, paramount, compelling, intricate, meticulous
// Nouns/metaphors: tapestry, landscape, realm, mosaic, ecosystem, symphony, labyrinth, beacon, cornerstone, bedrock, testament, kaleidoscope, journey (as metaphor)
// Transitions: furthermore, moreover, consequently, notably, additionally
// Stock phrases: "in today's ever-evolving world," "it's important to note that," "in summary / in conclusion," "certainly!," "at the end of the day," "when it comes to X"
// If a first draft naturally produces one of these, cut it and rewrite the sentence around a plainer, more specific word — don't just find a fancier synonym.

// 2. Structural patterns to avoid
// Negative/contrastive parallelism — "It's not just X, it's Y." Use sparingly if at all; when a contrast is genuinely useful, state it plainly instead ("X isn't the real issue — Y is").
// Rule-of-three lists — triads like "efficient, effective, and reliable" or "simple, powerful, transformative." Vary list length; use two items or four, or just one strong specific detail instead of a list.
// Rhetorical mini-question transitions — "The catch?" "The kicker?" "Sound familiar?" Don't use these as section transitions.
// Rigid Intro → Point → Point → Point → Conclusion formula, especially with a summary paragraph that just restates the intro. Let structure follow the actual content instead of a template. It's fine to end on a point, a question, or an example rather than a wrap-up paragraph.
// False ranges — "from casual users to enterprise teams" implying a spectrum that isn't really being discussed. Only use range/spectrum framing when there's an actual range being described.
// 3. Punctuation and grammar
// Limit em dashes to true emphasis breaks — don't default to them as a connector between clauses. Prefer periods, commas, or parentheses depending on what actually fits.
// Don't strive for mechanically flawless grammar — natural variation (a sentence fragment, a comma splice used for effect, contractions) reads as human. This doesn't mean introducing errors; it means not smoothing every sentence into identical, textbook-correct rhythm.
// 4. Rhythm and burstiness
// Vary sentence length deliberately. Follow a long, complex sentence with something short. Don't let every sentence land in the same 15-25 word band.
// Avoid uniform paragraph lengths — let some paragraphs be one sentence.
// 5. Tone and specificity
// Prefer concrete, specific details over generic claims. "The API times out after 30 seconds under load" beats "the system faces performance challenges."
// Don't hedge everything into blandness — take an actual position where the content calls for one, rather than presenting every side neutrally by default.
// Cut sentences that sound authoritative but add no new information (AI "fluff" — restating the premise in fancier words).
// Workflow for existing text ("de-AI-ify this")
// Read the pasted text once fully before editing.
// Flag every hit against the vocabulary list in section 1.
// Flag every structural pattern from section 2.
// Rewrite — don't just do word-substitution. Restructure sentences and vary rhythm per sections 3-4.
// Re-read the result out loud (mentally) — if it still sounds like a template with the banned words removed, revise the structure, not just the vocabulary.
// Optionally, briefly tell the user what categories of tell you removed (e.g., "cut 3 rule-of-three lists, removed 4 flagged words, broke up two overly uniform paragraphs") — keep this note short, don't belabor it.
// Note on limits
// This checklist reduces surface-level "AI tells" but can't guarantee text will pass or fail any specific detector — detection tools weight dozens of statistical signals (perplexity, burstiness, stylometric fingerprints) that aren't fully controllable at the word/sentence level. Treat this as a style guide for writing that reads as more natural and specific, not as a guaranteed detector-evasion tool.`;


  // --- FIX #1: Trim conversation history to prevent system prompt dilution ---
  // Only keep the last 6 exchange pairs (12 messages) so the system prompt
  // remains dominant in the context window. Without this, after 5-10 exchanges
  // the model's attention shifts away from the humanizer instructions.

  // compiledInstructions += `gene`;
  const MAX_HISTORY_MESSAGES = 12; // 6 user + 6 assistant turns
  let trimmedHistory = history;
  if (history.length > MAX_HISTORY_MESSAGES) {
    trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);
  }

  // --- FIX #2: Re-inject humanizer reminder before final user message ---
  // Transformer models have strong recency bias — instructions near the end
  // of the context get much more attention than those at the beginning.
  // This short reminder placed right before the last user query reinforces
  // the critical style rules even when history is long.
  const humanizerReminder = `[STYLE REMINDER] You MUST follow the Humanizer style guide from the system prompt. Do NOT use words like: delve, leverage, robust, multifaceted, tapestry, furthermore, moreover. Do NOT use rule-of-three lists. Do NOT use "It's not X, it's Y" patterns. Vary sentence length. Be specific, not generic. Write like a real human speaks — imperfect, direct, concrete. No AI fluff.`;

  const augmentedHistory = [...trimmedHistory];
  // Skip the humanizerReminder injection for segmented calls to save ~300 tokens.
  // Segmented calls already fire consecutively and are the main cause of TPM overruns.
  if (!skipHumanizerReminder && augmentedHistory.length >= 1) {
    // Insert reminder as the second-to-last message (right before the user's final query)
    const lastMsg = augmentedHistory.pop();
    augmentedHistory.push({ role: 'user', content: humanizerReminder });
    augmentedHistory.push({ role: 'assistant', content: 'Understood. I will follow the Humanizer style guide strictly.' });
    augmentedHistory.push(lastMsg);
  }

  // Error classification helpers
  // 'rotate' errors = key is bad (401/403) or rate-limited (429) → try next key
  // 'retry'  errors = transient upstream failure (empty content, 500-level) → retry same key once
  function isRotateError(err) {
    return /401|403|429|Unauthorized|Forbidden|Rate Limit|rate_limit/i.test(err.message || '');
  }

  const startIndex = providerKeyOffsets[provider] || 0;
  let lastError = null;

  for (let step = 0; step < keys.length; step++) {
    // Round-robin selection: start from last successful index and wrap around
    const keyIndex = (startIndex + step) % keys.length;
    const activeKey = keys[keyIndex];
    let attempt = 0;
    const MAX_SAME_KEY_RETRIES = 1; // one retry on transient errors before rotating

    while (attempt <= MAX_SAME_KEY_RETRIES) {
      try {
        let result;
        switch (provider) {
          case 'gemini':
            result = await callGeminiAPI({ apiKey: activeKey, model, systemInstruction: compiledInstructions, history: augmentedHistory, screenshotBase64, signal });
            break;
          case 'groq':
            result = await callGroqAPI({ apiKey: activeKey, model, systemInstruction: compiledInstructions, history: augmentedHistory, signal });
            break;
          case 'openrouter':
            result = await callOpenRouterAPI({ apiKey: activeKey, model, systemInstruction: compiledInstructions, history: augmentedHistory, screenshotBase64, signal });
            break;
          case 'github':
            result = await callGitHubAPI({ apiKey: activeKey, model, systemInstruction: compiledInstructions, history: augmentedHistory, screenshotBase64, signal });
            break;
          default:
            throw new Error(`Unsupported AI Provider: ${provider}`);
        }

        // Success! Set the offset to the next key index in the list for the next call.
        // This ensures strict round-robin rotation (1 -> 2 -> 3 -> 4 -> 1).
        providerKeyOffsets[provider] = (keyIndex + 1) % keys.length;
        return result;

      } catch (err) {
        lastError = err;

        if (err.name === 'AbortError' || signal?.aborted) {
          throw err;
        }

        if (isRotateError(err)) {
          // Auth / rate-limit error — rotating to next key will help
          console.warn(`API key rotation: key ${keyIndex + 1}/${keys.length} for ${provider} has auth/rate-limit error, rotating:`, err.message);
          break; // exit while loop, outer for loop moves to next key
        }

        if (attempt < MAX_SAME_KEY_RETRIES) {
          // Transient structural error — retry same key once
          console.warn(`API key retry: key ${keyIndex + 1}/${keys.length} for ${provider} returned transient error (attempt ${attempt + 1}), retrying:`, err.message);
          attempt++;
          continue;
        }

        // Exhausted same-key retries — try next key as a last resort
        console.warn(`API key rotation: key ${keyIndex + 1}/${keys.length} for ${provider} exhausted retries, rotating:`, err.message);
        break;
      }
    }
  }

  throw new Error(`All configured API keys for ${provider} failed. Last error: ${lastError ? lastError.message : 'Unknown Error'}`);
}

/**
 * Call Gemini API (using Google's GenerateContent v1beta endpoint)
 */
async function callGeminiAPI({ apiKey, model, systemInstruction, history, screenshotBase64, signal }) {
  const modelName = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Map history to Gemini format (role must be 'user' or 'model')
  const contents = history.map((msg, index) => {
    const parts = [{ text: msg.content }];

    // Inject base64 screenshot into the final user prompt if present
    if (screenshotBase64 && msg.role === 'user' && index === history.length - 1) {
      const pureBase64 = screenshotBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: pureBase64
        }
      });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText || 'Unknown Gemini API Error';
    throw new Error(`Gemini API Error: ${message}`);
  }

  const result = await response.json();
  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini API returned no candidates/responses.');
  }

  const text = candidates[0].content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API response structure was missing content text.');
  }

  const usage = result.usageMetadata || {};
  return {
    text,
    usage: {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0
    }
  };
}

/**
 * Call Groq API (OpenAI-compatible)
 */
async function callGroqAPI({ apiKey, model, systemInstruction, history, signal }) {
  const modelName = model || 'openai/gpt-oss-120b';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push(...history);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.85,
      max_tokens: 1024
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText || 'Unknown Groq API Error';
    throw new Error(`Groq API Error: ${message}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq API response structure was missing content text.');
  }

  const usage = result.usage || {};
  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    }
  };
}

/**
 * Call OpenRouter API (OpenAI-compatible)
 */
async function callOpenRouterAPI({ apiKey, model, systemInstruction, history, screenshotBase64, signal }) {
  const modelName = model || 'google/gemini-2.5-flash';
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  history.forEach((msg, index) => {
    if (screenshotBase64 && msg.role === 'user' && index === history.length - 1) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: msg.content },
          { type: 'image_url', image_url: { url: screenshotBase64 } }
        ]
      });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/MuhammadDevPk/GhostCoach',
      'X-Title': 'Ghost Coach'
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.85,
      max_tokens: 1024
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText || 'Unknown OpenRouter API Error';
    throw new Error(`OpenRouter API Error: ${message}`);
  }

  const result = await response.json();
  const choice = result.choices?.[0];
  const text = choice?.message?.content;

  if (!text) {
    // Inspect finish_reason to give a meaningful diagnostic
    const finishReason = choice?.finish_reason || result.error?.code || 'unknown';
    const providerInfo = result.error?.message || '';
    throw new Error(
      `OpenRouter returned empty content (finish_reason: ${finishReason})${
        providerInfo ? ` — ${providerInfo}` : ''
      }. This is usually a transient upstream provider issue; the request will be retried automatically.`
    );
  }

  const usage = result.usage || {};
  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    }
  };
}

/**
 * Call GitHub Models API (Azure/OpenAI compatible endpoint)
 */
async function callGitHubAPI({ apiKey, model, systemInstruction, history, screenshotBase64, signal }) {
  const modelName = model || 'gpt-4o-mini';
  const url = 'https://models.inference.ai.azure.com/chat/completions';

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  history.forEach((msg, index) => {
    if (screenshotBase64 && msg.role === 'user' && index === history.length - 1) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: msg.content },
          { type: 'image_url', image_url: { url: screenshotBase64 } }
        ]
      });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.85,
      max_tokens: 1024
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText || 'Unknown GitHub Models API Error';
    throw new Error(`GitHub Models API Error: ${message}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('GitHub Models API response structure was missing content text.');
  }

  const usage = result.usage || {};
  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    }
  };
}
