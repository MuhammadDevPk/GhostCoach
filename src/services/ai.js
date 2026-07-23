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

  // Compile the "Super Prompt" combining the base instructions with persona and resume context
  let compiledInstructions = systemInstruction || '';
  if (persona || resumeText) {
    compiledInstructions += '\n\n=== CANDIDATE PROFILE ===';
    if (persona) {
      compiledInstructions += `\n\nCandidate Persona (Tone & Role):\n${persona}`;
    }
    if (resumeText) {
      compiledInstructions += `\n\nCandidate Resume / Experience:\n${resumeText}`;
    }
  }

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

  return text;
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

  return text;
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

  return text;
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

  return text;
}
