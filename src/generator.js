const templates = require('./templates');
const { enhanceWithLLM } = require('./enhancer');
const { buildPlaybook, getPlatform } = require('./platforms');
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
    projectScan = null,
    model,
    apiKey,
    apiBase,
    reasoning
  } = config;

  let enhancedTask = task;
  let enhancedContext = context;
  let enhancedConstraints = constraints;

  if (rewrite) {
    const llmConfig = { model, apiKey, apiBase, reasoning };
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
  const t = getStrings(lang);
  const grounding = buildGrounding(projectScan, t);
  const loop = buildLoopContract(agent, projectScan, t, pluginPlatforms);
  const honest = buildHonestGates(t);

  const recipeObj = recipe ? getRecipe(recipe, customRecipes) : null;
  const category = recipeObj ? recipeObj.category : null;
  const isSec = securityContext(domain, category);
  const isBuild = BUILD_CATEGORIES.has(category) || domain === 'lab-build';
  const ship = isBuild ? buildShipPlan(projectScan, t) : '';
  const matrix = isBuild ? buildTestMatrix(projectScan, t) : '';
  const safety = isSec ? buildSafetyClause(t) : '';
  const compliance = isSec ? buildCompliance(domain, category, t) : '';

  if (recipeObj) {
    const rendered = renderRecipe(recipe, {
      task: enhancedTask,
      context: enhancedContext,
      constraints: enhancedConstraints,
      variables
    }, customRecipes);
    return [rendered, playbook, grounding, loop, ship, matrix, honest, safety, compliance].filter(Boolean).join('\n\n').trim();
  }

  const agentProfile = templates.agentProfiles[agent] || templates.agentProfiles.generic;
  const domainProfile = templates.domainProfiles[domain] || templates.domainProfiles.general;

  const role = t.roleLine(agentProfile.title, domainProfile.label);
  const objective = buildObjective(enhancedTask, outputFormat, includeExamples, t);
  const outputSpec = t.outputSpecs[outputFormat] || t.outputSpecs.markdown;
  const inputs = buildInputs(enhancedContext, enhancedTask, t);
  const rules = buildRules(enhancedConstraints, agentProfile, tone, t);

  const prompt = [`# ${role}`,

`${t.contextHeading}
${domainProfile.context}
${enhancedContext ? '\n' + enhancedContext : ''}
${rules}`,

playbook,

grounding,

loop,

ship,

matrix,

honest,

safety,

compliance,

`${t.inputsHeading}
${inputs}`,

`${t.objectiveHeading}
${objective}`,

`${t.outputHeading}
${outputSpec}`,

includeExamples ? buildExamples(domain, agent, t) : '',

`${t.initHeading}
${t.initBody}`
  ];

  return prompt.filter(Boolean).join('\n\n').trim();
}

function buildGrounding(scan, t) {
  if (!scan) return '';
  const lines = [t.groundingHeading, ''];
  lines.push(`- ${t.groundingRoot}: ${scan.root}`);
  if (scan.git && scan.git.branch) lines.push(`- ${t.groundingBranch}: ${scan.git.branch}`);
  if (scan.tree) {
    lines.push(`- ${t.groundingStructure}:`);
    lines.push(scan.tree.split('\n').slice(0, 30).join('\n'));
  }
  const cmds = scan.commands && scan.commands.length ? scan.commands.join(' · ') : t.groundingNone;
  lines.push(`- ${t.groundingCommands}: ${cmds}`);
  return lines.join('\n');
}

function buildLoopContract(agent, scan, t, overrides) {
  const p = getPlatform(agent, overrides);
  const cmds = scan && scan.commands && scan.commands.length ? scan.commands.join(' && ') : null;
  const verify = p.terminal
    ? (cmds ? t.loopVerify(cmds) : t.loopVerifyGeneric)
    : t.loopSelfVerify;
  return [t.loopHeading, '', t.loopPlan, t.loopAct, verify, t.loopIterate, t.loopReport].join('\n');
}

const SEC_CATEGORIES = new Set(['security', 'sec-research', 'dfir', 'reverse-eng', 'malware', 'aisec', 'redteam', 'blueteam', 'cloudsec', 'appsec', 'osint', 'crypto', 'ai-security']);
const AI_SEC_CATEGORIES = new Set(['aisec', 'ai-security']);
const BUILD_CATEGORIES = new Set(['build', 'blueprints', 'ai', 'ai-ops']);

function securityContext(domain, recipeCategory) {
  return SEC_CATEGORIES.has(recipeCategory) || domain === 'security' || SEC_CATEGORIES.has(domain);
}

function buildShipPlan(scan, t) {
  const stack = (scan && scan.stack) || [];
  const steps = [];
  if (stack.includes('tauri')) steps.push(t.shipTauri);
  if (stack.includes('dotnet')) steps.push(t.shipDotnet);
  if (stack.includes('node')) steps.push(t.shipNode);
  if (stack.includes('python-ml')) steps.push(t.shipPyML);
  else if (stack.includes('python')) steps.push(t.shipPython);
  if (stack.includes('rust')) steps.push(t.shipRust);
  if (stack.includes('go')) steps.push(t.shipGo);
  if (stack.includes('docker')) steps.push(t.shipDocker);
  if (stack.includes('vagrant')) steps.push(t.shipVagrant);
  if (!steps.length) steps.push(t.shipGeneric);
  const lines = [t.shipHeading, ''];
  steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push(`${steps.length + 1}. ${t.shipRelease}`);
  return lines.join('\n');
}

function buildTestMatrix(scan, t) {
  return [t.testHeading, '', `- ${t.testUnit}`, `- ${t.testIntegration}`, `- ${t.testE2E}`, `- ${t.testCI}`, `- ${t.testCounts}`].join('\n');
}

function buildHonestGates(t) {
  return [t.honestHeading, '', `- ${t.honest1}`, `- ${t.honest2}`, `- ${t.honest3}`, `- ${t.honest4}`].join('\n');
}

function buildSafetyClause(t) {
  return [t.safetyHeading, '', `- ${t.safety1}`, `- ${t.safety2}`, `- ${t.safety3}`, `- ${t.safety4}`].join('\n');
}

function buildCompliance(domain, recipeCategory, t) {
  const ai = AI_SEC_CATEGORIES.has(recipeCategory);
  return [t.complianceHeading, '', ai ? t.complianceAI : t.complianceClassic].join('\n');
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
