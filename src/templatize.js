const { callLLM } = require('./llm');
const { buildCustomRecipe } = require('./custom-recipes');

function buildTemplatizeMessages(promptText, { name, category } = {}) {
  return [
    {
      role: 'system',
      content: `You reverse-engineer finished prompts into reusable recipe templates. Reply with ONLY a JSON object, no markdown fences, no commentary:
{"label": "<short human name>", "tagline": "<one-line description>", "role": "<persona the prompt assigns>", "steps": ["<imperative workflow step>", "..."], "hardRules": ["<boundary/rule>", "..."], "outputFormat": "<required final output format>", "placeholders": ["<snake_case variable the prompt needs beyond task/context/constraints>", "..."]}
Rules: 3-8 steps, 1-8 hardRules, 0-4 custom placeholders, no commentary.`
    },
    {
      role: 'user',
      content: `## Prompt to templatize${name ? `\nDesired recipe name: ${name}` : ''}${category ? `\nDesired category: ${category}` : ''}\n\n${promptText}`
    }
  ];
}

function parseTemplatizeResponse(raw) {
  const text = String(raw || '');
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('templatize response contains no JSON object');
  const parsed = JSON.parse(body.slice(start, end + 1));
  if (typeof parsed.label !== 'string' || !parsed.label.trim()) throw new Error('templatize response missing "label"');
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) throw new Error('templatize response missing "steps"');
  return {
    label: parsed.label.trim(),
    tagline: String(parsed.tagline || '').trim(),
    role: String(parsed.role || 'an expert assistant').trim(),
    steps: parsed.steps.map(String),
    hardRules: Array.isArray(parsed.hardRules) && parsed.hardRules.length ? parsed.hardRules.map(String) : ['Follow the task requirements exactly.'],
    outputFormat: String(parsed.outputFormat || 'A complete, well-structured response.').trim(),
    placeholders: Array.isArray(parsed.placeholders) ? parsed.placeholders.map(String) : []
  };
}

function heuristicTemplatize(promptText, { name, category } = {}) {
  const lines = String(promptText || '').split('\n');
  const text = lines.join('\n');

  let role = '';
  const roleMatch = text.match(/(?:^|\n)#+\s*(?:Role:\s*)?([^\n]*(?:engineer|architect|analyst|reviewer|assistant|expert|lead|specialist|orchestrator)[^\n]*)/i)
    || text.match(/You are (?:an?|the)?\s*([^\n.]+)/i);
  if (roleMatch) role = roleMatch[1].replace(/^Role:\s*/i, '').trim();

  const steps = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[.)]|Phase\s+\d+[:.]?|Step\s+\d+[:.]?)\s+(.{12,})/i);
    if (m && steps.length < 8) steps.push(m[1].trim().replace(/[.:]$/, ''));
  }
  if (steps.length === 0) {
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(Write|Create|Build|Analyze|Review|List|Identify|Design|Implement|Verify|Document|Report)\b(.{4,})/i);
      if (m && steps.length < 8) steps.push(`${m[1]}${m[2]}`.trim().replace(/[.:]$/, ''));
    }
  }

  const hardRules = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]?\s*((?:Do not|Don't|Never|Must not|Always|Only)\b.{6,})/i);
    if (m && hardRules.length < 8) hardRules.push(m[1].trim().replace(/[.:]$/, ''));
  }
  if (hardRules.length === 0) hardRules.push('Follow the task requirements exactly.');

  let outputFormat = '';
  const outMatch = text.match(/(?:^|\n)#+\s*(?:Output(?:\s+Format)?|Deliverable|Response Format)[:\s]*\n+([^\n#]{10,})/i);
  if (outMatch) outputFormat = outMatch[1].trim().replace(/^[:\-]\s*/, '');

  const placeholderSet = new Set();
  for (const m of text.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)) {
    if (!['task', 'context', 'constraints'].includes(m[1])) placeholderSet.add(m[1]);
  }

  if (!role) throw new Error('Could not identify a role/persona in the prompt — add a "You are..." or "# Role:" line, or use the LLM path.');
  if (steps.length === 0) throw new Error('Could not identify workflow steps — add numbered steps, or use the LLM path.');

  const label = String(name || role.replace(/\b(a|an|the)\b/gi, '').trim().split(/\s+/).slice(0, 5).join(' ')).trim();
  return {
    label,
    tagline: `Reusable pattern extracted from an existing prompt.`,
    role,
    steps,
    hardRules,
    outputFormat: outputFormat || 'A complete, well-structured response.',
    placeholders: [...placeholderSet],
    category
  };
}

async function templatizePrompt(promptText, config = {}) {
  const useLLM = config.model && !config.offline;
  const draft = useLLM
    ? parseTemplatizeResponse(await callLLM(config.model, config.apiKey, config.apiBase, buildTemplatizeMessages(promptText, config), 0.2, { fallbackModel: config.fallbackModel, reasoning: config.reasoning }))
    : heuristicTemplatize(promptText, config);
  return buildCustomRecipe({
    name: config.name || draft.label,
    category: config.category || 'build',
    role: draft.role,
    steps: draft.steps,
    hardRules: draft.hardRules,
    outputFormat: draft.outputFormat,
    placeholders: draft.placeholders,
    tagline: draft.tagline
  });
}

module.exports = { buildTemplatizeMessages, parseTemplatizeResponse, heuristicTemplatize, templatizePrompt };
