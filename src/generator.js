const templates = require('./templates');
const { enhanceWithLLM } = require('./enhancer');
const { buildPlaybook } = require('./platforms');
const { renderRecipe, getRecipe } = require('./recipes');
const { getStrings } = require('./i18n');

async function generate(config) {
  const {
    agent = 'generic',
    domain = 'general',
    task = '',
    context = '',
    constraints = '',
    outputFormat = 'markdown',
    tone = 'professional',
    includeExamples = false,
    rewrite = false,
    recipe,
    customRecipes = {},
    variables = {},
    lang = 'en',
    pluginPlatforms = {},
    pluginEnhancers = {},
    enhanceWith = [],
    provider,
    model,
    apiKey,
    apiBase
  } = config;

  let enhancedTask = task;
  let enhancedContext = context;
  let enhancedConstraints = constraints;

  if (rewrite) {
    const llmConfig = { provider, model, apiKey, apiBase };
    if (task) enhancedTask = await enhanceWithLLM(task, llmConfig);
    if (context) enhancedContext = await enhanceWithLLM(context, llmConfig);
    if (constraints) enhancedConstraints = await enhanceWithLLM(constraints, llmConfig);
  }

  const enhanceIds = Array.isArray(enhanceWith) ? enhanceWith : String(enhanceWith || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const id of enhanceIds) {
    const enhancer = pluginEnhancers[id];
    if (!enhancer || typeof enhancer.enhance !== 'function') {
      throw new Error(`Unknown plugin enhancer: "${id}". See --plugins.`);
    }
    if (enhancedTask) enhancedTask = String(enhancer.enhance(enhancedTask));
    if (enhancedContext) enhancedContext = String(enhancer.enhance(enhancedContext));
    if (enhancedConstraints) enhancedConstraints = String(enhancer.enhance(enhancedConstraints));
  }

  const playbook = buildPlaybook(agent, pluginPlatforms);

  if (recipe && getRecipe(recipe, customRecipes)) {
    const rendered = renderRecipe(recipe, {
      task: enhancedTask,
      context: enhancedContext,
      constraints: enhancedConstraints,
      variables
    }, customRecipes);
    return `${rendered}\n\n${playbook}`.trim();
  }

  const agentProfile = templates.agentProfiles[agent] || templates.agentProfiles.generic;
  const domainProfile = templates.domainProfiles[domain] || templates.domainProfiles.general;
  const t = getStrings(lang);

  const role = t.roleLine(agentProfile.title, domainProfile.label);
  const objective = buildObjective(enhancedTask, outputFormat, includeExamples, t);
  const outputSpec = t.outputSpecs[outputFormat] || t.outputSpecs.markdown;
  const inputs = buildInputs(enhancedContext, enhancedTask, t);
  const rules = buildRules(enhancedConstraints, agentProfile, tone, t);

  const prompt = `# ${role}

${t.contextHeading}
${domainProfile.context}
${enhancedContext ? '\n' + enhancedContext : ''}
${rules}

${playbook}

${t.inputsHeading}
${inputs}

${t.objectiveHeading}
${objective}

${t.outputHeading}
${outputSpec}

${includeExamples ? buildExamples(domain, agent, t) : ''}

${t.initHeading}
${t.initBody}
`;

  return prompt.trim();
}

function buildObjective(task, outputFormat, includeExamples, t) {
  const lines = t.objectiveSteps(task || t.insertTask, outputFormat);
  if (includeExamples) {
    lines.push(t.objectiveExamples);
  }
  return lines.join('\n');
}

function buildInputs(context, task, t) {
  const parts = [];
  parts.push(`- ${t.taskLabel}: ${task || t.insertTask}`);
  if (context) {
    parts.push(`- ${t.contextLabel}: ${context}`);
  }
  parts.push(`- ${t.dataLabel}: ${t.insertData}`);
  return parts.join('\n');
}

function buildRules(constraints, agentProfile, tone, t) {
  const parts = [];
  parts.push(`- ${t.toneLabel}: ${tone}.`);
  if (constraints) {
    parts.push(`- ${t.constraintsLabel}: ${constraints}`);
  }
  parts.push(...agentProfile.rules.map(r => `- ${r}`));
  return parts.join('\n');
}

function buildExamples(domain, agent, t) {
  const examples = {
    'code-review': 'Example: If given a Python function, first check for secrets, then logic bugs, then style issues.',
    'security': 'Example: If a hardcoded key is found, flag severity High and suggest env var usage.',
    'lab-build': 'Example: If building a REMnux VM, list prerequisites, install commands, and verification steps.',
    'release-readiness': 'Example: Check LICENSE, secrets, README completeness, and CI status before approving.'
  };
  return `${t.examplesHeading}\n${examples[domain] || 'Example: Keep responses focused, actionable, and scoped to the task.'}`;
}

module.exports = { generate };
