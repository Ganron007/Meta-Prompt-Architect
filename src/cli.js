const fs = require('fs');
const path = require('path');
const { generate } = require('./generator');
const { consultArchitect } = require('./architect');
const { exportPrompt } = require('./exporters');
const { loadEnvChain, resolveLLM } = require('./config');
const { listRecipes, recipeCategories, validateRecipes } = require('./recipes');
const { buildCustomRecipe, saveCustomRecipe, loadCustomRecipes, parseVariables } = require('./custom-recipes');
const { parseChain, buildChain, wrapChainStep } = require('./chain');
const { exportPack, importPack } = require('./recipe-packs');
const { diffLines, summarizeDiff, formatDiff, configChanges } = require('./diff');
const { addHistoryEntry, listHistory, getHistoryEntry, clearHistory } = require('./history');
const { scorePrompt, formatScore } = require('./scorer');

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
  --chain <id1,id2,...>                           Link recipes into a chain with handoffs and quality gates
  --recipes                                         List available recipes and exit
  --create-recipe                                  Build and save a custom recipe (see recipe options below)
  --recipe-name <text>                             Custom recipe name
  --recipe-category <id>                           Custom recipe category (for example: build, security)
  --recipe-role <text>                             Custom recipe role/persona
  --recipe-steps <step|step>                       Workflow steps, separated by | or new lines
  --recipe-rules <rule|rule>                       Hard rules, separated by | or new lines
  --recipe-output <text>                           Required final output format
  --recipe-placeholders <csv>                      Optional custom placeholders (for example: audience,stack)
  --recipe-scope <project|user>                    Save under .mpa/recipes or ~/.mpa/recipes (default: project)
  --recipe-dir <dir>                               Explicit custom recipe directory (load or save)
  --overwrite-recipe                               Replace an existing custom recipe file
  --import-recipe <url|file>                       Import a recipe pack from a file, URL, or GitHub Gist
  --export-pack <category|all>                     Export recipes as a shareable pack JSON (to --out)
  --vars <json>                                    Values for a custom recipe's extra placeholders
  --export <cursorrules|clinerules|agents-md|windsurfrules|opencode|opencode-jsonc|vscode|custom-gpt|antigravity|markdown>  Export format
  --name <filename>                               Output file name without extension
  --out <dir>                                       Output directory (default: ./out)
  --json                                            Machine-readable JSON output
  --score                                           Score prompt quality (6-dimension rubric)
  --validate-recipes                                Validate recipe fields, categories, and placeholders
  --scan                                            Print the scanned project context and exit
  --history                                         List prompt history
  --history-get <id>                                Show a specific prompt from history
  --history-clear                                   Clear prompt history
  --history-replay <id>                             Regenerate a prompt from history
  --history-diff <id1> <id2>                        Diff two history prompts and their configs
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

  # Save a custom recipe in the current project's .mpa/recipes directory:
  prompt-architect --create-recipe --recipe-name "Launch plan" --recipe-category build --recipe-role "product launch lead" --recipe-steps "Plan|Build|Verify" --recipe-rules "State assumptions|Protect secrets" --recipe-output "Launch checklist and owners"
`);
}

function parseArgs(argv) {
  const args = { outputFormat: 'markdown', agent: 'generic', domain: 'general', tone: 'professional', out: './out', name: 'generated-prompt', project: process.cwd() };
  const known = new Set(['--agent', '--agents', '--domain', '--task', '--context', '--constraints', '--project', '--no-project', '--format', '--tone', '--examples', '--rewrite', '--consult', '--provider', '--model', '--api-key', '--api-base', '--recipe', '--chain', '--recipes', '--create-recipe', '--recipe-name', '--recipe-category', '--recipe-role', '--recipe-steps', '--recipe-rules', '--recipe-output', '--recipe-placeholders', '--recipe-scope', '--recipe-dir', '--overwrite-recipe', '--import-recipe', '--export-pack', '--vars', '--pipe', '--export', '--name', '--out', '--json', '--score', '--validate-recipes', '--scan', '--history', '--history-get', '--history-clear', '--history-replay', '--history-diff', '--serve', '--help']);
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
      case '--chain': args.chain = argv[++i]; break;
      case '--recipes': args.recipes = true; break;
      case '--create-recipe': args.createRecipe = true; break;
      case '--recipe-name': args.recipeName = argv[++i]; break;
      case '--recipe-category': args.recipeCategory = argv[++i]; break;
      case '--recipe-role': args.recipeRole = argv[++i]; break;
      case '--recipe-steps': args.recipeSteps = argv[++i]; break;
      case '--recipe-rules': args.recipeRules = argv[++i]; break;
      case '--recipe-output': args.recipeOutput = argv[++i]; break;
      case '--recipe-placeholders': args.recipePlaceholders = argv[++i]; break;
      case '--recipe-scope': args.recipeScope = argv[++i]; break;
      case '--recipe-dir': args.recipeDir = argv[++i]; break;
      case '--overwrite-recipe': args.overwriteRecipe = true; break;
      case '--import-recipe': args.importRecipe = argv[++i]; break;
      case '--export-pack': args.exportPack = argv[++i]; break;
      case '--vars': args.vars = argv[++i]; break;
      case '--pipe': args.pipe = argv[++i]; break;
      case '--provider': args.provider = argv[++i]; break;
      case '--model': args.model = argv[++i]; break;
      case '--api-key': args.apiKey = argv[++i]; break;
      case '--api-base': args.apiBase = argv[++i]; break;
      case '--export': args.export = argv[++i]; break;
      case '--name': args.name = argv[++i]; break;
      case '--out': args.out = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--score': args.score = true; break;
      case '--validate-recipes': args.validateRecipes = true; break;
      case '--scan': args.scan = true; break;
      case '--history': args.history = true; break;
      case '--history-get': args.historyGet = argv[++i]; break;
      case '--history-clear': args.historyClear = true; break;
      case '--history-replay': args.historyReplay = argv[++i]; break;
      case '--history-diff': args.historyDiff = [argv[++i], argv[++i]]; break;
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

  if (args.createRecipe) {
    const recipe = buildCustomRecipe({
      name: args.recipeName,
      category: args.recipeCategory,
      role: args.recipeRole,
      steps: args.recipeSteps,
      hardRules: args.recipeRules,
      outputFormat: args.recipeOutput,
      placeholders: args.recipePlaceholders
    });
    const saved = saveCustomRecipe(recipe, {
      scope: args.recipeScope || 'project',
      project: args.project || process.cwd(),
      recipeDir: args.recipeDir,
      overwrite: args.overwriteRecipe
    });
    if (args.json) console.log(JSON.stringify(saved, null, 2));
    else console.log(`Custom recipe "${saved.recipe.id}" saved to ${saved.filePath}`);
    return;
  }

  const customRecipes = loadCustomRecipes({
    project: args.project || process.cwd(),
    recipeDir: args.recipeDir
  });

  if (args.importRecipe) {
    const result = await importPack(args.importRecipe, {
      scope: args.recipeScope || 'project',
      project: args.project || process.cwd(),
      recipeDir: args.recipeDir,
      overwrite: args.overwriteRecipe
    });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Imported ${result.imported.length} recipe(s) from pack "${result.pack.name}" into ${result.directory}`);
      if (result.skipped.length) console.log(`Skipped ${result.skipped.length} existing: ${result.skipped.join(', ')} (use --overwrite-recipe to replace)`);
    }
    return;
  }

  if (args.exportPack) {
    const pack = exportPack({ category: args.exportPack, customRecipes });
    const outDir = path.resolve(args.out);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const safeName = String(args.name && args.name !== 'generated-prompt' ? args.name : `mpa-pack-${args.exportPack}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(outDir, `${safeName}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
    if (args.json) console.log(JSON.stringify(pack, null, 2));
    else console.log(`Exported ${pack.recipes.length} recipe(s) to ${filePath}`);
    return;
  }

  if (args.validateRecipes) {
    const report = validateRecipes();
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else if (report.valid) {
      console.log(`Recipe validation passed: ${report.recipeCount} recipes across ${report.categoryCount} registered categories.`);
    } else {
      console.error(`Recipe validation failed: ${report.errors.length} issue${report.errors.length === 1 ? '' : 's'} across ${report.recipeCount} recipes.`);
      for (const error of report.errors) console.error(`  - ${error}`);
    }
    if (!report.valid) process.exitCode = 1;
    return;
  }

  if (args.recipes) {
    const grouped = {};
    for (const r of listRecipes(customRecipes)) {
      const cat = r.category || 'build';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    console.log('\nAvailable one-shot recipes:\n');
    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`  ── ${recipeCategories[cat] || cat} ${'─'.repeat(Math.max(0, 44 - (recipeCategories[cat] || cat).length))}\n`);
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

  if (args.historyDiff) {
    const [id1, id2] = args.historyDiff;
    if (!id1 || !id2) { console.error('Error: --history-diff needs two ids, e.g. --history-diff a1b2c3 d4e5f6'); process.exit(1); }
    const a = getHistoryEntry(id1);
    const b = getHistoryEntry(id2);
    if (!a || !b) { console.error(`No history entry for ${!a ? id1 : id2}.`); process.exit(1); }
    const ops = diffLines(a.prompt, b.prompt);
    const summary = summarizeDiff(ops);
    const changes = configChanges(a, b);
    if (args.json) {
      console.log(JSON.stringify({ a: a.id, b: b.id, summary, configChanges: changes, diff: ops }, null, 2));
    } else {
      console.log(`\nDiff ${a.id.slice(-6)} → ${b.id.slice(-6)}  (+${summary.added} / -${summary.removed} lines, ${summary.unchanged} unchanged)`);
      if (changes.length) {
        console.log('\nConfig changes:');
        for (const c of changes) console.log(`  ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
      } else {
        console.log('\nConfig changes: none — output differences come from recipe/template drift or time.');
      }
      console.log('');
      console.log(formatDiff(ops) || '  (identical prompts)');
    }
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
    args.variables = entry.variables;
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

  const variables = parseVariables(args.vars || args.variables);

  const agentList = args.agents ? args.agents.split(',').map(a => a.trim()).filter(Boolean) : [args.agent || 'generic'];
  const chain = args.chain ? buildChain(parseChain(args.chain), customRecipes) : null;
  if (chain && args.consult) console.error('[chain] --consult ignored: chains run in recipe mode.');

  const results = [];
  for (const agent of agentList) {
    if (chain) {
      for (let i = 0; i < chain.length; i++) {
        const agentArgs = { ...args, agent, variables, customRecipes, recipe: chain[i].id };
        const prompt = await generate(agentArgs);
        results.push({ agent, mode: 'chain', prompt: wrapChainStep(chain, i, prompt), chainStep: chain[i], chainSize: chain.length, score: args.score ? scorePrompt(prompt, { agent }) : null });
      }
      continue;
    }
    const agentArgs = { ...args, agent, variables, customRecipes };
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

    results.push({ agent, mode, prompt, score: args.score ? scorePrompt(prompt, { agent }) : null });
  }

  for (const { agent, mode, prompt, chainStep } of results) {
    addHistoryEntry({ agent, mode, prompt, task: args.task, context: args.context, constraints: args.constraints, domain: args.domain, outputFormat: args.outputFormat, tone: args.tone, includeExamples: args.includeExamples, recipe: chainStep ? chainStep.id : args.recipe, variables, consult: args.consult, rewrite: args.rewrite });
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
    for (const { agent, prompt, chainStep } of results) {
      const { ext, content } = exportPrompt(prompt, args.export, args.name);
      const safeName = String(args.name || 'generated-prompt').replace(/[^a-zA-Z0-9._-]/g, '_');
      const suffix = results.length > 1
        ? '-' + String(chainStep ? `step${chainStep.position}-${chainStep.id}` : agent).replace(/[^a-zA-Z0-9._-]/g, '_')
        : '';
      const filePath = path.join(outDir, `${safeName}${suffix}${ext}`);
      fs.writeFileSync(filePath, content, 'utf-8');
      if (!args.json) console.log(`Generated ${args.export} file: ${filePath}`);
    }
  }

  if (args.json) {
    const toJson = r => ({ mode: r.mode, prompt: r.prompt, agent: r.agent, domain: args.domain, ...(r.chainStep ? { chainStep: r.chainStep, chainSize: r.chainSize } : {}), ...(r.score ? { score: r.score } : {}) });
    if (results.length === 1) {
      console.log(JSON.stringify(toJson(results[0]), null, 2));
    } else {
      console.log(JSON.stringify(results.map(toJson), null, 2));
    }
  } else {
    if (results.length === 1) {
      console.log('\n--- Generated Prompt ---\n');
      console.log(results[0].prompt);
    } else {
      for (const { agent, prompt, chainStep, chainSize } of results) {
        console.log(chainStep ? `\n=== ${agent.toUpperCase()} · STEP ${chainStep.position}/${chainSize} ===\n` : `\n=== ${agent.toUpperCase()} ===\n`);
        console.log(prompt);
      }
    }
    for (const { agent, score, chainStep } of results) {
      if (score) console.error(`${results.length > 1 ? `[${chainStep ? `step${chainStep.position}:` : ''}${agent}] ` : ''}${formatScore(score)}`);
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
