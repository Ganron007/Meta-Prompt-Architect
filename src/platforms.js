const platforms = {
  cursor: {
    name: 'Cursor',
    type: 'IDE agent',
    modes: ['Tab completion', 'Inline Edit (Cmd/Ctrl+K)', 'Chat panel', 'Composer (multi-file)', 'Agent mode', 'Background Agent'],
    context: ['@file', '@folder', '@codebase (semantic index)', '@web search', '@docs', '@git diff', '@notepad', '@definitions'],
    config: ['.cursorrules (project system prompt)', '.cursorignore', '.cursor/settings.json'],
    multiAgent: 'Background Agents run parallel tasks in isolated cloud environments; Composer edits multiple files in one pass.',
    terminal: true,
    fileEdit: 'Multi-file atomic edits via Composer/Agent; inline edits via Cmd+K on a selection.',
    strengths: [
      'Whole-codebase semantic search via @codebase',
      'Multi-file Composer edits that stay consistent across imports',
      'Integrated terminal for running builds, tests, and linters mid-task',
      'Background Agents for long-running parallel work',
      '@docs to pull library documentation into context'
    ],
    playbook: [
      'Work in Agent or Composer mode for any task touching more than one file.',
      'Before editing, use @codebase to find existing patterns, utilities, and conventions — then follow them.',
      'Reference specific files with @file instead of pasting contents.',
      'After code changes, run the project lint, typecheck, and test commands in the terminal and fix failures before finishing.',
      'If the task reveals a project convention worth keeping, propose an addition to .cursorrules.',
      'For large refactors, use Background Agent so the main editor stays usable.',
      'Use @docs <library> when working with an unfamiliar dependency instead of guessing APIs.'
    ]
  },

  claude: {
    name: 'Claude / Claude Code',
    type: 'Chat + CLI agent',
    modes: ['Chat (claude.ai)', 'Claude Code (terminal agent)', 'Artifacts (live previews)', 'Projects (persistent context)', 'API / tool use'],
    context: ['CLAUDE.md (project memory)', 'Tool use: Bash, Read, Write, Edit, Glob, Grep', 'Task tool (sub-agents)', 'MCP servers', 'Extended thinking', 'File upload', 'Web fetch'],
    config: ['CLAUDE.md (auto-loaded each session)', '.claude/settings.json', 'MCP server configs'],
    multiAgent: 'The Task tool spawns independent sub-agents (explore, general) that run in parallel and report back — use for research, multi-file discovery, and parallelizable implementation.',
    terminal: true,
    fileEdit: 'Direct filesystem access via Read/Write/Edit tools; surgical string-replacement edits preserve surrounding code.',
    strengths: [
      '200K-token context window holds entire codebases',
      'Extended thinking for complex architectural reasoning',
      'Sub-agent parallelism via the Task tool',
      'MCP servers extend capabilities (DB access, APIs, custom tools)',
      'CLAUDE.md persists conventions across sessions',
      'Artifacts render live HTML/React/SVG previews'
    ],
    playbook: [
      'Read CLAUDE.md first if it exists — it holds project conventions, commands, and prior decisions.',
      'Use the Task tool to parallelize independent subtasks (e.g., "explore auth module" and "explore billing module" simultaneously).',
      'Use the explore sub-agent for codebase discovery before making changes.',
      'Run lint, typecheck, and tests via the Bash tool after every code change; fix failures before reporting done.',
      'Use extended thinking for architectural decisions, trade-off analysis, and multi-step planning.',
      'Write discovered conventions and decisions back to CLAUDE.md so future sessions benefit.',
      'For UI work, use Artifacts to preview components live before committing to files.',
      'Connect MCP servers when the task needs database queries, external APIs, or custom tooling.'
    ]
  },

  opencode: {
    name: 'OpenCode',
    type: 'Terminal agent (CLI)',
    modes: ['Interactive CLI session', 'Sub-agents (explore, general)', 'Skills (loadable instruction packs)', 'MCP servers'],
    context: ['opencode.json / opencode.jsonc (agent config)', 'AGENTS.md', 'LSP diagnostics (type errors in real time)', 'File watching', 'Glob/Grep/Read/Edit/Write tools', 'Bash tool'],
    config: ['opencode.json(c) — agents, permissions, MCP servers, providers', 'AGENTS.md (project instructions)', '.opencode/ directory (skills, agents)'],
    multiAgent: 'Sub-agents (explore for fast codebase search, general for multi-step work) run autonomously and return results — delegate discovery and parallelizable work to them.',
    terminal: true,
    fileEdit: 'Exact string-replacement edits via the Edit tool; Write for new files. LSP integration surfaces type errors immediately.',
    strengths: [
      'LSP-powered type checking catches errors as you edit',
      'Skills inject specialized workflows on demand',
      'Sub-agents parallelize exploration and implementation',
      'MCP servers extend tool access (DBs, APIs, browsers)',
      'Permission system controls what the agent can touch',
      'Provider-agnostic: swap LLMs without changing workflow'
    ],
    playbook: [
      'Read AGENTS.md and opencode.json first for project conventions, allowed commands, and configured agents.',
      'Use the explore sub-agent for codebase discovery (file search, pattern matching) before editing.',
      'Load a relevant skill if one exists for the task domain.',
      'After edits, check LSP diagnostics and run the project test/lint commands via Bash.',
      'Delegate independent research or multi-file tasks to the general sub-agent.',
      'Respect permission rules — do not attempt operations outside the configured allowlist.',
      'Use MCP servers when the task requires database access, web browsing, or external APIs.'
    ]
  },

  deepseek: {
    name: 'DeepSeek',
    type: 'Chat / API model',
    modes: ['Chat (chat.deepseek.com)', 'API (OpenAI-compatible)', 'DeepThink (reasoning mode)'],
    context: ['Long context window (128K+ tokens)', 'File upload', 'Web search (chat.deepseek.com)'],
    config: [],
    multiAgent: 'No built-in multi-agent orchestration — structure the prompt so each response is a self-contained deliverable that can be chained manually.',
    terminal: false,
    fileEdit: 'No direct file access — output complete file contents in code blocks for the user to apply.',
    strengths: [
      'Strong code generation and reasoning at low cost',
      'DeepThink mode for step-by-step complex problem solving',
      '128K+ context handles large codebases in one pass',
      'OpenAI-compatible API for easy integration'
    ],
    playbook: [
      'For complex architectural decisions, request DeepThink-style step-by-step reasoning before the final answer.',
      'Paste full files (not snippets) — the context window handles it and accuracy improves with complete context.',
      'Ask for complete file outputs in fenced code blocks with the file path as a heading.',
      'Break large tasks into numbered phases so each response is a reviewable deliverable.',
      'Request edge-case analysis and test cases alongside implementation.'
    ]
  },

  kimi: {
    name: 'Kimi (Moonshot)',
    type: 'Chat / API model',
    modes: ['Chat (kimi.moonshot.cn)', 'API (OpenAI-compatible)', 'Kimi Code (IDE plugin)'],
    context: ['Ultra-long context (up to 2M tokens)', 'File upload (PDF, code, images)', 'Web search', 'Code interpreter'],
    config: [],
    multiAgent: 'No built-in multi-agent orchestration — use the massive context to hold the entire project and produce comprehensive single-pass outputs.',
    terminal: false,
    fileEdit: 'No direct file access — output complete file contents in code blocks.',
    strengths: [
      'Up to 2M-token context — can hold an entire medium codebase plus documentation',
      'Strong at summarizing and cross-referencing long documents',
      'File upload handles PDFs, spreadsheets, and images natively',
      'Web search for up-to-date library and API information'
    ],
    playbook: [
      'Upload or paste the ENTIRE relevant codebase — Kimi handles contexts other models cannot.',
      'For multi-file tasks, provide all files upfront and ask for a coordinated response.',
      'Use web search to verify current API signatures and library versions.',
      'Ask Kimi to summarize large inputs first, then produce the detailed deliverable.',
      'For document-heavy tasks (specs, RFCs, audits), upload all documents and cross-reference in one pass.'
    ]
  },

  gpt: {
    name: 'ChatGPT / GPT',
    type: 'Chat + API model',
    modes: ['Chat (chat.openai.com)', 'Canvas (collaborative editing)', 'Code Interpreter (sandboxed Python)', 'Custom GPTs', 'API', 'Projects (persistent instructions + files)'],
    context: ['Custom Instructions / Project Instructions', 'File upload', 'Web browsing', 'Code Interpreter (Python sandbox)', 'DALL-E image generation', 'Canvas for iterative code/doc editing'],
    config: ['Custom GPT instructions', 'Project-level instructions and knowledge files'],
    multiAgent: 'No built-in multi-agent — use Custom GPTs as specialized agents and chain outputs between them manually.',
    terminal: false,
    fileEdit: 'Canvas mode allows iterative inline edits; Code Interpreter runs and tests Python in a sandbox.',
    strengths: [
      'Code Interpreter executes Python, tests logic, and generates files',
      'Canvas enables iterative collaborative editing of code and docs',
      'Web browsing for current information',
      'Projects hold persistent instructions and uploaded knowledge',
      'DALL-E for generating UI mockups, diagrams, and assets'
    ],
    playbook: [
      'Use Canvas mode for iterative code or document refinement — edit inline rather than regenerating.',
      'Use Code Interpreter to prototype algorithms, validate logic, and generate data before writing final code.',
      'Set up a Project with persistent instructions (coding style, stack, conventions) and upload key reference files.',
      'Use web browsing to verify current library APIs and best practices.',
      'For UI work, ask DALL-E for a mockup first, then implement to match.',
      'Request complete, runnable code blocks — not diffs or partial updates.'
    ]
  },

  windsurf: {
    name: 'Windsurf (Codeium)',
    type: 'IDE agent',
    modes: ['Cascade (agentic multi-step)', 'Inline editing', 'Chat', 'Supercomplete (Tab)'],
    context: ['@file', '@folder', '@codebase', '@web', 'Memories (persistent learnings)', 'Rules (project instructions)'],
    config: ['Rules (global and workspace)', 'Memories (auto-learned preferences)'],
    multiAgent: 'Cascade runs multi-step agentic flows: reads files, edits multiple files, runs terminal commands, and iterates — all in one flow.',
    terminal: true,
    fileEdit: 'Cascade applies multi-file edits atomically; inline edits for targeted changes.',
    strengths: [
      'Cascade agent chains read → edit → run → fix in one flow',
      'Memories persist learned preferences across sessions',
      'Deep codebase awareness via @codebase indexing',
      'Integrated terminal for build/test loops'
    ],
    playbook: [
      'Use Cascade (agent mode) for multi-step tasks — it reads, edits, runs, and self-corrects in one flow.',
      'Reference files with @file and the full codebase with @codebase for grounded edits.',
      'After changes, let Cascade run tests and lint in the terminal and fix failures.',
      'State conventions explicitly so Windsurf stores them as Memories for future sessions.',
      'Set workspace Rules for project-wide instructions (style, stack, constraints).'
    ]
  },

  cline: {
    name: 'Cline / Roo Code',
    type: 'VS Code extension agent',
    modes: ['Act mode (make changes)', 'Plan mode (research + plan)', 'Architect mode (Roo Code)', 'Ask mode (Q&A)', 'Debug mode (Roo Code)'],
    context: ['.clinerules / .roo/rules (project instructions)', '@file', '@folder', '@codebase', 'MCP servers', 'Browser access', 'Terminal'],
    config: ['.clinerules or .roo/rules-* files per mode', 'MCP server configs', 'Auto-approve settings'],
    multiAgent: 'Roo Code offers mode-switching: Architect plans, Code implements, Debug diagnoses, Ask answers — switch modes to get specialized behavior.',
    terminal: true,
    fileEdit: 'Direct file edits with diff preview and approval; multi-file changes across the workspace.',
    strengths: [
      'Mode-switching (Plan → Act → Debug) for structured workflows',
      'MCP servers for extended tool access',
      'Browser access for testing web UIs',
      'Auto-approve for trusted operations speeds up iteration',
      '.clinerules persist project conventions'
    ],
    playbook: [
      'Start in Plan/Architect mode to research and design before switching to Act/Code mode for implementation.',
      'Use .clinerules to encode project conventions the agent must follow.',
      'Enable auto-approve for read operations and test commands to speed up iteration.',
      'Use the browser tool to visually verify UI changes.',
      'Connect MCP servers for database access, API calls, or custom tooling.',
      'Switch to Debug mode when something breaks — it specializes in root-cause analysis.'
    ]
  },

  generic: {
    name: 'Generic Agent',
    type: 'Any LLM / agent',
    modes: ['Chat / API'],
    context: ['Pasted code and files', 'System prompt / custom instructions'],
    config: [],
    multiAgent: 'If the platform supports sub-agents or tool use, parallelize independent subtasks. Otherwise, structure the prompt in numbered phases for sequential execution.',
    terminal: false,
    fileEdit: 'Output complete file contents in fenced code blocks with the file path as a heading.',
    strengths: [
      'Portable across any LLM or agent platform',
      'Structured prompts work everywhere'
    ],
    playbook: [
      'Provide full file contents rather than snippets or diffs.',
      'Structure the task in numbered phases so each step is a reviewable deliverable.',
      'State the tech stack, versions, and environment explicitly — do not assume the agent knows.',
      'Ask for complete, runnable output — no placeholders, no TODOs.',
      'If the platform supports tool use or terminal access, instruct the agent to run tests after changes.'
    ]
  }
};

function getPlatform(agent, overrides) {
  if (overrides && overrides[agent]) return overrides[agent].normalized || overrides[agent];
  return platforms[agent] || platforms.generic;
}

function buildPlaybook(agent, overrides) {
  const p = getPlatform(agent, overrides);
  const lines = [];
  lines.push(`## ${p.name} Platform Playbook`);
  lines.push('');
  lines.push(`You are running on **${p.name}** (${p.type}). Exploit its full capabilities:`);
  lines.push('');
  p.playbook.forEach((tip, i) => lines.push(`${i + 1}. ${tip}`));
  lines.push('');
  lines.push(`**Available modes:** ${p.modes.join(' · ')}`);
  if (p.context.length) lines.push(`**Context features:** ${p.context.join(', ')}`);
  if (p.config.length) lines.push(`**Config files:** ${p.config.join(', ')}`);
  lines.push(`**Multi-agent:** ${p.multiAgent}`);
  lines.push(`**Terminal access:** ${p.terminal ? 'Yes — run builds, tests, and linters after changes.' : 'No — output complete files for the user to apply.'}`);
  return lines.join('\n');
}

function buildCapabilitiesSummary(agent, overrides) {
  const p = getPlatform(agent, overrides);
  return {
    name: p.name,
    type: p.type,
    modes: p.modes,
    context: p.context,
    config: p.config,
    multiAgent: p.multiAgent,
    terminal: p.terminal,
    strengths: p.strengths
  };
}

module.exports = { platforms, getPlatform, buildPlaybook, buildCapabilitiesSummary };
