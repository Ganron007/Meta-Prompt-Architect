const DEFAULT_BASES = {
  openai: 'https://api.openai.com',
  'openai-compatible': 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
  anthropic: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434',
  mimo: 'https://api.xiaomimimo.com'
};

async function callLLM(provider, model, apiKey, apiBase, messages, temperature = 0.3, opts = {}) {
  try {
    return await dispatch(provider, model, apiKey, apiBase, messages, temperature);
  } catch (err) {
    const fallback = opts.fallbackModel || process.env.ARCHITECT_MODEL_FALLBACK;
    if (fallback && fallback !== model) {
      return await dispatch(provider, fallback, apiKey, apiBase, messages, temperature);
    }
    throw err;
  }
}

function dispatch(provider, model, apiKey, apiBase, messages, temperature) {
  const base = apiBase || DEFAULT_BASES[provider];
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'openai-compatible':
      return callOpenAICompatible(base, model, apiKey, messages, temperature);
    case 'mimo':
      return callMiMo(base, model, apiKey, messages, temperature);
    case 'anthropic':
      return callAnthropic(base, model, apiKey, messages, temperature);
    case 'ollama':
      return callOllama(base, model, messages, temperature);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAICompatible(baseUrl, model, apiKey, messages, temperature) {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callMiMo(baseUrl, model, apiKey, messages, temperature) {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      thinking: { type: 'disabled' }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiMo API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropic(baseUrl, model, apiKey, messages, temperature) {
  const system = messages.find(m => m.role === 'system')?.content;
  const conversation = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, messages: conversation, temperature, system, max_tokens: 4096 })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function callOllama(baseUrl, model, messages, temperature) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature } })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.message?.content?.trim() || '';
}

module.exports = { callLLM, DEFAULT_BASES };
