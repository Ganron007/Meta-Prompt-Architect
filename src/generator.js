const templates = require('./templates');
const { enhanceWithLLM } = require('./enhancer');
const { buildPlaybook } = require('./platforms');
const { renderRecipe, getRecipe } = require('./recipes');

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

  const playbook = buildPlaybook(agent);

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

  const role = buildRole(agentProfile, domainProfile, enhancedTask);
  const objective = buildObjective(enhancedTask, outputFormat, includeExamples);
  const outputSpec = buildOutputSpec(outputFormat);
  const inputs = buildInputs(enhancedContext, enhancedTask);
  const rules = buildRules(enhancedConstraints, agentProfile, tone);

  const prompt = `# ${role}

## Context & Constraints
${domainProfile.context}
${enhancedContext ? '\n' + enhancedContext : ''}
${rules}

${playbook}

## Inputs
${inputs}

## Objective
${objective}

## Output Format
${outputSpec}

${includeExamples ? buildExamples(domain, agent) : ''}

## Initialization
Introduce yourself, confirm your role, and ask for any missing inputs before proceeding. Be concise.
`;

  return prompt.trim();
}

function buildRole(agentProfile, domainProfile, task) {
  return `Role: ${agentProfile.title} specializing in ${domainProfile.label}`;
}

function buildObjective(task, outputFormat, includeExamples) {
  const lines = [
    `1. Understand the user's core need: ${task || '[INSERT TASK HERE]'}`,
    `2. Break the task into concrete, actionable steps.`,
    `3. Produce a high-quality response in the requested format (${outputFormat}).`
  ];
  if (includeExamples) {
    lines.push('4. Include relevant examples when helpful.');
  }
  return lines.join('\n');
}

function buildInputs(context, task) {
  const parts = [];
  parts.push(`- Task: ${task || '[INSERT TASK HERE]'}`);
  if (context) {
    parts.push(`- Additional Context: ${context}`);
  }
  parts.push(`- Data/Files: [INSERT RELEVANT CONTENT HERE]`);
  return parts.join('\n');
}

function buildRules(constraints, agentProfile, tone) {
  const parts = [];
  parts.push(`- Tone: ${tone}.`);
  if (constraints) {
    parts.push(`- Constraints: ${constraints}`);
  }
  parts.push(...agentProfile.rules.map(r => `- ${r}`));
  return parts.join('\n');
}

function buildOutputSpec(outputFormat) {
  const specs = {
    markdown: 'Use Markdown with clear headings, bullet points, and code blocks where relevant.',
    json: 'Return a JSON object with the requested fields. No markdown, no explanatory text.',
    table: 'Present findings in a Markdown table with clear column headers.',
    code: 'Provide code in a clean, well-commented block. Include usage examples.',
    diagram: 'Provide a text-based diagram (Mermaid, ASCII, or bulleted list) plus explanation.',
    text: 'Return plain text with numbered steps or paragraphs. No special formatting required.'
  };
  return specs[outputFormat] || specs.markdown;
}

function buildExamples(domain, agent) {
  const examples = {
    'code-review': 'Example: If given a Python function, first check for secrets, then logic bugs, then style issues.',
    'security': 'Example: If a hardcoded key is found, flag severity High and suggest env var usage.',
    'lab-build': 'Example: If building a REMnux VM, list prerequisites, install commands, and verification steps.',
    'release-readiness': 'Example: Check LICENSE, secrets, README completeness, and CI status before approving.'
  };
  return `## Examples\n${examples[domain] || 'Example: Keep responses focused, actionable, and scoped to the task.'}`;
}

module.exports = { generate };
