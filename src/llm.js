const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function chatUrl(apiBase) {
  return `${String(apiBase || DEFAULT_BASE_URL).replace(/\/+$/, '')}/chat/completions`;
}

function buildBody(model, messages, temperature, reasoning, stream) {
  const body = { model, messages, temperature };
  if (reasoning) body.reasoning_effort = reasoning;
  if (stream) body.stream = true;
  return body;
}

function buildHeaders(apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function callOnce(model, apiKey, apiBase, messages, temperature, reasoning) {
  const res = await fetch(chatUrl(apiBase), {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildBody(model, messages, temperature, reasoning, false))
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callLLM(model, apiKey, apiBase, messages, temperature = 0.3, opts = {}) {
  try {
    return await callOnce(model, apiKey, apiBase, messages, temperature, opts.reasoning);
  } catch (err) {
    const fallback = opts.fallbackModel || process.env.OPENAI_FALLBACK_MODEL;
    if (fallback && fallback !== model) {
      return await callOnce(fallback, apiKey, apiBase, messages, temperature, opts.reasoning);
    }
    throw err;
  }
}

function streamRequest(apiBase, model, apiKey, messages, temperature, reasoning) {
  return {
    url: chatUrl(apiBase),
    headers: buildHeaders(apiKey),
    body: buildBody(model, messages, temperature, reasoning, true)
  };
}

function parseStreamLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed === 'data: [DONE]' || trimmed.startsWith('event:') || !trimmed.startsWith('data:')) return null;
  let data;
  try {
    data = JSON.parse(trimmed.slice(5).trim());
  } catch { return null; }
  const delta = data.choices && data.choices[0] && data.choices[0].delta;
  return delta && typeof delta.content === 'string' ? delta.content : null;
}

async function streamLLMOnce(model, apiKey, apiBase, messages, temperature, reasoning, onToken) {
  const req = streamRequest(apiBase, model, apiKey, messages, temperature, reasoning);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM stream error ${res.status}: ${text.slice(0, 200)}`);
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
      const token = parseStreamLine(line);
      if (token) {
        full += token;
        if (onToken) onToken(token);
      }
    }
  }
  const tail = parseStreamLine(buffer);
  if (tail) {
    full += tail;
    if (onToken) onToken(tail);
  }
  return full;
}

async function callLLMStream(model, apiKey, apiBase, messages, temperature = 0.3, opts = {}) {
  try {
    return await streamLLMOnce(model, apiKey, apiBase, messages, temperature, opts.reasoning, opts.onToken);
  } catch (err) {
    const fallback = opts.fallbackModel || process.env.OPENAI_FALLBACK_MODEL;
    if (fallback && fallback !== model) {
      return await streamLLMOnce(fallback, apiKey, apiBase, messages, temperature, opts.reasoning, opts.onToken);
    }
    throw err;
  }
}

module.exports = { callLLM, callLLMStream, parseStreamLine, streamRequest, DEFAULT_BASE_URL };
