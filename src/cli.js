const fs = require('fs');
const path = require('path');
const { generate } = require('./generator');
const { consultArchitect } = require('./architect');
const { exportPrompt } = require('./exporters');
const { loadEnvChain, resolveLLM } = require('./config');
const { listRecipes } = require('./recipes');
const { addHistoryEntry, listHistory, getHistoryEntry, clearHistory } = require('./history');

function printUsage() {
  console.log(`
Usage: prompt-architect [options]

Modes:
  (default)      Template-based generation — fast, offline
  --consult      The Architect LLM authors the prompt itself (uses the COA
                 meta-prompt + scanned project context). Requires an API key
                 or a local Ollama server.

Options:
  --agent <cursor|deepseek|kimi|claude|gpt|windsurf|cline|opencode|generic>   Target agent (default: generic)
  --agents <cursor,claude,deepseek>                                       Generate for multiple agents at once (batch)
  --domain <lab-build|code-review|security|feature-exploration|release-readiness>  Domain
  --task <text>                                     Brief task description (or rough idea)
  --context <text>                                  Additional context
  --constraints <text>                              Constraints to enforce
  --project <dir>                                   Project to scan for context (default: cwd)
  --no-project                                      Skip project scanning
  --format <markdown|json|table|code|diagram|text>  Desired prompt output format
  --tone <professional|casual|strict>               Tone (default: professional)
  --examples                                        Include examples
  --rewrite                                         Rule/LLM-polish raw input before templating
  --consult                                         The Architect LLM authors the prompt itself
  --provider <openai|deepseek|anthropic|ollama|openai-compatible|mimo>  LLM provider
  --model <model-name>                             LLM model name
  --api-key <key>                                  API key (or set env var)
  --api-base <url>                                Custom API base URL
  --recipe <name>                                 Use a proven one-shot recipe (see --recipes)
  --recipes                                         List available recipes and exit
  --export <cursorrules|clinerules|agents-md|windsurfrules|opencode|opencode-jsonc|vscode|custom-gpt|antigravity|markdown>  Export format
  --name <filename>                               Output file name without extension
  --out <dir>                                       Output directory (default: ./out)
  --json                                            Machine-readable JSON output
  --scan                                            Print the scanned project context and exit
  --history                                         List prompt history
  --history-get <id>                                Show a specific prompt from history
  --history-clear                                   Clear prompt history
  --history-replay <id>                             Regenerate a prompt from history
  --serve                                           Start the web UI server
  --help                                            Show this help

Environment variables:
  OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, OLLAMA_BASE_URL
  (also read from .env in the current directory)

Examples:
  # Context-aware, LLM-authored prompt (run from inside your project):
  prompt-architect --consult --agent cursor --task "harden my RAG api keys" --project .

  # Free/offline via Ollama:
  prompt-architect --consult --agent kimi --task "merge my two scrapers" --provider ollama

  # Classic template mode:
  prompt-architect --agent cursor --domain security --task "Review API key handling" --export cursorrules
`);
}

function parseArgs(argv) {
  const args = { outputFormat: 'markdown', agent: 'generic', domain: 'general', tone: 'professional', out: './out', name: 'generated-prompt', project: process.cwd() };
  const known = new Set(['--agent', '--agents', '--domain', '--task', '--context', '--constraints', '--project', '--no-project', '--format', '--tone', '--examples', '--rewrite', '--consult', '--provider', '--model', '--api-key', '--api-base', '--recipe', '--recipes', '--pipe', '--export', '--name', '--out', '--json', '--scan', '--history', '--history-get', '--history-clear', '--history-replay', '--serve', '--help']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && !known.has(arg)) {
      console.error(`Warning: unknown option "${arg}" ignored.`);
      continue;
    }
    switch (arg) {
      case '--agent': args.agent = argv[++i]; break;
      case '--agents': args.agents = argv[++i]; break;
      case '--domain': args.domain = argv[++i]; break;
      case '--task': args.task = argv[++i]; break;
      case '--context': args.context = argv[++i]; break;
      case '--constraints': args.constraints = argv[++i]; break;
      case '--project': args.project = argv[++i]; break;
      case '--no-project': args.project = false; break;
      case '--format': args.outputFormat = argv[++i]; break;
      case '--tone': args.tone = argv[++i]; break;
      case '--examples': args.includeExamples = true; break;
      case '--rewrite': args.rewrite = true; break;
      case '--consult': args.consult = true; break;
      case '--recipe': args.recipe = argv[++i]; break;
      case '--recipes': args.recipes = true; break;
      case '--pipe': args.pipe = argv[++i]; break;
      case '--provider': args.provider = argv[++i]; break;
      case '--model': args.model = argv[++i]; break;
      case '--api-key': args.apiKey = argv[++i]; break;
      case '--api-base': args.apiBase = argv[++i]; break;
      case '--export': args.export = argv[++i]; break;
      case '--name': args.name = argv[++i]; break;
      case '--out': args.out = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--scan': args.scan = true; break;
      case '--history': args.history = true; break;
      case '--history-get': args.historyGet = argv[++i]; break;
      case '--history-clear': args.historyClear = true; break;
      case '--history-replay': args.historyReplay = argv[++i]; break;
      case '--serve': args.serve = true; break;
      case '--help': args.help = true; break;
    }
  }
  return args;
}

async function main() {
  loadEnvChain();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) { printUsage(); process.exit(0); }
  if (args.serve) { require('./server').start(); return; }

  if (args.recipes) {
    const cats = { build: 'Software Build', security: 'Cybersecurity', 'sec-research': 'Security Research (Lab Methodology)', dfir: 'DFIR — Digital Forensics & Incident Response', 'reverse-eng': 'Reverse Engineering', malware: 'Malware Analysis', aisec: 'AI / ML Security', redteam: 'Red Team Operations', blueteam: 'Blue Team / Detection Engineering', cloudsec: 'Cloud Security', appsec: 'Application Security', osint: 'OSINT / Threat Intelligence', crypto: 'Cryptography', ai: 'AI / Agentic Frameworks', 'ai-security': 'AI × Cybersecurity', 'ai-ops': 'AI × Operations' };
    const grouped = {};
    for (const r of listRecipes()) {
      const cat = r.category || 'build';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    console.log('\nAvailable one-shot recipes:\n');
    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`  ── ${cats[cat] || cat} ${'─'.repeat(Math.max(0, 44 - (cats[cat] || cat).length))}\n`);
      for (const r of items) {
        console.log(`  ${r.id.padEnd(22)} ${r.label}`);
        console.log(`  ${''.padEnd(22)} ${r.tagline}\n`);
      }
    }
    console.log('Usage: prompt-architect --recipe <id> --agent cursor --task "..."');
    return;
  }

  if (args.history) {
    const entries = listHistory();
    if (entries.length === 0) { console.log('No history yet. Generate a prompt first.'); return; }
    console.log('\nPrompt history:\n');
    for (const e of entries) {
      console.log(`  ${e.id.slice(-6)}  ${new Date(e.timestamp).toLocaleString()}  ${e.agent}  ${e.task.slice(0, 50)}`);
    }
    console.log(`\nUse --history-get <id> to view, --history-replay <id> to regenerate.`);
    return;
  }

  if (args.historyClear) {
    clearHistory();
    console.log('History cleared.');
    return;
  }

  if (args.historyGet) {
    const entry = getHistoryEntry(args.historyGet);
    if (!entry) { console.error('No history entry with that id.'); process.exit(1); }
    console.log(entry.prompt);
    return;
  }

  if (args.historyReplay) {
    const entry = getHistoryEntry(args.historyReplay);
    if (!entry) { console.error('No history entry with that id.'); process.exit(1); }
    args.agent = entry.agent;
    args.domain = entry.domain;
    args.task = entry.task;
    args.context = entry.context;
    args.constraints = entry.constraints;
    args.outputFormat = entry.outputFormat;
    args.tone = entry.tone;
    args.includeExamples = entry.includeExamples;
    args.recipe = entry.recipe;
    args.consult = entry.consult;
    args.rewrite = entry.rewrite;
    console.error(`[history] replaying entry ${entry.id.slice(-6)} — ${entry.task.slice(0, 50)}`);
  }

  if (args.scan) {
    const { scanProject, summarize } = require('./context');
    const scan = scanProject(args.project || process.cwd());
    if (args.json) console.log(JSON.stringify(scan, null, 2));
    else console.log(summarize(scan));
    return;
  }

  if (!args.task) {
    console.error('Error: --task is required. See --help.');
    process.exit(1);
  }

  const agentList = args.agents ? args.agents.split(',').map(a => a.trim()).filter(Boolean) : [args.agent || 'generic'];

  const results = [];
  for (const agent of agentList) {
    const agentArgs = { ...args, agent };
    let prompt;
    let mode = 'template';

    if (agentArgs.consult) {
      try {
        resolveLLM(agentArgs);
        const result = await consultArchitect(agentArgs);
        prompt = result.prompt;
        mode = 'consult';
        if (!agentArgs.json && result.scanned && agentList.length === 1) {
          console.error(`[architect] grounded in ${result.scanned.files.length} project files @ ${result.scanned.root}`);
        }
      } catch (err) {
        if (!agentArgs.json && agentList.length === 1) console.error(`[architect] consult failed (${err.message}) — falling back to template mode.`);
        prompt = await generate({ ...agentArgs, rewrite: agentArgs.rewrite === true });
      }
    } else {
      if (agentArgs.rewrite) { try { resolveLLM(agentArgs); } catch { /* rewrite degrades to rule-based */ } }
      prompt = await generate(agentArgs);
    }

    results.push({ agent, mode, prompt });
  }

  for (const { agent, mode, prompt } of results) {
    addHistoryEntry({ agent, mode, prompt, task: args.task, context: args.context, constraints: args.constraints, domain: args.domain, outputFormat: args.outputFormat, tone: args.tone, includeExamples: args.includeExamples, recipe: args.recipe, consult: args.consult, rewrite: args.rewrite });
  }

  if (args.pipe) {
    const { pipeToAgent } = require('./piping');
    for (const { agent, prompt } of results) {
      await pipeToAgent(args.pipe, prompt, args.name || 'generated-prompt');
    }
    return;
  }

  if (args.export) {
    const outDir = path.resolve(args.out);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    for (const { agent, prompt } of results) {
      const { ext, content } = exportPrompt(prompt, args.export, args.name);
      const safeName = String(args.name || 'generated-prompt').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(outDir, `${safeName}${ext}`);
      fs.writeFileSync(filePath, content, 'utf-8');
      if (!args.json) console.log(`Generated ${args.export} file: ${filePath}`);
    }
  }

  if (args.json) {
    if (results.length === 1) {
      const { agent, mode, prompt } = results[0];
      console.log(JSON.stringify({ mode, prompt, agent, domain: args.domain }, null, 2));
    } else {
      console.log(JSON.stringify(results.map(r => ({ mode: r.mode, prompt: r.prompt, agent: r.agent, domain: args.domain })), null, 2));
    }
  } else {
    if (results.length === 1) {
      console.log('\n--- Generated Prompt ---\n');
      console.log(results[0].prompt);
    } else {
      for (const { agent, prompt } of results) {
        console.log(`\n=== ${agent.toUpperCase()} ===\n`);
        console.log(prompt);
      }
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, main };
