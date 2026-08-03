const { getRecipe } = require('./recipes');

const CARRYOVER_ITEMS = [
  'the original task statement, verbatim',
  'all hard constraints and boundaries',
  'key decisions made and their rationale',
  'file paths, artifact names, and identifiers produced',
  'open risks, blockers, and unresolved questions'
];

function parseChain(value) {
  const ids = String(value || '').split(',').map(id => id.trim()).filter(Boolean);
  if (ids.length < 2) {
    throw new Error('--chain needs at least two recipe ids, e.g. --chain prd-then-build,saas-starter');
  }
  return ids;
}

function buildChain(ids, customRecipes = {}) {
  return ids.map((id, index) => {
    const recipe = getRecipe(id, customRecipes);
    if (!recipe) throw new Error(`Unknown recipe in chain: "${id}" (step ${index + 1}). See --recipes.`);
    return { id, label: recipe.label, position: index + 1 };
  });
}

function chainPreamble(chain, index) {
  const step = chain[index];
  const prev = chain[index - 1];
  const next = chain[index + 1];
  const lines = [
    `## Chain Context`,
    ``,
    `You are step ${step.position} of ${chain.length} in a linked prompt chain: ${chain.map(s => s.id).join(' → ')}.`,
    ``
  ];
  if (prev) {
    lines.push(`**Handoff in:** The output of step ${prev.position} (${prev.id} — ${prev.label}) is your primary input. Treat it as authoritative upstream work: build on it, do not redo it. If a required input from that step is missing or contradictory, flag it explicitly before proceeding.`);
  } else {
    lines.push(`**Handoff in:** None — you are the first step. Your output must be self-contained enough for the next step to consume without access to this conversation.`);
  }
  lines.push(``);
  if (next) {
    lines.push(`**Handoff out:** Your output becomes the primary input for step ${next.position} (${next.id} — ${next.label}). End with a clearly delimited "## Handoff Summary" section containing: what was produced, key decisions and rationale, artifact/file references, and anything the next step must know.`);
  } else {
    lines.push(`**Handoff out:** None — you are the final step. Deliver the complete, end-user-ready result and a brief retrospective on the whole chain.`);
  }
  lines.push(``);
  lines.push(`**Context carryover:** Preserve and restate in your output: ${CARRYOVER_ITEMS.join('; ')}.`);
  lines.push(``);
  lines.push(`**Quality gate:** Before finishing, confirm: (1) every required output element of this step is present; (2) unresolved items are explicitly listed, not silently dropped; (3) the next step's required inputs exist in your output. If any check fails, say so and state exactly what is missing.`);
  return lines.join('\n');
}

function wrapChainStep(chain, index, prompt) {
  const step = chain[index];
  const header = `═══ CHAIN STEP ${step.position}/${chain.length} — ${step.id} (${step.label}) ═══`;
  return `${header}\n\n${chainPreamble(chain, index)}\n\n${prompt}`;
}

module.exports = { parseChain, buildChain, chainPreamble, wrapChainStep };
