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

function streamRequest(provider, baseUrl, model, apiKey, messages, temperature) {
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'openai-compatible':
      return {
        url: `${baseUrl}/v1/chat/completions`,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: { model, messages, temperature, stream: true }
      };
    case 'mimo':
      return {
        url: `${baseUrl}/v1/chat/completions`,
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: { model, messages, temperature, thinking: { type: 'disabled' }, stream: true }
      };
    case 'anthropic': {
      const system = messages.find(m => m.role === 'system')?.content;
      const conversation = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      return {
        url: `${baseUrl}/v1/messages`,
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: { model, messages: conversation, temperature, system, max_tokens: 4096, stream: true }
      };
    }
    case 'ollama':
      return {
        url: `${baseUrl}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        body: { model, messages, stream: true, options: { temperature } }
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function parseStreamLine(provider, line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed === 'data: [DONE]' || trimmed.startsWith('event:')) return null;
  if (provider === 'ollama') {
    try {
      const data = JSON.parse(trimmed);
      return data.message && typeof data.message.content === 'string' ? data.message.content : null;
    } catch { return null; }
  }
  if (!trimmed.startsWith('data:')) return null;
  let data;
  try {
    data = JSON.parse(trimmed.slice(5).trim());
  } catch { return null; }
  if (provider === 'anthropic') {
    return data.type === 'content_block_delta' && data.delta && typeof data.delta.text === 'string' ? data.delta.text : null;
  }
  const delta = data.choices && data.choices[0] && data.choices[0].delta;
  return delta && typeof delta.content === 'string' ? delta.content : null;
}

async function streamLLMOnce(provider, model, apiKey, apiBase, messages, temperature, onToken) {
  const base = apiBase || DEFAULT_BASES[provider];
  const req = streamRequest(provider, base, model, apiKey, messages, temperature);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${provider} stream error ${res.status}: ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const token = parseStreamLine(provider, line);
      if (token) {
        full += token;
        if (onToken) onToken(token);
      }
    }
  }
  const tail = parseStreamLine(provider, buffer);
  if (tail) {
    full += tail;
    if (onToken) onToken(tail);
  }
  return full;
}

async function callLLMStream(provider, model, apiKey, apiBase, messages, temperature = 0.3, opts = {}) {
  try {
    return await streamLLMOnce(provider, model, apiKey, apiBase, messages, temperature, opts.onToken);
  } catch (err) {
    const fallback = opts.fallbackModel || process.env.ARCHITECT_MODEL_FALLBACK;
    if (fallback && fallback !== model) {
      return await streamLLMOnce(provider, fallback, apiKey, apiBase, messages, temperature, opts.onToken);
    }
    throw err;
  }
}

module.exports = { callLLM, callLLMStream, parseStreamLine, streamRequest, DEFAULT_BASES };
