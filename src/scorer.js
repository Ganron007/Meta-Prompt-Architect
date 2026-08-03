const { getPlatform } = require('./platforms');

const VAGUE_TERMS = [
  'something', 'somehow', 'stuff', 'things', 'whatever', 'etc', 'and so on',
  'as appropriate', 'as needed', 'if possible', 'properly', 'nicely',
  'good quality', 'best effort', 'maybe', 'might want to', 'or something'
];

const BOUNDARY_PATTERN = /\b(do not|don't|never|must not|must|always|only|shall|required|forbidden|prohibited|hard rule|invariant|non[- ]negotiable|no hardcoded|no external|no placeholders)\b/gi;

const CONCRETE_PATTERNS = [
  /\b\d+(?:\.\d+)+\b/g,
  /\b[\w.-]+\.(?:js|ts|py|go|rs|java|c|cpp|h|json|jsonc|ya?ml|toml|xml|md|txt|csv|exe|dll|so|bin|pcap|evtx|log|sql|sh|ps1|bat)\b/gi,
  /```/g,
  /[A-Z]:\\[\w\\.-]+|\/[\w./-]{3,}/g,
  /\b[A-Z][A-Z0-9_]{2,}\b/g,
  /"[^"\n]{2,}"/g
];

const SECTION_SIGNALS = [
  { id: 'role', pattern: /(^|\n)#*\s*.*role\b|\byou are\b|<identity>/i },
  { id: 'context', pattern: /(^|\n)#*\s*.*(context|background|situation)\b/i },
  { id: 'objective', pattern: /(^|\n)#*\s*.*(objective|mission|goal|task)\b/i },
  { id: 'output', pattern: /(^|\n)#*\s*.*(output|deliverable|response format|report format)\b/i },
  { id: 'rules', pattern: /(^|\n)#*\s*.*(constraint|rule|boundar|guardrail|invariant)\b/i },
  { id: 'steps', pattern: /(^|\n)#*\s*.*(phase|step|workflow|procedure|methodology)\b/i }
];

const DELIVERABLE_TERMS = /\b(deliverable|acceptance criteria|success (criteria|marker)|completion|verify|validate|evidence|report|summary of|sign[- ]off)\b/gi;

function clampScore(n) {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function countMatches(text, pattern) {
  const m = text.match(pattern);
  return m ? m.length : 0;
}

function scoreSpecificity(text, words) {
  const findings = [];
  let concrete = 0;
  for (const p of CONCRETE_PATTERNS) concrete += countMatches(text, p);
  let vagueHits = 0;
  const lower = text.toLowerCase();
  const vagueFound = [];
  for (const term of VAGUE_TERMS) {
    const hits = lower.split(term).length - 1;
    if (hits > 0) { vagueHits += hits; vagueFound.push(term); }
  }
  const density = concrete / Math.max(1, words / 100);
  let score = 4 + Math.min(5, Math.floor(density)) - Math.min(4, vagueHits);
  if (density >= 1) findings.push(`${concrete} concrete details (paths, versions, code, quoted values)`);
  else findings.push('few concrete details — add paths, versions, tool names, or examples');
  if (vagueHits > 0) findings.push(`vague wording: ${[...new Set(vagueFound)].slice(0, 4).join(', ')}`);
  return { score: clampScore(score), findings };
}

function scoreStructure(text) {
  const findings = [];
  const found = SECTION_SIGNALS.filter(s => s.pattern.test(text)).map(s => s.id);
  const headings = countMatches(text, /(^|\n)#{1,4}\s+\S/g) + countMatches(text, /(^|\n)<[a-z_]+>/g);
  const missing = SECTION_SIGNALS.filter(s => !found.includes(s.id)).map(s => s.id);
  let score = 2 + found.length * 1.2 + Math.min(2, headings / 4);
  if (found.length) findings.push(`sections present: ${found.join(', ')}`);
  if (missing.length) findings.push(`missing sections: ${missing.join(', ')}`);
  return { score: clampScore(score), findings };
}

function scoreConstraints(text) {
  const hits = countMatches(text, BOUNDARY_PATTERN);
  const findings = [];
  let score;
  if (hits === 0) {
    score = 2;
    findings.push('no explicit boundaries — add must/never/do-not rules');
  } else {
    score = 3 + hits;
    findings.push(`${hits} explicit boundary statement${hits === 1 ? '' : 's'} (must/never/do-not/only)`);
  }
  return { score: clampScore(score), findings };
}

function scorePlatform(text, agent) {
  const findings = [];
  const platform = getPlatform(agent || 'generic');
  const lower = text.toLowerCase();
  let score = 1;
  const nameHit = platform.name.toLowerCase().split(/[\s/]+/).some(part => part.length > 2 && lower.includes(part));
  if (nameHit) score += 2;
  if (/platform playbook/i.test(text)) score += 2;
  const features = [...(platform.modes || []), ...(platform.config || []), ...(platform.context || [])]
    .map(f => f.split(/[\s(/]/)[0].toLowerCase())
    .filter(f => f.length > 2);
  const featureHits = new Set(features.filter(f => lower.includes(f)));
  score += Math.min(4, featureHits.size);
  if (platform.terminal && /\bterminal\b|\bshell\b|\bbash\b/i.test(text)) score += 1;
  if (nameHit || featureHits.size > 0) {
    findings.push(`targets ${platform.name}: ${featureHits.size} platform feature${featureHits.size === 1 ? '' : 's'} referenced`);
  } else {
    findings.push(`no ${platform.name}-specific features referenced — exploit modes, config files, or context tools`);
  }
  return { score: clampScore(score), findings };
}

function scoreCompleteness(text, words) {
  const findings = [];
  let score = 10;
  const leftovers = countMatches(text, /\{\{[^}]+\}\}/g);
  if (leftovers > 0) { score -= Math.min(8, leftovers * 4); findings.push(`${leftovers} unfilled {{placeholder}}${leftovers === 1 ? '' : 's'}`); }
  const inserts = countMatches(text, /\[(INSERT|TBD|TODO|FILL)[^\]]*\]/gi);
  if (inserts > 0) { score -= Math.min(6, inserts * 2); findings.push(`${inserts} unfilled [INSERT] marker${inserts === 1 ? '' : 's'}`); }
  if (words < 40) { score -= 5; findings.push('very short — likely missing inputs or instructions'); }
  else if (words < 80) { score -= 3; findings.push('short — check all necessary inputs are specified'); }
  if (findings.length === 0) findings.push('no unfilled placeholders; inputs fully specified');
  return { score: clampScore(score), findings };
}

function scoreActionability(text) {
  const findings = [];
  const steps = countMatches(text, /(^|\n)\s*(?:[-*•]|\d+[.)]|Phase\s+\d|Step\s+\d)/g);
  const deliverables = countMatches(text, DELIVERABLE_TERMS);
  const questions = countMatches(text, /\?/g);
  let score = 3 + Math.min(4, Math.floor(steps / 2)) + Math.min(3, deliverables) - Math.min(2, questions * 0.5);
  if (steps >= 4) findings.push(`${steps} enumerated steps/bullets to execute`);
  else findings.push('few enumerated steps — break the work into ordered actions');
  if (deliverables > 0) findings.push(`${deliverables} completion/verification signal${deliverables === 1 ? '' : 's'}`);
  else findings.push('no acceptance criteria or deliverable definition');
  if (questions > 3) findings.push(`${questions} open questions may stall execution`);
  return { score: clampScore(score), findings };
}

function scorePrompt(promptText, opts = {}) {
  const text = String(promptText || '');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const dims = [
    { id: 'specificity', label: 'Specificity', ...scoreSpecificity(text, words) },
    { id: 'structure', label: 'Structure', ...scoreStructure(text) },
    { id: 'constraints', label: 'Constraints', ...scoreConstraints(text) },
    { id: 'platform', label: 'Platform utilization', ...scorePlatform(text, opts.agent) },
    { id: 'completeness', label: 'Completeness', ...scoreCompleteness(text, words) },
    { id: 'actionability', label: 'Actionability', ...scoreActionability(text) }
  ];
  const total = dims.reduce((sum, d) => sum + d.score, 0);
  const maxTotal = dims.length * 10;
  const percent = Math.round((total / maxTotal) * 100);
  const grade = percent >= 90 ? 'A' : percent >= 75 ? 'B' : percent >= 60 ? 'C' : percent >= 45 ? 'D' : 'F';
  return {
    total,
    maxTotal,
    percent,
    grade,
    dimensions: dims.map(d => ({ id: d.id, label: d.label, score: d.score, max: 10, findings: d.findings }))
  };
}

function formatScore(result) {
  const lines = [`\n── Prompt Quality ── ${result.total}/${result.maxTotal} (${result.percent}%) · Grade ${result.grade}`];
  for (const d of result.dimensions) {
    lines.push(`  ${d.label.padEnd(22)} ${d.score}/10`);
    for (const f of d.findings) lines.push(`  ${''.padEnd(22)} · ${f}`);
  }
  return lines.join('\n');
}

module.exports = { scorePrompt, formatScore };
