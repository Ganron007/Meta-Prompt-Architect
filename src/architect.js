const { callLLM, callLLMStream } = require('./llm');
const { scanProject, summarize } = require('./context');
const templates = require('./templates');
const { buildPlaybook, buildCapabilitiesSummary } = require('./platforms');
const { getRecipe, renderRecipe } = require('./recipes');

const ARCHITECT_SYSTEM = `You are the Chief Operations Architect (COA), an elite Prompt Engineer and Operations Director.

Your sole job: translate a rough request into ONE highly-structured, context-rich, copy-paste-ready prompt that the user will hand to a specialized downstream AI agent (Cursor, DeepSeek, Kimi, Claude, GPT, etc.).

## The Universal Prompt Structure you MUST produce

1. **Role & Persona** — exactly who the downstream agent must be (seniority, specialty, mindset).
2. **Context & Constraints** — the specific background needed, plus strict rules. Ground this in the PROJECT CONTEXT if provided: reference real files, stack, conventions, and repo structure. Never invent files that don't exist.
3. **Inputs (The Data)** — clearly demarcated placeholders like [INSERT FILE CONTENT HERE] where the user must paste data.
4. **The Objective (The Task)** — a numbered, explicit, unambiguous list of what to achieve.
5. **Output Format** — exactly how the response should be structured.

## Hard rules

- Output ONLY the finalized prompt inside ONE markdown code block (fenced with three backticks and the language tag 'markdown'). No preamble, no commentary, no explanation outside the block. If the prompt itself needs code blocks, use four-backtick fences or indented blocks inside it.
- COMPLETENESS IS NON-NEGOTIABLE: carry every concrete detail from the user's request into the final prompt — every step, version tag (e.g. V6.1, V6.2), file path, tool name, ordering, and constraint. Never merge, drop, paraphrase away, or summarize items from the user's list.
- If the user supplies a numbered or arrowed plan, mirror it step-for-step in the Objective section, in the same order, with the same deliverables (including any merge/update/push or verification actions attached to each step).
- Tailor the prompt to the TARGET AGENT: its declared strengths and rules are provided in the request.
- If a request is ambiguous, make the most reasonable assumption and note it as an assumption inside the prompt's Context section — do NOT ask questions.
- Keep the prompt professional, precise, and immediately usable by a solo engineer managing a large portfolio (lab builds, code review, security, feature exploration, release readiness).
- Length scales with complexity: a simple ask gets a tight prompt (~150–300 words); a multi-step plan gets whatever length is required to lose nothing. Never trade away a detail to save words.
- PLATFORM AWARENESS: the target platform's full capabilities (modes, context features, config files, multi-agent support, terminal access) are provided. The prompt MUST include a "Platform Playbook" section that tells the agent exactly how to exploit its own platform's features for this specific task — which mode to use, which context features to leverage, whether to spawn sub-agents, whether to run terminal commands, which config files to update. Never write a platform-generic prompt when platform-specific guidance is available.`;

function buildArchitectRequest(config, projectScan) {
  const agentProfile = templates.agentProfiles[config.agent] || templates.agentProfiles.generic;
  const domainProfile = templates.domainProfiles[config.domain] || templates.domainProfiles.general;
  const caps = buildCapabilitiesSummary(config.agent, config.pluginPlatforms);

  const parts = [
    `## Rough request from the user\n${config.task}`,
    `\n## Target agent: ${config.agent}\nPersona: ${agentProfile.title}\nStrengths & rules to leverage:\n${agentProfile.rules.map(r => `- ${r}`).join('\n')}`,
    `\n## Domain: ${domainProfile.label}\n${domainProfile.context}`
  ];

  parts.push(`\n## PLATFORM CAPABILITIES — ${caps.name} (${caps.type})
The generated prompt MUST include a "Platform Playbook" section exploiting these:
- Modes: ${caps.modes.join(', ')}
- Context features: ${caps.context.join(', ')}
- Config files: ${caps.config.length ? caps.config.join(', ') : 'none'}
- Multi-agent: ${caps.multiAgent}
- Terminal access: ${caps.terminal ? 'yes' : 'no'}
- Key strengths: ${caps.strengths.join('; ')}`);

  if (config.recipe && getRecipe(config.recipe)) {
    const r = getRecipe(config.recipe);
    parts.push(`\n## RECIPE: ${r.label}\nThe user selected the "${r.label}" one-shot recipe. Follow its structure and phases:\n${r.tagline}`);
  }

  if (config.context) parts.push(`\n## Extra context from user\n${config.context}`);
  if (config.constraints) parts.push(`\n## Hard constraints from user\n${config.constraints}`);
  if (config.outputFormat) parts.push(`\n## Desired output format\n${config.outputFormat}`);
  if (config.tone) parts.push(`\n## Desired tone\n${config.tone}`);
  if (config.lang && config.lang !== 'en') parts.push(`\n## Output language\nWrite the entire prompt in ${config.langName || config.lang}. Keep technical terms, file paths, tool names, and code in their original form.`);
  if (projectScan) {
    const rendered = typeof projectScan === 'string'
      ? projectScan
      : (projectScan.files && projectScan.tree ? summarize(projectScan) : JSON.stringify(projectScan, null, 2).slice(0, 6000));
    parts.push(`\n## PROJECT CONTEXT (use to ground the prompt)\n${rendered}`);
  }

  if (config.memory !== false) {
    try {
      const { findSimilarPrompts } = require('./memory');
      const similar = findSimilarPrompts(`${config.task || ''} ${config.context || ''}`);
      if (similar.length) {
        const block = similar.map((s, i) =>
          `${i + 1}. Past task: ${s.task.slice(0, 200)}${s.edited ? ' [human-edited & approved]' : ''}${s.scorePercent !== null ? ` [scored ${s.scorePercent}%]` : ''}\n---\n${s.prompt.slice(0, 1400)}`
        ).join('\n\n');
        parts.push(`\n## SIMILAR PAST PROMPTS (your own history — reuse what worked, improve what did not)
${block}`);
      }
    } catch { /* memory is best-effort */ }
  }

  parts.push(`\nNow produce the final prompt for the ${config.agent} agent, following the Universal Prompt Structure and including the Platform Playbook.`);
  return parts.join('\n');
}

function unwrapPrompt(text) {
  if (!text) return '';
  const open = text.match(/^[ \t]*```(?:markdown|md)?[^\n]*\n/m);
  if (!open) return text.trim();
  const start = open.index + open[0].length;
  const close = text.lastIndexOf('\n```');
  if (close > open.index) return text.slice(start, close).trim();
  return text.slice(start).trim();
}

const REVISE_SYSTEM = `You are a prompt-quality editor. You will be given a draft prompt, its rubric scores, and the original user request.
Rewrite ONLY the draft prompt to fix its weakest rubric dimensions. Rules:
- Keep the user's intent, task, constraints, and every concrete detail intact.
- Do not add generic filler, extra sections, or instructions the user did not ask for.
- Make the goal unmistakable, the inputs concrete, and verification actionable.
- Output only the revised prompt. No commentary, no code fences.`;

async function consultArchitect(config) {
  const projectScan = config.pluginScanner && typeof config.pluginScanner.scan === 'function'
    ? config.pluginScanner.scan(config.project || process.cwd())
    : (config.project ? scanProject(config.project, config.scanOptions || {}) : null);

  const messages = [
    { role: 'system', content: ARCHITECT_SYSTEM },
    { role: 'user', content: buildArchitectRequest(config, projectScan) }
  ];

  const callOpts = { fallbackModel: config.fallbackModel, reasoning: config.reasoning };
  const raw = config.onToken
    ? await callLLMStream(config.model, config.apiKey, config.apiBase, messages, 0.35, { ...callOpts, onToken: config.onToken })
    : await callLLM(config.model, config.apiKey, config.apiBase, messages, 0.35, callOpts);

  const prompt = unwrapPrompt(raw);
  let score = null;
  let refined = false;

  if (!config.onToken && config.refine !== false) {
    const { scorePrompt } = require('./scorer');
    const draftScore = scorePrompt(prompt, { agent: config.agent });
    const threshold = config.refineThreshold ?? 70;
    if (draftScore.percent < threshold) {
      const weak = draftScore.dimensions
        .slice()
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(d => `${d.label}: ${d.score}/${d.max} — ${(d.findings || []).slice(0, 2).join('; ')}`)
        .join('\n');
      const reviseMessages = [
        { role: 'system', content: REVISE_SYSTEM },
        { role: 'user', content: `Original request:\n${config.task}\n\nDraft prompt:\n---\n${prompt}\n---\n\nRubric scores:\n${draftScore.dimensions.map(d => `${d.label}: ${d.score}/${d.max}`).join('\n')}\n\nWeakest dimensions:\n${weak}\n\nRevise the prompt now.` }
      ];
      try {
        const revised = unwrapPrompt(await callLLM(config.model, config.apiKey, config.apiBase, reviseMessages, 0.2, callOpts));
        const revisedScore = scorePrompt(revised, { agent: config.agent });
        if (revisedScore.percent > draftScore.percent) {
          refined = true;
          score = revisedScore;
          return { prompt: revised, raw, scanned: scannedSummary(projectScan, config), score, refined };
        }
      } catch { /* refinement is best-effort */ }
      score = draftScore;
    }
  }

  return {
    prompt,
    raw,
    scanned: scannedSummary(projectScan, config),
    score,
    refined
  };
}

function scannedSummary(projectScan, config) {
  return projectScan ? { root: projectScan.root || config.project || null, files: projectScan.files ? Object.keys(projectScan.files) : [], branch: projectScan.git && projectScan.git.branch } : null;
}

module.exports = { consultArchitect, ARCHITECT_SYSTEM, unwrapPrompt, REVISE_SYSTEM };
