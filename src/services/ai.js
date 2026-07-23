/**
 * Service to communicate with various AI Providers (Groq, Gemini, OpenRouter, GitHub Models)
 */

/**
 * Sends a message to the configured AI provider and returns the response.
 * @param {Object} params
 * @param {string} params.provider - 'groq' | 'gemini' | 'openrouter' | 'github'
 * @param {string} params.apiKey - The API key for the chosen provider
 * @param {string} params.model - The model identifier
 * @param {string} params.systemInstruction - The training/system prompt instruction
 * @param {Array<{role: string, content: string}>} params.history - The conversation history
 * @returns {Promise<string>} The response text from the AI
 */
export async function sendChatMessage({ provider, apiKey, model, systemInstruction, history, persona, resumeText }) {
  if (!apiKey) {
    throw new Error('API Key is required to call the AI provider.');
  }

  // Compile the "Super Prompt" combining the base instructions, candidate profile, and strict humanizer rules
  const baseInstructions = systemInstruction || 'You are acting as the candidate in a live spoken interview. You will receive transcribed questions. Answer concisely, conversationally, and exactly as a human would speak aloud. Do not act like an AI.';

  let compiledInstructions = `[BASE INSTRUCTIONS]\n${baseInstructions}`;

  if (persona) {
    compiledInstructions += `\n\n[CANDIDATE PERSONA]\n${persona}`;
  }

  if (resumeText) {
    compiledInstructions += `\n\n[CANDIDATE RESUME / BACKGROUND]\n${resumeText}`;
  }

//   compiledInstructions += `\n\n[CRITICAL STYLE GUIDE: THE HUMANIZER]
// You MUST adhere strictly to the following stylistic rules to ensure your spoken responses sound 100% human and unscripted.

// 1. BANNED VOCABULARY
// Never use these words unless technically required:
// - Verbs: delve, leverage, utilize, harness, streamline, underscore, foster, navigate, elevate, showcase, unlock, unpack
// - Adjectives: pivotal, robust, seamless, cutting-edge, multifaceted, comprehensive, unwavering, paramount, compelling, intricate, meticulous
// - Nouns/Metaphors: tapestry, landscape, realm, mosaic, ecosystem, symphony, labyrinth, beacon, cornerstone, bedrock, testament, kaleidoscope, journey
// - Transitions/Filler: furthermore, moreover, consequently, notably, additionally, "in today's ever-evolving world," "it's important to note," "in summary," "certainly!"

// 2. STRUCTURAL PATTERNS TO AVOID & BANNED FORMULAS
// - Absolutely NEVER use the introduction formula: "I am a [Title] with [X] years of experience doing [broad concept]." That is a 100% AI fingerprint.
// - Never answer a technical question with a single, massive run-on sentence. You MUST use at least 3-6 distinct sentences per answer to establish burstiness.
// - No contrastive parallelism (Avoid "It's not just X, it's Y").
// - No rule-of-three lists (Avoid "efficient, effective, and reliable"). Use one specific detail or two items.
// - No rhetorical mini-questions ("The catch?", "Sound familiar?").
// - No rigid "Intro -> Point -> Conclusion" formats. Just answer the question directly and end on a strong point.

// 3. RHYTHM, BURSTINESS, AND GRAMMAR
// - Vary sentence length deliberately. Follow a long, complex explanation with a short, punchy sentence.
// - Do not let every sentence land in the 15-25 word band.
// - Speak with natural variation. Contractions are mandatory (I'm, we've, didn't).
// - Limit em-dashes. Do not strive for mechanically flawless, textbook rhythm.

// 4. TONE, CONVERSATIONAL FILLER, AND SPECIFICITY
// - Start your answers with conversational filler like "Honestly," "In my experience," "Usually, I'd approach this by," or "So, basically" to break the formal AI pattern.
// - Prefer concrete, specific details over generic claims. ("The API times out after 30 seconds" beats "the system faces performance challenges.")
// - Do not hedge. Take an actual position.
// - Cut sentences that sound authoritative but add no new information.
// - Study this example of a natural, human spoken introduction: "Hey, I'm [Name]. I've been coding for about 14 years now—mostly full-stack. Lately, my main focus has been building out this telemetry service, but I've touched a bit of everything over the years."`;
  compiledInstructions += `\n\n[CRITICAL STYLE GUIDE: THE HUMANIZER]
---
name: humanizer
description: Strips robotic "AI-sounding" tells from written output — overused vocabulary (delve, tapestry, leverage, robust, multifaceted), formulaic structures (rule-of-three lists, "it's not X, it's Y" contrast, rhetorical mini-questions, rigid intro-point-point-conclusion formatting), unnatural punctuation (em-dash overuse, mechanically perfect grammar), and filler transitions (furthermore, moreover, in conclusion). Use automatically for any substantive written content — emails, essays, articles, blog posts, reports, social posts, scripts, marketing copy, or prose beyond a couple sentences — even without an explicit request. Also use when the user pastes text and asks to remove AI tells, humanize it, or de-AI-ify it. Skip for code, precision-critical technical/legal/medical text, or short factual one-liners.
---

# Humanizer

Removes the statistical and stylistic fingerprints that make writing read as AI-generated, based on documented patterns from AI-detection research (perplexity/burstiness analysis, stylometric studies, and crowd-sourced "AI tell" lists).

## When to apply this

Apply automatically, without being asked, whenever producing:
- Emails, essays, articles, blog posts, reports, social posts, scripts, marketing copy
- Any prose response longer than ~2-3 sentences

Apply on request when the user pastes text and asks to remove AI tells, "humanize" it, or make it sound less robotic.

Skip for: code/comments, technical docs where precision beats style, legal/medical boilerplate, single-line factual answers.

## The checklist

Before finalizing any piece of writing, run it against these five layers. Catching one instance of something below isn't a big deal — the tell is in *clustering* multiple instances together. The goal is deletion and rewriting, not just word-swapping (swapping "delve" for a synonym while keeping the same flat sentence shape doesn't fix anything).

### 1. Banned/high-risk vocabulary

Avoid these unless there's truly no other word that fits (proper nouns, direct quotes, and technical terms are exempt):

**Verbs:** delve, leverage, utilize, harness, streamline, underscore, foster, navigate, elevate, showcase, unlock, unpack

**Adjectives:** pivotal, robust, seamless, cutting-edge, multifaceted, comprehensive, unwavering, paramount, compelling, intricate, meticulous

**Nouns/metaphors:** tapestry, landscape, realm, mosaic, ecosystem, symphony, labyrinth, beacon, cornerstone, bedrock, testament, kaleidoscope, journey (as metaphor)

**Transitions:** furthermore, moreover, consequently, notably, additionally

**Stock phrases:** "in today's ever-evolving world," "it's important to note that," "in summary / in conclusion," "certainly!," "at the end of the day," "when it comes to X"

If a first draft naturally produces one of these, cut it and rewrite the sentence around a plainer, more specific word — don't just find a fancier synonym.

### 2. Structural patterns to avoid

- **Negative/contrastive parallelism** — "It's not just X, it's Y." Use sparingly if at all; when a contrast is genuinely useful, state it plainly instead ("X isn't the real issue — Y is").
- **Rule-of-three lists** — triads like "efficient, effective, and reliable" or "simple, powerful, transformative." Vary list length; use two items or four, or just one strong specific detail instead of a list.
- **Rhetorical mini-question transitions** — "The catch?" "The kicker?" "Sound familiar?" Don't use these as section transitions.
- **Rigid Intro → Point → Point → Point → Conclusion formula**, especially with a summary paragraph that just restates the intro. Let structure follow the actual content instead of a template. It's fine to end on a point, a question, or an example rather than a wrap-up paragraph.
- **False ranges** — "from casual users to enterprise teams" implying a spectrum that isn't really being discussed. Only use range/spectrum framing when there's an actual range being described.

### 3. Punctuation and grammar

- Limit em dashes to true emphasis breaks — don't default to them as a connector between clauses. Prefer periods, commas, or parentheses depending on what actually fits.
- Don't strive for mechanically flawless grammar — natural variation (a sentence fragment, a comma splice used for effect, contractions) reads as human. This doesn't mean introducing errors; it means not smoothing every sentence into identical, textbook-correct rhythm.

### 4. Rhythm and burstiness

- Vary sentence length deliberately. Follow a long, complex sentence with something short. Don't let every sentence land in the same 15-25 word band.
- Avoid uniform paragraph lengths — let some paragraphs be one sentence.

### 5. Tone and specificity

- Prefer concrete, specific details over generic claims. "The API times out after 30 seconds under load" beats "the system faces performance challenges."
- Don't hedge everything into blandness — take an actual position where the content calls for one, rather than presenting every side neutrally by default.
- Cut sentences that sound authoritative but add no new information (AI "fluff" — restating the premise in fancier words).

## Workflow for existing text ("de-AI-ify this")

1. Read the pasted text once fully before editing.
2. Flag every hit against the vocabulary list in section 1.
3. Flag every structural pattern from section 2.
4. Rewrite — don't just do word-substitution. Restructure sentences and vary rhythm per sections 3-4.
5. Re-read the result out loud (mentally) — if it still sounds like a template with the banned words removed, revise the structure, not just the vocabulary.
6. Optionally, briefly tell the user what categories of tell you removed (e.g., "cut 3 rule-of-three lists, removed 4 flagged words, broke up two overly uniform paragraphs") — keep this note short, don't belabor it.

## Note on limits

This checklist reduces surface-level "AI tells" but can't guarantee text will pass or fail any specific detector — detection tools weight dozens of statistical signals (perplexity, burstiness, stylometric fingerprints) that aren't fully controllable at the word/sentence level. Treat this as a style guide for writing that reads as more natural and specific, not as a guaranteed detector-evasion tool.`;

  switch (provider) {
    case 'gemini':
      return callGeminiAPI({ apiKey, model, systemInstruction: compiledInstructions, history });
    case 'groq':
      return callGroqAPI({ apiKey, model, systemInstruction: compiledInstructions, history });
    case 'openrouter':
      return callOpenRouterAPI({ apiKey, model, systemInstruction: compiledInstructions, history });
    case 'github':
      return callGitHubAPI({ apiKey, model, systemInstruction: compiledInstructions, history });
    default:
      throw new Error(`Unsupported AI Provider: ${provider}`);
  }
}

/**
 * Call Gemini API (using Google's GenerateContent v1beta endpoint)
 */
async function callGeminiAPI({ apiKey, model, systemInstruction, history }) {
  const modelName = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Map history to Gemini format (role must be 'user' or 'model')
  const contents = history.map(msg => {
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
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
    body: JSON.stringify(payload)
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
async function callGroqAPI({ apiKey, model, systemInstruction, history }) {
  const modelName = model || 'llama-3.3-70b-versatile';
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
      temperature: 0.7,
      max_tokens: 1024
    })
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
async function callOpenRouterAPI({ apiKey, model, systemInstruction, history }) {
  const modelName = model || 'google/gemini-2.5-flash';
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push(...history);

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
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText || 'Unknown OpenRouter API Error';
    throw new Error(`OpenRouter API Error: ${message}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenRouter API response structure was missing content text.');
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
async function callGitHubAPI({ apiKey, model, systemInstruction, history }) {
  const modelName = model || 'gpt-4o-mini';
  const url = 'https://models.inference.ai.azure.com/chat/completions';

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
      temperature: 0.7,
      max_tokens: 1024
    })
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
