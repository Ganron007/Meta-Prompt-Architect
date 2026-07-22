const { callLLM } = require('./llm');

const ENHANCER_SYSTEM_PROMPT = `You are an elite Prompt Engineer and Operations Director. Your job is to take a user's rough, conversational request and rewrite it into clear, professional, engineering-grade language suitable for a downstream AI agent.

Rules:
- Preserve the original intent and scope exactly.
- Use concise, professional, and specific wording.
- Remove filler words, typos, and casual phrasing.
- Add relevant technical context when it is implied (e.g., naming the environment, domain, or deliverable).
- Output ONLY the rewritten text. No preamble, no quotes, no explanation.
- If the input is ambiguous, briefly note what needs clarification.`;

async function enhanceWithLLM(text, config = {}) {
  if (!text || !text.trim()) return text;
  const {
    provider,
    model,
    apiKey,
    apiBase
  } = config;

  if (!provider) return enhanceWithRules(text);

  const messages = [
    { role: 'system', content: ENHANCER_SYSTEM_PROMPT },
    { role: 'user', content: `Rewrite the following request professionally:\n\n${text}\n\nRewritten:` }
  ];

  try {
    const result = await callLLM(provider, model, apiKey, apiBase, messages, 0.3);
    return result || enhanceWithRules(text);
  } catch {
    return enhanceWithRules(text);
  }
}

function enhanceWithRules(text) {
  if (!text) return text;
  let t = text.trim();
  const replacements = [
    [/\bpls\b/gi, 'please'],
    [/\bthx\b/gi, 'thank you'],
    [/\bthru\b/gi, 'through'],
    [/\bcheck\b/gi, 'review'],
    [/\blook at\b/gi, 'analyze'],
    [/\bmake sure\b/gi, 'ensure'],
    [/\bfix up\b/gi, 'refactor'],
    [/\b\.\s+/g, '. ']
  ];
  for (const [pattern, replacement] of replacements) {
    t = t.replace(pattern, replacement);
  }
  t = t.replace(/^\s+/, '').replace(/\s+$/, '');
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/^\w/, c => c.toUpperCase());
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

module.exports = { enhanceWithLLM, enhanceWithRules, ENHANCER_SYSTEM_PROMPT };
