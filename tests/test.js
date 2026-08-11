const assert = require('assert');
const path = require('path');
const { generate } = require('../src/generator');
const { exportPrompt } = require('../src/exporters');
const { parseArgs } = require('../src/cli');
const { enhanceWithRules } = require('../src/enhancer');
const { scanProject, summarize } = require('../src/context');
const { unwrapPrompt, ARCHITECT_SYSTEM } = require('../src/architect');
const { loadEnv, resolveLLM } = require('../src/config');
const { listRecipes, renderRecipe, getRecipe, validateRecipes } = require('../src/recipes');
const { buildPlaybook, getPlatform } = require('../src/platforms');
const { addHistoryEntry, listHistory, getHistoryEntry, clearHistory } = require('../src/history');
const { scorePrompt, formatScore } = require('../src/scorer');
const { buildCustomRecipe, validateCustomRecipe, saveCustomRecipe, loadCustomRecipes, parseVariables } = require('../src/custom-recipes');
const { parseChain, buildChain, chainPreamble, wrapChainStep, CHAIN_PRESETS } = require('../src/chain');
const { buildPack, validatePack, exportPack, importPack, isUrl, normalizeSource } = require('../src/recipe-packs');
const { diffLines, summarizeDiff, formatDiff, collapseSameRuns, configChanges } = require('../src/diff');
const { getStrings, resolveLang, SUPPORTED_LANGS } = require('../src/i18n');
const { pipeToAgent, pipeToWindsurf, pipeToContinue, pipeToCody, pipeToCopilot, writeAiderMessageFile } = require('../src/piping');
const { evaluateResponse, checkFormatCompliance, buildJudgeMessages, parseJudgeResponse, formatTestReport } = require('../src/prompt-test');
const { buildGistPayload } = require('../src/gist');
const { editInEditor, confirmApproval, reviewPrompt } = require('../src/review');
const { recordEvent, loadEvents, summarize: summarizeAnalytics, formatAnalytics } = require('../src/analytics');
const { loadPlugins, validatePlugin, normalizePlatform } = require('../src/plugins');
const { heuristicTemplatize, parseTemplatizeResponse, buildTemplatizeMessages, templatizePrompt } = require('../src/templatize');
const { saveProfile, loadProfile, listProfiles, applyProfile, pickProfileFields } = require('../src/profiles');
const { parseStreamLine, streamRequest, callLLMStream } = require('../src/llm');

async function testGenerator() {
  const prompt = await generate({
    agent: 'cursor',
    domain: 'security',
    task: 'Review API key handling',
    context: 'RAG script in REMnux',
    constraints: 'No hardcoded secrets',
    outputFormat: 'markdown',
    tone: 'professional',
    includeExamples: true
  });
  assert(prompt.includes('Role: Senior IDE Pair Programmer'), 'Should include agent role');
  assert(prompt.includes('Review API key handling'), 'Should include task');
  assert(prompt.includes('No hardcoded secrets'), 'Should include constraints');
  console.log('generator: OK');
}

async function testNoRewritePassthrough() {
  const prompt = await generate({
    task: 'pls check my code for bugs',
    agent: 'cursor',
    domain: 'code-review',
    rewrite: false
  });
  assert(prompt.includes('pls check my code for bugs'), 'Without --rewrite, raw text should pass through unchanged');
  console.log('no-rewrite passthrough: OK');
}

async function testRewriteFallback() {
  const prompt = await generate({
    task: 'pls check my code for bugs',
    agent: 'cursor',
    domain: 'code-review',
    rewrite: true
  });
  assert(/Review/i.test(prompt), 'Rule-based rewrite should produce professional wording');
  console.log('rewrite fallback: OK');
}

async function testExporters() {
  const prompt = await generate({ task: 'Test', agent: 'generic' });
  const cr = exportPrompt(prompt, 'cursorrules');
  assert(cr.ext === '.cursorrules' && cr.content.includes('.cursorrules'), 'cursorrules export failed');
  const oc = exportPrompt(prompt, 'opencode');
  assert(oc.ext === '.json' && oc.content.includes('systemPrompt'), 'opencode export failed');
  assert(oc.content.includes('_note'), 'opencode export should include _note');
  const vs = exportPrompt(prompt, 'vscode', 'test');
  assert(vs.ext === '.code-snippets' && vs.content.includes('test'), 'vscode export failed');
  console.log('exporters: OK');
}

function testCLIArgs() {
  const args = parseArgs(['--agent', 'cursor', '--task', 'review', '--export', 'cursorrules', '--rewrite', '--reasoning', 'high', '--consult', '--project', '.', '--validate-recipes']);
  assert(args.agent === 'cursor');
  assert(args.task === 'review');
  assert(args.export === 'cursorrules');
  assert(args.rewrite === true);
  assert(args.reasoning === 'high');
  assert(args.consult === true);
  assert(args.project === '.');
  assert(args.validateRecipes === true);
  console.log('cli args: OK');
}

function testRuleEnhancer() {
  const result = enhanceWithRules('pls check my code for bugs');
  assert(/Review/i.test(result), `Expected professional wording, got: ${result}`);
  assert(!result.includes('generate'), 'Should not replace "get" with "generate"');
  console.log('rule enhancer: OK');
}

function testContextScan() {
  const scan = scanProject(path.join(__dirname, '..'));
  assert(scan, 'scan should return an object');
  assert(scan.files['package.json'], 'should pick up package.json');
  assert(scan.tree.includes('src/'), 'tree should include src/');
  assert(!scan.tree.includes('node_modules'), 'tree must ignore node_modules');
  const summary = summarize(scan);
  assert(summary.includes('package.json'), 'summary should include package.json');
  console.log('context scan: OK');
}

function testArchitectHelpers() {
  const fenced = '```markdown\n# Role: X\n\nDo the thing.\n```';
  assert.strictEqual(unwrapPrompt(fenced), '# Role: X\n\nDo the thing.', 'should unwrap fenced prompt');
  const bare = '# Role: Y\nDo it.';
  assert.strictEqual(unwrapPrompt(bare), bare, 'should pass through unfenced prompt');
  const unterminated = '```markdown\n# Role: Z\nDo it.';
  assert.strictEqual(unwrapPrompt(unterminated), '# Role: Z\nDo it.', 'should handle unterminated fence');
  const nested = '```markdown\n# Plan\n\n```bash\nrun this\n```\n\nStep 2 here.\n```';
  assert.strictEqual(unwrapPrompt(nested), '# Plan\n\n```bash\nrun this\n```\n\nStep 2 here.', 'should keep nested fences intact');
  assert(ARCHITECT_SYSTEM.includes('COMPLETENESS IS NON-NEGOTIABLE'), 'system prompt enforces detail preservation');
  assert(ARCHITECT_SYSTEM.includes('Universal Prompt Structure'), 'system prompt embeds the COA structure');
  console.log('architect helpers: OK');
}

function testConfig() {
  const saved = {};
  for (const k of ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_REASONING', 'OPENAI_FALLBACK_MODEL']) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    assert.throws(() => resolveLLM({}), /OPENAI_MODEL/, 'missing model should throw');
    process.env.OPENAI_MODEL = 'env-model';
    assert.throws(() => resolveLLM({}), /OPENAI_API_KEY/, 'default endpoint without key should throw');
    const local = resolveLLM({ apiBase: 'http://localhost:11434/v1' });
    assert.strictEqual(local.model, 'env-model', 'model resolves from env');
    assert.strictEqual(local.apiBase, 'http://localhost:11434/v1', 'custom base resolves without a key');
    assert.strictEqual(local.apiKey, undefined, 'keyless local server allowed');
    process.env.OPENAI_API_KEY = 'k';
    const def = resolveLLM({ model: 'cli-model' });
    assert.strictEqual(def.apiBase, 'https://api.openai.com/v1', 'default base URL');
    assert.strictEqual(def.model, 'cli-model', 'CLI flag beats env');
    assert.throws(() => resolveLLM({ reasoning: 'extreme' }), /reasoning/i, 'invalid reasoning rejected');
    const r = resolveLLM({ reasoning: 'low' });
    assert.strictEqual(r.reasoning, 'low', 'valid reasoning accepted');
    const b = resolveLLM({ apiBase: 'https://api.test/v1/' });
    assert.strictEqual(b.apiBase, 'https://api.test/v1', 'trailing slash stripped');
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
  console.log('config: OK');
}

function testRecipes() {
  const list = listRecipes();
  const validation = validateRecipes();
  assert(validation.valid, `recipe validation failed: ${validation.errors.join('; ')}`);
  assert.strictEqual(validation.recipeCount, list.length, 'validation should cover every recipe');
  assert(validation.categoryCount >= 16, 'validation should cover all registered categories');
  assert(list.length >= 111, `expected at least 111 recipes, got ${list.length}`);
  const categories = new Set(list.map(r => r.category));
  assert(categories.has('build'), 'should have build category');
  assert(categories.has('security'), 'should have security category');
  assert(categories.has('sec-research'), 'should have sec-research category');
  assert(categories.has('dfir'), 'should have dfir category');
  assert(categories.has('reverse-eng'), 'should have reverse-eng category');
  assert(categories.has('malware'), 'should have malware category');
  assert(categories.has('aisec'), 'should have aisec category');
  assert(categories.has('redteam'), 'should have redteam category');
  assert(categories.has('blueteam'), 'should have blueteam category');
  assert(categories.has('cloudsec'), 'should have cloudsec category');
  assert(categories.has('appsec'), 'should have appsec category');
  assert(categories.has('osint'), 'should have osint category');
  assert(categories.has('crypto'), 'should have crypto category');
  assert(categories.has('ai'), 'should have ai category');
  assert(categories.has('ai-security'), 'should have ai-security category');
  assert(categories.has('ai-ops'), 'should have ai-ops category');
  const r = getRecipe('readme-driven');
  assert(r, 'readme-driven recipe should exist');
  assert(r.template.includes('{{task}}'), 'recipe template should have task placeholder');
  const rendered = renderRecipe('one-shot-game', { task: 'a snake game', context: '', constraints: '' });
  assert(rendered.includes('a snake game'), 'rendered recipe should include the task');
  assert(!rendered.includes('{{task}}'), 'rendered recipe should have no leftover placeholders');
  const aiRecipe = renderRecipe('langgraph-agent', { task: 'a research agent', context: '', constraints: '' });
  assert(aiRecipe.includes('a research agent'), 'AI recipe should interpolate task');
  assert(aiRecipe.includes('StateGraph'), 'LangGraph recipe should reference LangGraph API');
  const secRecipe = renderRecipe('ai-soc-analyst', { task: 'SOC with Splunk and CrowdStrike', context: '', constraints: '' });
  assert(secRecipe.includes('SOC with Splunk and CrowdStrike'), 'AI-security recipe should interpolate');
  const labSolve = renderRecipe('sec-research-solve', { task: 'Achieve RCE on the heap overflow challenge', context: '', constraints: '' });
  assert(labSolve.includes('LAB_SOLVE'), 'sec-research-solve should set LAB_SOLVE mode');
  assert(labSolve.includes('Achieve RCE on the heap overflow challenge'), 'sec-research should interpolate task');
  assert(labSolve.includes('Phase 0'), 'sec-research should include research workflow phases');
  assert(labSolve.includes('non_negotiable_invariants'), 'sec-research should include invariants');
  const labBuild = renderRecipe('sec-research-build', { task: 'Build a SQLi lab', context: '', constraints: '' });
  assert(labBuild.includes('LAB_BUILD'), 'sec-research-build should set LAB_BUILD mode');
  assert(labBuild.includes('DESIGNED_LAB'), 'LAB_BUILD should set DESIGNED_LAB mutation policy');
  const dfirRecipe = renderRecipe('dfir-memory-forensics', { task: 'Analyze RAM dump from compromised server', context: '', constraints: '' });
  assert(dfirRecipe.includes('Analyze RAM dump from compromised server'), 'DFIR recipe should interpolate task');
  assert(dfirRecipe.includes('process'), 'DFIR memory recipe should cover process analysis');
  const cryptoRecipe = renderRecipe('crypto-implementation-review', { task: 'Review AES usage in auth service', context: '', constraints: '' });
  assert(cryptoRecipe.includes('Review AES usage in auth service'), 'crypto recipe should interpolate task');
  assert(cryptoRecipe.includes('Key management'), 'crypto recipe should cover key management');
  assert(renderRecipe('nonexistent', { task: 'x' }) === null, 'unknown recipe returns null');

  const invalid = validateRecipes({
    broken: {
      label: 'Broken',
      tagline: 'Broken recipe',
      category: 'not-registered',
      template: 'Do {{task}} with {{unknown}} and {{unfinished'
    }
  });
  assert(!invalid.valid, 'invalid recipe should fail validation');
  assert(invalid.errors.some(error => error.includes('unregistered category')), 'should report unknown categories');
  assert(invalid.errors.some(error => error.includes('unrecognized placeholder')), 'should report unknown placeholders');
  assert(invalid.errors.some(error => error.includes('unmatched')), 'should report unmatched placeholders');
  console.log('recipes: OK');
}

function testPlatforms() {
  const cursor = getPlatform('cursor');
  assert(cursor.name === 'Cursor', 'cursor platform should resolve');
  assert(cursor.terminal === true, 'cursor should have terminal access');
  const playbook = buildPlaybook('claude');
  assert(playbook.includes('Platform Playbook'), 'playbook should have heading');
  assert(playbook.includes('CLAUDE.md'), 'claude playbook should mention CLAUDE.md');
  assert(playbook.includes('Task tool'), 'claude playbook should mention sub-agents');
  const generic = getPlatform('unknown-agent');
  assert(generic.name === 'Generic Agent', 'unknown agent falls back to generic');
  console.log('platforms: OK');
}

async function testRecipeGeneration() {
  const prompt = await generate({
    agent: 'cursor',
    task: 'a tower defense game',
    recipe: 'one-shot-game'
  });
  assert(prompt.includes('a tower defense game'), 'recipe prompt should include task');
  assert(prompt.includes('Platform Playbook'), 'recipe prompt should include platform playbook');
  assert(prompt.includes('Cursor'), 'recipe prompt should reference the target platform');
  console.log('recipe generation: OK');
}

async function testPlatformInTemplate() {
  const prompt = await generate({
    agent: 'claude',
    domain: 'code-review',
    task: 'Review the auth module'
  });
  assert(prompt.includes('Platform Playbook'), 'template prompt should include platform playbook');
  assert(prompt.includes('CLAUDE.md'), 'claude prompt should reference CLAUDE.md');
  console.log('platform in template: OK');
}

function testNewExporters() {
  const prompt = 'Test prompt content';
  const cr = exportPrompt(prompt, 'clinerules');
  assert(cr.ext === '.clinerules' && cr.content.includes('.clinerules'), 'clinerules export failed');
  const am = exportPrompt(prompt, 'agents-md');
  assert(am.ext === '.md' && am.content.includes('AGENTS.md'), 'agents-md export failed');
  const wr = exportPrompt(prompt, 'windsurfrules');
  assert(wr.ext === '.windsurfrules' && wr.content.includes('.windsurfrules'), 'windsurfrules export failed');
  const cg = exportPrompt(prompt, 'custom-gpt');
  assert(cg.ext === '.json' && cg.content.includes('instructions'), 'custom-gpt export failed');
  console.log('new exporters: OK');
}

function testHistory() {
  clearHistory();
  addHistoryEntry({ agent: 'cursor', mode: 'template', prompt: 'Test prompt', task: 'Test task', domain: 'security' });
  addHistoryEntry({ agent: 'claude', mode: 'consult', prompt: 'Another prompt', task: 'Another task', domain: 'code-review' });
  const list = listHistory();
  assert(list.length === 2, `expected 2 history entries, got ${list.length}`);
  const entry = getHistoryEntry(list[0].id.slice(-6));
  assert(entry, 'should find entry by suffix');
  assert(entry.prompt === 'Another prompt', 'should return correct entry');
  const searched = listHistory({ search: 'security' });
  assert(searched.length === 1, 'search should filter');
  clearHistory();
  assert(listHistory().length === 0, 'clear should empty history');
  console.log('history: OK');
}

async function testBatchGeneration() {
  const { generate } = require('../src/generator');
  const cursorPrompt = await generate({ agent: 'cursor', task: 'Test', domain: 'security' });
  const claudePrompt = await generate({ agent: 'claude', task: 'Test', domain: 'security' });
  assert(cursorPrompt.includes('Cursor Platform Playbook'), 'cursor batch should have cursor playbook');
  assert(claudePrompt.includes('Claude / Claude Code Platform Playbook'), 'claude batch should have claude playbook');
  assert(cursorPrompt !== claudePrompt, 'different agents should produce different prompts');
  console.log('batch generation: OK');
}

async function testScorer() {
  const good = await generate({ agent: 'cursor', domain: 'security', task: 'Review API key handling', context: 'RAG script', constraints: 'No hardcoded secrets' });
  const goodScore = scorePrompt(good, { agent: 'cursor' });
  assert.strictEqual(goodScore.dimensions.length, 6, 'should score 6 dimensions');
  assert.strictEqual(goodScore.maxTotal, 60, 'max total is 60');
  for (const d of goodScore.dimensions) {
    assert(d.score >= 1 && d.score <= 10, `${d.id} score within 1-10`);
    assert(d.label && Array.isArray(d.findings), 'dimension has label and findings');
  }
  const junkScore = scorePrompt('do something good with the code and make it nice', {});
  assert(goodScore.total > junkScore.total, `template prompt (${goodScore.total}) should outscore junk (${junkScore.total})`);
  assert(junkScore.grade === 'F' || junkScore.grade === 'D', 'junk should grade poorly');
  const withPlaceholders = scorePrompt('# Role: X\n\nDo {{task}} with {{context}} now.', {});
  const comp = withPlaceholders.dimensions.find(d => d.id === 'completeness');
  assert(comp.score <= 4, `leftover placeholders should tank completeness, got ${comp.score}`);
  const recipe = await generate({ agent: 'claude', task: 'Analyze RAM dump', recipe: 'dfir-memory-forensics' });
  const recipeScore = scorePrompt(recipe, { agent: 'claude' });
  assert(recipeScore.percent >= 60, `recipe prompt should score at least 60%, got ${recipeScore.percent}%`);
  const formatted = formatScore(goodScore);
  assert(formatted.includes('Prompt Quality') && formatted.includes('Grade'), 'formatScore renders summary');
  console.log('scorer: OK');
}

async function testCustomRecipes() {
  const fs = require('fs');
  const os = require('os');
  const recipe = buildCustomRecipe({
    name: 'Launch plan review',
    category: 'build',
    role: 'product launch lead',
    steps: 'Plan the rollout|Verify gates|Decide go or no-go',
    hardRules: 'State assumptions|Protect secrets',
    outputFormat: 'Launch checklist with owners',
    placeholders: 'audience,stack'
  });
  assert.strictEqual(recipe.id, 'launch-plan-review', 'id should be slugified name');
  assert(recipe.template.includes('{{task}}'), 'template contains {{task}}');
  assert(recipe.template.includes('{{audience}}'), 'template contains custom placeholder');
  assert(recipe.placeholders.includes('audience') && recipe.placeholders.includes('task'), 'placeholders declared');
  assert.throws(() => buildCustomRecipe({ name: 'x', category: 'build', role: 'r', steps: 's', hardRules: 'r', outputFormat: 'f', placeholders: 'Bad Name' }), /Invalid custom placeholder/, 'invalid placeholder name rejected');
  assert.throws(() => buildCustomRecipe({ name: 'x', category: 'build', role: '', steps: 's', hardRules: 'r', outputFormat: 'f' }), /role/, 'missing role rejected');
  assert.throws(() => buildCustomRecipe({ name: 'x', category: 'nope', role: 'r', steps: 's', hardRules: 'r', outputFormat: 'f' }), /unregistered category/, 'unregistered category rejected');
  const bad = { id: 'bad', label: 'Bad', tagline: 't', category: 'build', template: 'no task placeholder', placeholders: ['task', 'context', 'constraints'] };
  assert(!validateCustomRecipe(bad).valid, 'template without {{task}} invalid');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-recipes-'));
  const saved = saveCustomRecipe(recipe, { recipeDir: dir });
  assert(fs.existsSync(saved.filePath), 'recipe file written');
  assert.throws(() => saveCustomRecipe(recipe, { recipeDir: dir }), /already exists/, 'duplicate save rejected without overwrite');
  const loaded = loadCustomRecipes({ recipeDir: dir });
  assert(loaded['launch-plan-review'], 'saved recipe loads back');

  const rendered = renderRecipe('launch-plan-review', { task: 'Ship v2', context: '', constraints: 'No downtime', variables: { audience: 'execs', stack: 'node' } }, loaded);
  assert(rendered.includes('Ship v2'), 'custom recipe interpolates task');
  assert(rendered.includes('execs'), 'custom recipe interpolates custom variable');
  assert(!rendered.includes('{{audience}}'), 'no leftover custom placeholders');
  const listed = listRecipes(loaded);
  const entry = listed.find(r => r.id === 'launch-plan-review');
  assert(entry && entry.source === 'custom', 'custom recipe listed with source=custom');
  assert(listed.filter(r => r.source === 'bundled').length >= 111, 'bundled recipes still listed');

  const vars = parseVariables('{"audience":"execs"}');
  assert.strictEqual(vars.audience, 'execs', 'parseVariables parses JSON object');
  assert.throws(() => parseVariables('[1,2]'), /JSON object/, 'parseVariables rejects arrays');

  const prompt = await generate({ agent: 'cursor', task: 'Ship v2', recipe: 'launch-plan-review', customRecipes: loaded, variables: { audience: 'execs', stack: 'node' } });
  assert(prompt.includes('product launch lead'), 'generate uses custom recipe role');
  assert(prompt.includes('Platform Playbook'), 'generate appends platform playbook to custom recipe');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('custom recipes: OK');
}

async function testChaining() {
  assert.throws(() => parseChain('only-one'), /at least two/, 'single recipe chain rejected');
  const ids = parseChain('prd-then-build, saas-starter ,readme-driven');
  assert.deepStrictEqual(ids, ['prd-then-build', 'saas-starter', 'readme-driven'], 'chain ids parsed and trimmed');
  assert.throws(() => buildChain(['prd-then-build', 'nope']), /Unknown recipe in chain: "nope" \(step 2\)/, 'unknown chain recipe rejected with position');
  const chain = buildChain(ids);
  assert.strictEqual(chain.length, 3);
  assert.strictEqual(chain[0].position, 1);

  const first = chainPreamble(chain, 0);
  const middle = chainPreamble(chain, 1);
  const last = chainPreamble(chain, 2);
  assert(first.includes('step 1 of 3'), 'preamble states position');
  assert(first.includes('first step'), 'first step has no handoff in');
  assert(first.includes('saas-starter'), 'first step hands off to second');
  assert(middle.includes('prd-then-build') && middle.includes('readme-driven'), 'middle step references both neighbors');
  assert(middle.includes('Handoff Summary'), 'middle step requires handoff summary');
  assert(last.includes('final step'), 'last step flagged');
  for (const p of [first, middle, last]) {
    assert(p.includes('Quality gate'), 'every step has a quality gate');
    assert(p.includes('Context carryover'), 'every step has carryover rules');
  }

  const wrapped = wrapChainStep(chain, 0, 'PROMPT BODY');
  assert(wrapped.startsWith('═══ CHAIN STEP 1/3 — prd-then-build'), 'wrap adds step header');
  assert(wrapped.includes('PROMPT BODY'), 'wrap keeps prompt body');

  const prompt = await generate({ agent: 'cursor', task: 'kanban app', recipe: chain[0].id });
  const full = wrapChainStep(chain, 0, prompt);
  assert(full.includes('Platform Playbook'), 'chained prompt keeps platform playbook');
  assert(full.includes('kanban app'), 'chained prompt keeps task');
  console.log('chaining: OK');
}

async function testRecipePacks() {
  const fs = require('fs');
  const os = require('os');
  assert(!isUrl('pack.json') && isUrl('https://example.com/pack.json'), 'isUrl detects URLs');
  const gist = normalizeSource('https://gist.github.com/octocat/aa5a315d61ae9438b18d');
  assert(gist === 'https://gist.githubusercontent.com/octocat/aa5a315d61ae9438b18d/raw', `gist URL normalized to raw, got ${gist}`);
  assert.strictEqual(normalizeSource('plain-file.json'), 'plain-file.json', 'file source unchanged');

  const pack = exportPack({ category: 'crypto' });
  assert.strictEqual(pack.format, 'mpa-recipe-pack', 'pack has format marker');
  assert.strictEqual(pack.recipes.length, 3, 'crypto pack has 3 recipes');
  assert(pack.recipes.every(r => r.id && Array.isArray(r.placeholders)), 'exported recipes carry id + placeholders');
  assert(validatePack(pack).valid, 'exported pack passes validation');
  assert.throws(() => exportPack({ category: 'nope' }), /No recipes in category/, 'unknown category rejected');
  const all = exportPack({ category: 'all' });
  assert(all.recipes.length >= 111, 'all pack exports the full book');
  assert(!validatePack({ format: 'mpa-recipe-pack', name: 'x', recipes: [{ id: 'bad' }] }).valid, 'invalid recipe in pack rejected');
  assert.throws(() => buildPack({ name: 'x', recipes: [] }), /at least one recipe/, 'empty pack rejected');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-pack-'));
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-store-'));
  const file = path.join(dir, 'pack.json');
  fs.writeFileSync(file, JSON.stringify(pack, null, 2));
  const first = await importPack(file, { recipeDir: store });
  assert.strictEqual(first.imported.length, 3, 'first import saves 3 recipes');
  const second = await importPack(file, { recipeDir: store });
  assert.strictEqual(second.imported.length, 0, 're-import skips existing');
  assert.strictEqual(second.skipped.length, 3, 'skipped ids reported');
  const third = await importPack(file, { recipeDir: store, overwrite: true });
  assert.strictEqual(third.imported.length, 3, 'overwrite re-imports');
  const loaded = loadCustomRecipes({ recipeDir: store });
  assert(loaded['crypto-pqc-migration'], 'imported recipes load from store');
  const rendered = renderRecipe('crypto-pqc-migration', { task: 'PQC audit', context: '', constraints: '' }, loaded);
  assert(rendered.includes('PQC audit'), 'imported recipe renders');
  const badFile = path.join(dir, 'bad.json');
  fs.writeFileSync(badFile, '{"format":"mpa-recipe-pack","name":"x","recipes":[{"id":"bad"}]}');
  await assert.rejects(() => importPack(badFile, { recipeDir: store }), /Invalid recipe pack/, 'invalid pack rejected');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(store, { recursive: true, force: true });
  console.log('recipe packs: OK');
}

async function testDiff() {
  const ops = diffLines('a\nb\nc', 'a\nx\nc');
  assert.deepStrictEqual(ops.map(o => o.type), ['same', 'del', 'add', 'same'], 'LCS diff marks change');
  const summary = summarizeDiff(ops);
  assert(summary.added === 1 && summary.removed === 1 && summary.unchanged === 2, 'summary counts');
  assert.strictEqual(diffLines('same', 'same').filter(o => o.type !== 'same').length, 0, 'identical prompts produce no changes');
  assert.strictEqual(diffLines('', 'new').filter(o => o.type === 'add').length, 1, 'empty→content is one add');
  const long = diffLines(Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n'), Array.from({ length: 20 }, (_, i) => i === 10 ? 'CHANGED' : `line${i}`).join('\n'));
  const collapsed = collapseSameRuns(long, 2);
  assert(collapsed.some(o => o.type === 'gap'), 'long unchanged runs collapse to a gap');
  const text = formatDiff(ops);
  assert(text.includes('- b') && text.includes('+ x'), 'formatDiff prefixes +/-');

  const changes = configChanges({ agent: 'cursor', task: 'x', domain: 'security' }, { agent: 'claude', task: 'x', domain: 'security' });
  assert.strictEqual(changes.length, 1, 'one config field changed');
  assert.strictEqual(changes[0].field, 'agent');
  assert.strictEqual(configChanges({ agent: 'cursor' }, { agent: 'cursor' }).length, 0, 'no changes detected');

  clearHistory();
  addHistoryEntry({ agent: 'cursor', mode: 'template', prompt: 'line one\nline two', task: 't1', domain: 'security' });
  addHistoryEntry({ agent: 'claude', mode: 'template', prompt: 'line one\nline 2', task: 't1', domain: 'security' });
  const list = listHistory();
  const a = getHistoryEntry(list[1].id.slice(-6));
  const b = getHistoryEntry(list[0].id.slice(-6));
  const realOps = diffLines(a.prompt, b.prompt);
  assert(summarizeDiff(realOps).added === 1 && summarizeDiff(realOps).removed === 1, 'history entries diff');
  assert(configChanges(a, b).some(c => c.field === 'agent'), 'history config diff catches agent change');
  clearHistory();
  console.log('diff: OK');
}

async function testI18n() {
  assert.strictEqual(resolveLang('es-ES'), 'es', 'locale code normalized');
  assert.strictEqual(resolveLang('xx'), 'en', 'unknown language falls back to English');
  assert(SUPPORTED_LANGS.includes('ja') && SUPPORTED_LANGS.includes('zh'), 'ja and zh supported');
  for (const lang of SUPPORTED_LANGS) {
    const t = getStrings(lang);
    assert(t.contextHeading.startsWith('## '), `${lang} has context heading`);
    assert(typeof t.roleLine === 'function' && t.roleLine('A', 'B').includes('A'), `${lang} roleLine works`);
    assert(t.objectiveSteps('task', 'markdown').length === 3, `${lang} objective steps`);
    assert(Object.keys(t.outputSpecs).length === 6, `${lang} has all output specs`);
  }

  const es = await generate({ agent: 'cursor', domain: 'security', task: 'Review API key handling', lang: 'es' });
  assert(es.includes('Rol: Senior IDE Pair Programmer especializado en Security Review & Hardening'), 'es role line');
  assert(es.includes('## Contexto y restricciones'), 'es context heading');
  assert(es.includes('## Objetivo'), 'es objective heading');
  assert(es.includes('Review API key handling'), 'user task stays verbatim');
  assert(es.includes('Platform Playbook'), 'playbook stays English');
  const ja = await generate({ agent: 'claude', task: '認証モジュールをレビュー', lang: 'ja' });
  assert(ja.includes('ロール:'), 'ja role line');
  assert(ja.includes('認証モジュールをレビュー'), 'ja task verbatim');
  assert(ja.includes('## 目的'), 'ja objective heading');
  const zh = await generate({ agent: 'gpt', task: 'test', lang: 'zh', outputFormat: 'json' });
  assert(zh.includes('## 输出格式'), 'zh output heading');
  assert(zh.includes('JSON 对象'), 'zh json spec translated');
  const en = await generate({ agent: 'cursor', domain: 'security', task: 'Review API key handling' });
  assert(en.includes('# Role: Senior IDE Pair Programmer specializing in Security Review & Hardening'), 'default English unchanged');
  console.log('i18n: OK');
}

function testPiping() {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-pipe-'));

  const wf = pipeToWindsurf('PROMPT BODY', 'test', dir);
  assert(wf.endsWith('.windsurfrules') && fs.readFileSync(wf, 'utf8').includes('PROMPT BODY'), 'windsurf writes .windsurfrules');

  const cf = pipeToContinue('PROMPT BODY', 'My Command!', dir);
  assert(cf.endsWith(path.join('.continue', 'prompts', 'My_Command_.prompt')), 'continue writes .continue/prompts');
  assert(fs.readFileSync(cf, 'utf8').includes('description: My_Command_'), 'continue prompt has frontmatter');

  const cody1 = pipeToCody('FIRST PROMPT', 'cmd-one', dir);
  pipeToCody('SECOND PROMPT', 'cmd-two', dir);
  const codyJson = JSON.parse(fs.readFileSync(cody1, 'utf8'));
  assert(codyJson.commands['cmd-one'].prompt === 'FIRST PROMPT', 'cody keeps first command');
  assert(codyJson.commands['cmd-two'].prompt === 'SECOND PROMPT', 'cody merges second command');

  const cop1 = pipeToCopilot('COPILOT PROMPT', 'sec-review', dir);
  assert(cop1.endsWith(path.join('.github', 'copilot-instructions.md')), 'copilot path');
  pipeToCopilot('MORE INSTRUCTIONS', 'api-review', dir);
  const copContent = fs.readFileSync(cop1, 'utf8');
  assert(copContent.includes('COPILOT PROMPT') && copContent.includes('MORE INSTRUCTIONS'), 'copilot appends without clobbering');

  const aiderFile = writeAiderMessageFile('AIDER PROMPT');
  assert(fs.existsSync(aiderFile) && fs.readFileSync(aiderFile, 'utf8') === 'AIDER PROMPT', 'aider message file written');
  fs.unlinkSync(aiderFile);

  assert.throws(() => pipeToAgent('nope', 'x', 'n', dir), /Unknown pipe target.*aider.*windsurf.*continue.*cody.*copilot/, 'unknown target lists all supported agents');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('piping: OK');
}

function testPromptTesting() {
  assert(checkFormatCompliance('{"a": 1}', 'json').pass, 'json format passes on valid JSON');
  assert(checkFormatCompliance('```json\n{"a": 1}\n```', 'json').pass, 'fenced JSON passes');
  assert(!checkFormatCompliance('not json at all, just prose', 'json').pass, 'json format fails on prose');
  assert(checkFormatCompliance('| a | b |\n|---|---|', 'table').pass, 'table format detected');
  assert(!checkFormatCompliance('no table here\njust lines of text', 'table').pass, 'table format rejects prose');
  assert(checkFormatCompliance('Here is code:\n```js\nx()\n```', 'code').pass, 'code format detected');
  assert(checkFormatCompliance('# Heading\n- bullet', 'markdown').pass, 'markdown format detected');

  const good = evaluateResponse('# Report\n\n- Finding one with substantial detail about the issue\n- Finding two with even more supporting detail here\n- Finding three concludes the entire analysis properly', { outputFormat: 'markdown', criteria: ['Finding one'] });
  assert.strictEqual(good.verdict, 'pass', 'good response passes');
  assert.strictEqual(good.checks.length, 3, 'substance + format + criterion checks');
  const bad = evaluateResponse('short', { outputFormat: 'json', criteria: ['missing-keyword'] });
  assert.strictEqual(bad.verdict, 'fail', 'bad response fails');
  assert(bad.checks.filter(c => !c.pass).length === 3, 'all three checks fail');

  const msgs = buildJudgeMessages('THE PROMPT', 'THE RESPONSE');
  assert(msgs.length === 2 && msgs[0].role === 'system' && msgs[1].content.includes('THE PROMPT') && msgs[1].content.includes('THE RESPONSE'), 'judge messages built');

  const judged = parseJudgeResponse('{"relevance": 8, "completeness": 7, "formatCompliance": 9, "reasoning": "solid"}');
  assert(judged.relevance === 8 && judged.formatCompliance === 9, 'judge JSON parsed');
  const fenced = parseJudgeResponse('```json\n{"relevance": 6, "completeness": 6, "formatCompliance": 6}\n```');
  assert(fenced.relevance === 6, 'fenced judge JSON parsed');
  assert.throws(() => parseJudgeResponse('no json here'), /no JSON object/, 'judge non-JSON rejected');
  assert.throws(() => parseJudgeResponse('{"relevance": 99, "completeness": 5, "formatCompliance": 5}'), /out of range/, 'judge out-of-range rejected');

  const report = formatTestReport({ verdict: 'pass', evaluation: good, judge: judged });
  assert(report.includes('PASS') && report.includes('relevance 8/10'), 'report renders checks and judge');
  console.log('prompt testing: OK');
}

async function testCollaboration() {
  const fs = require('fs');
  const os = require('os');
  const pack = exportPack({ category: 'crypto' });
  const payload = buildGistPayload(pack);
  assert(payload.description.includes('crypto'), 'gist description names the pack');
  assert.strictEqual(payload.public, false, 'gists default to secret');
  const gistFile = Object.keys(payload.files)[0];
  assert(gistFile.endsWith('.json'), 'gist file is JSON');
  assert(JSON.parse(payload.files[gistFile].content).recipes.length === 3, 'gist embeds the full pack');
  const named = buildGistPayload(pack, { description: 'custom', public: true });
  assert(named.description === 'custom' && named.public === true, 'gist options honored');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-review-'));
  const reviewFile = path.join(dir, 'review.md');
  const fakeEditor = `node -e "require('fs').appendFileSync(process.argv[1], '\\nEDITED LINE')"`;
  const edited = editInEditor('ORIGINAL', { editor: fakeEditor, filePath: reviewFile });
  assert(edited.includes('ORIGINAL') && edited.includes('EDITED LINE'), 'editor modifications are read back');
  assert(!fs.existsSync(reviewFile), 'temp review file cleaned up');

  assert.strictEqual(await confirmApproval('test?', Object.create(process.stdin, { isTTY: { value: false } })), true, 'non-TTY auto-approves');
  const outcome = await reviewPrompt('BASE PROMPT', { editor: fakeEditor, filePath: path.join(dir, 'r2.md'), input: Object.create(process.stdin, { isTTY: { value: false } }) });
  assert(outcome.approved && outcome.changed && outcome.prompt.includes('EDITED LINE'), 'review flow returns edited + approved');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('collaboration: OK');
}

function testAnalytics() {
  const fs = require('fs');
  const os = require('os');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-analytics-')), 'analytics.json');
  recordEvent('generate', { agent: 'cursor', mode: 'template', domain: 'security', recipe: 'one-shot-game', scorePercent: 80 }, file);
  recordEvent('generate', { agent: 'cursor', mode: 'template', domain: 'build', recipe: null }, file);
  recordEvent('generate', { agent: 'claude', mode: 'consult', domain: 'security', scorePercent: 60 }, file);
  recordEvent('export', { format: 'cursorrules', agent: 'cursor' }, file);
  recordEvent('test', { agent: 'cursor', verdict: 'pass' }, file);

  const events = loadEvents(file);
  assert.strictEqual(events.length, 5, 'events recorded and reloaded');
  const s = summarizeAnalytics(events);
  assert.strictEqual(s.generated, 3, 'generate events counted');
  assert.strictEqual(s.byAgent[0].value, 'cursor', 'cursor most used');
  assert.strictEqual(s.byAgent[0].count, 2, 'cursor count 2');
  assert.strictEqual(s.byRecipe[0].value, 'one-shot-game', 'recipe tracked');
  assert.strictEqual(s.byExportFormat[0].value, 'cursorrules', 'export format tracked');
  assert.deepStrictEqual(s.tests, { total: 1, passed: 1 }, 'test pass rate');
  assert.strictEqual(s.quality.scoredPrompts, 2, 'scored prompts counted');
  assert.strictEqual(s.quality.avgPercent, 70, 'avg quality (80+60)/2');
  assert.strictEqual(s.quality.overTime.length, 1, 'quality trend grouped by day');

  const rendered = formatAnalytics(s);
  assert(rendered.includes('cursor') && rendered.includes('avg 70%'), 'formatAnalytics renders');
  const empty = summarizeAnalytics([]);
  assert.strictEqual(empty.quality.avgPercent, null, 'empty summary has null avg');
  assert.strictEqual(loadEvents(path.join(os.tmpdir(), 'nope-does-not-exist.json')).length, 0, 'missing file yields no events');
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
  console.log('analytics: OK');
}

async function testPlugins() {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-plugins-'));

  fs.writeFileSync(path.join(dir, 'yaml-exporter.js'), `module.exports = { name: 'YAML exporter', type: 'exporter', id: 'yaml', ext: '.yaml', format: (prompt) => 'prompt: |\\n  ' + prompt.split('\\n').join('\\n  ') };`);
  fs.writeFileSync(path.join(dir, 'acme-platform.js'), `module.exports = { name: 'Acme Agent', type: 'platform', id: 'acme', agentType: 'IDE agent', modes: ['Turbo mode'], context: ['@acme'], config: ['.acmerc'], multiAgent: 'none', terminal: true, strengths: ['fast'], playbook: ['Use Turbo mode for everything.'] };`);
  fs.writeFileSync(path.join(dir, 'shout-enhancer.js'), `module.exports = { name: 'Shout', type: 'enhancer', id: 'shout', enhance: (text) => text.toUpperCase() };`);
  fs.writeFileSync(path.join(dir, 'env-scanner.js'), `module.exports = { name: 'Env scanner', type: 'scanner', id: 'env-scan', scan: (dir) => ({ root: dir, marker: 'env-scan-ran' }) };`);
  fs.writeFileSync(path.join(dir, 'broken-plugin.js'), `module.exports = { name: 'Broken', type: 'exporter' };`);
  fs.writeFileSync(path.join(dir, 'not-a-plugin.js'), `module.exports = 42;`);

  const plugins = loadPlugins({ pluginDir: dir });
  assert.deepStrictEqual(plugins.loaded.sort(), ['enhancer:shout', 'exporter:yaml', 'platform:acme', 'scanner:env-scan'], 'all four plugin types load');
  assert.strictEqual(plugins.errors.length, 2, 'invalid plugins collected as errors');
  assert(plugins.errors.some(e => e.file.includes('broken-plugin') && e.error.includes('"ext"')), 'broken exporter error explained');
  assert(plugins.errors.some(e => e.file.includes('not-a-plugin')), 'non-object plugin rejected');

  assert(validatePlugin({ name: 'x', type: 'nope', id: 'x' })[0].includes('"type"'), 'bad type rejected');
  const normalized = normalizePlatform(require(path.join(dir, 'acme-platform.js')));
  assert.strictEqual(normalized.type, 'IDE agent', 'platform agentType normalized');

  const { buildPlaybook } = require('../src/platforms');
  const playbook = buildPlaybook('acme', plugins.platforms);
  assert(playbook.includes('Acme Agent Platform Playbook') && playbook.includes('Turbo mode'), 'plugin platform playbook renders');

  const out = exportPrompt('PROMPT BODY', 'yaml', 'test', plugins.exporters);
  assert(out.ext === '.yaml' && out.content.startsWith('prompt: |'), 'plugin exporter formats output');
  const fallback = exportPrompt('PROMPT BODY', 'cursorrules', 'test', plugins.exporters);
  assert(fallback.ext === '.cursorrules', 'built-in exporters unaffected');

  const prompt = await generate({ agent: 'acme', task: 'do the thing', enhanceWith: 'shout', pluginPlatforms: plugins.platforms, pluginEnhancers: plugins.enhancers });
  assert(prompt.includes('DO THE THING'), 'plugin enhancer uppercased the task');
  assert(prompt.includes('Acme Agent Platform Playbook'), 'plugin platform used in generation');
  await assert.rejects(() => generate({ task: 'x', enhanceWith: 'nope', pluginEnhancers: plugins.enhancers }), /Unknown plugin enhancer/, 'unknown enhancer rejected');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('plugins: OK');
}

async function testTemplatize() {
  const sample = '# Role: Senior release engineer\n\n## Workflow\n1. Inventory the release surface and list every artifact.\n2. Verify each quality gate with concrete evidence.\n\n## Rules\n- Do not invent evidence.\n- Never skip unresolved blockers.\n\n## Output Format\nA prioritized checklist with owners.';
  const draft = heuristicTemplatize(sample, { name: 'Release gate review' });
  assert.strictEqual(draft.role, 'Senior release engineer', 'role extracted from heading');
  assert.strictEqual(draft.steps.length, 2, 'steps extracted from numbered list');
  assert(draft.steps[0].includes('Inventory the release surface'), 'step content preserved');
  assert.deepStrictEqual(draft.hardRules, ['Do not invent evidence', 'Never skip unresolved blockers'], 'rules extracted');
  assert(draft.outputFormat.includes('prioritized checklist'), 'output format extracted');

  const withPlaceholders = 'You are a migration lead.\n\n1. Assess {{source_stack}} thoroughly.\n2. Plan the move to the target platform.\n\n- Never migrate without a backup.\n\n## Output\nA phased migration plan.';
  const ph = heuristicTemplatize(withPlaceholders, { name: 'x' });
  assert.deepStrictEqual(ph.placeholders, ['source_stack'], 'custom placeholders extracted');

  assert.throws(() => heuristicTemplatize('just some prose with no structure at all', {}), /role|steps/, 'unstructured prompt rejected with guidance');

  const parsed = parseTemplatizeResponse('{"label": "L", "tagline": "t", "role": "r", "steps": ["a"], "hardRules": ["b"], "outputFormat": "f", "placeholders": ["p"]}');
  assert(parsed.label === 'L' && parsed.steps.length === 1, 'LLM response parsed');
  const fenced = parseTemplatizeResponse('```json\n{"label": "L2", "steps": ["a", "b"]}\n```');
  assert(fenced.label === 'L2' && fenced.hardRules.length === 1, 'fenced JSON parsed with defaults');
  assert.throws(() => parseTemplatizeResponse('no json'), /no JSON object/, 'non-JSON rejected');
  assert.throws(() => parseTemplatizeResponse('{"steps": []}'), /"label"|"steps"/, 'missing fields rejected');

  const msgs = buildTemplatizeMessages('PROMPT', { name: 'N', category: 'build' });
  assert(msgs.length === 2 && msgs[1].content.includes('PROMPT') && msgs[1].content.includes('N'), 'templatize messages built');

  const recipe = await templatizePrompt(sample, { offline: true, name: 'Release gate review', category: 'build' });
  assert.strictEqual(recipe.id, 'release-gate-review', 'offline templatize produces a valid recipe');
  assert(recipe.template.includes('{{task}}'), 'recipe template valid');
  const rendered = renderRecipe(recipe.id, { task: 'Ship v2', context: '', constraints: '' }, { [recipe.id]: recipe });
  assert(rendered.includes('Ship v2') && rendered.includes('Senior release engineer'), 'extracted recipe renders');
  console.log('templatize: OK');
}

function testProfiles() {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-profiles-'));

  const picked = pickProfileFields({ agent: 'cursor', domain: 'security', apiKey: 'SECRET', task: 'x', _provided: new Set() });
  assert(!('apiKey' in picked), 'apiKey never persisted to profiles');
  assert(!('task' in picked) && !('_provided' in picked), 'task and internals excluded');
  assert(picked.agent === 'cursor' && picked.domain === 'security', 'config fields picked');

  const saved = saveProfile('sec-review', { agent: 'cursor', domain: 'security', outputFormat: 'table', score: true, apiKey: 'SECRET' }, { profileDir: dir });
  assert(fs.existsSync(saved.filePath), 'profile written');
  assert.throws(() => saveProfile('sec-review', {}, { profileDir: dir }), /already exists/, 'duplicate save rejected');
  assert.throws(() => saveProfile('Bad Name', {}, { profileDir: dir }), /Invalid profile name/, 'bad name rejected');

  const { profile } = loadProfile('sec-review', { profileDir: dir });
  assert.strictEqual(profile.config.agent, 'cursor', 'profile loads back');
  assert.throws(() => loadProfile('nope', { profileDir: dir }), /Profile not found/, 'missing profile errors');

  const listed = listProfiles({ profileDir: dir });
  assert(listed.some(p => p.name === 'sec-review'), 'profile listed');

  const args = { agent: 'claude', _marker: true };
  const provided = new Set(['--agent']);
  const applied = applyProfile(args, profile.config, provided);
  assert.strictEqual(args.agent, 'claude', 'explicit CLI flag wins over profile');
  assert.strictEqual(args.domain, 'security', 'profile fills unset fields');
  assert.strictEqual(args.outputFormat, 'table', 'profile fills outputFormat');
  assert(applied.includes('domain') && !applied.includes('agent'), 'applied list correct');

  const cliArgs = parseArgs(['--agent', 'cursor', '--score', '--task', 'x']);
  assert(cliArgs._provided.has('--agent') && cliArgs._provided.has('--score') && !cliArgs._provided.has('--domain'), 'parseArgs tracks provided flags');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('profiles: OK');
}

async function testOfflineTemplateMode() {
  const originalFetch = globalThis.fetch;
  const originalHttpGet = require('http').get;
  let networkTouched = false;
  globalThis.fetch = () => { networkTouched = true; return Promise.reject(new Error('network disabled')); };
  require('http').get = (...a) => { networkTouched = true; return originalHttpGet(...a); };
  try {
    const prompt = await generate({ agent: 'cursor', domain: 'security', task: 'offline check', context: 'no network', constraints: 'none' });
    assert(prompt.includes('offline check'), 'template generation offline');
    const recipePrompt = await generate({ agent: 'claude', task: 'offline recipe', recipe: 'dfir-log-analysis' });
    assert(recipePrompt.includes('offline recipe'), 'recipe generation offline');
    const chain = buildChain(['prd-then-build', 'saas-starter']);
    assert(chain.length === 2, 'chain building offline');
    const pack = exportPack({ category: 'crypto' });
    assert(pack.recipes.length === 3, 'pack export offline');
    const score = scorePrompt(prompt, { agent: 'cursor' });
    assert(score.total > 0, 'scoring offline');
    const diff = diffLines(prompt, recipePrompt);
    assert(diff.length > 0, 'diff offline');
    const evaluation = evaluateResponse('# A\n\n- one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen', { outputFormat: 'markdown' });
    assert(evaluation.verdict === 'pass', 'response evaluation offline');
    const t = getStrings('es');
    assert(t.contextHeading.includes('Contexto'), 'i18n offline');
    assert.strictEqual(networkTouched, false, 'template mode makes zero network calls');
  } finally {
    globalThis.fetch = originalFetch;
    require('http').get = originalHttpGet;
  }
  console.log('offline template mode: OK');
}

async function testStreaming() {
  assert.strictEqual(parseStreamLine('data: {"choices":[{"delta":{"content":"Hello"}}]}'), 'Hello', 'token parsed');
  assert.strictEqual(parseStreamLine('data: [DONE]'), null, 'DONE sentinel ignored');
  assert.strictEqual(parseStreamLine('data: {"choices":[{"delta":{}}]}'), null, 'empty delta ignored');
  assert.strictEqual(parseStreamLine('event: message_start'), null, 'event lines ignored');
  assert.strictEqual(parseStreamLine('garbage not json'), null, 'malformed line tolerated');
  assert.strictEqual(parseStreamLine('data: {broken'), null, 'broken JSON tolerated');

  const req = streamRequest('https://api.test/v1', 'm', 'k', [{ role: 'user', content: 'x' }], 0.5);
  assert(req.url === 'https://api.test/v1/chat/completions' && req.body.stream === true && req.headers.Authorization === 'Bearer k', 'stream request built');
  assert(!('reasoning_effort' in req.body), 'reasoning omitted by default');
  const rReq = streamRequest('https://api.test/v1/', 'm', 'k', [], 0.5, 'high');
  assert(rReq.url === 'https://api.test/v1/chat/completions' && rReq.body.reasoning_effort === 'high', 'reasoning_effort sent + trailing slash handled');
  const keyless = streamRequest('http://localhost:11434/v1', 'm', undefined, [], 0.5);
  assert(!('Authorization' in keyless.headers), 'no auth header without a key');

  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" Wor', // split mid-line exercises buffering
    'ld"}}]}\n\ndata: [DONE]\n\n'
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      }
    })
  });
  try {
    const tokens = [];
    const full = await callLLMStream('m', 'k', 'https://api.test/v1', [{ role: 'user', content: 'x' }], 0.3, { onToken: t => tokens.push(t) });
    assert.strictEqual(full, 'Hello World', 'stream accumulates full text across split chunks');
    assert.deepStrictEqual(tokens, ['Hello', ' World'], 'onToken fires per parsed token');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('streaming: OK');
}

async function testIntegrationSweep() {
  const all = listRecipes();
  assert(all.length >= 111, `expected 111+ recipes, got ${all.length}`);
  for (const r of all) {
    const variables = {};
    for (const ph of (r.placeholders || [])) {
      if (!['task', 'context', 'constraints'].includes(ph)) variables[ph] = `test-${ph}`;
    }
    const rendered = renderRecipe(r.id, { task: 'integration task', context: 'integration context', constraints: 'integration constraint', variables });
    assert(rendered, `recipe ${r.id} renders`);
    assert(!/\{\{[^}]+\}\}/.test(rendered), `recipe ${r.id} has leftover placeholders`);
    assert(rendered.includes('integration task'), `recipe ${r.id} interpolates task`);
  }

  const formats = ['cursorrules', 'clinerules', 'agents-md', 'windsurfrules', 'opencode', 'opencode-jsonc', 'vscode', 'custom-gpt', 'antigravity', 'markdown'];
  for (const format of formats) {
    const out = exportPrompt('INTEGRATION PROMPT', format, 'sweep');
    assert(out.ext.startsWith('.'), `export ${format} has an extension`);
    assert(out.content.includes('INTEGRATION PROMPT'), `export ${format} embeds the prompt`);
    if (['opencode', 'custom-gpt', 'vscode'].includes(format)) {
      JSON.parse(out.content);
    }
  }

  const agents = ['cursor', 'deepseek', 'kimi', 'claude', 'gpt', 'windsurf', 'cline', 'opencode', 'generic'];
  const prompts = {};
  for (const agent of agents) {
    const prompt = await generate({ agent, task: 'integration sweep', domain: 'security' });
    assert(prompt.includes('Platform Playbook'), `agent ${agent} gets a platform playbook`);
    prompts[agent] = prompt;
  }
  const distinct = new Set(Object.values(prompts));
  assert(distinct.size >= agents.length - 1, 'batch generation produces distinct prompts per agent');
  assert(prompts.cursor.includes('Cursor Platform Playbook'), 'cursor-specific playbook');
  assert(prompts.claude.includes('Claude / Claude Code Platform Playbook'), 'claude-specific playbook');
  console.log(`integration sweep: OK (${all.length} recipes, ${formats.length} formats, ${agents.length} agents)`);
}

async function testBlueprintSections() {
  const { detectStack } = require('../src/context');
  const tauri = detectStack({ 'package.json': JSON.stringify({ dependencies: { '@tauri-apps/api': '2.0.0', react: '19.0.0' } }) }, 'app/\n├─ src/');
  assert(tauri.includes('tauri') && tauri.includes('frontend') && tauri.includes('node'), `tauri stack: ${tauri}`);
  const dotnet = detectStack({}, 'src/\n├─ App.csproj\n└─ App.sln');
  assert(dotnet.includes('dotnet'), 'dotnet stack from tree');
  const ml = detectStack({ 'requirements.txt': 'torch\ntransformers\n' }, '');
  assert(ml.includes('python') && ml.includes('python-ml'), 'python-ml stack');
  const infra = detectStack({ 'docker-compose.yml': 'services:', 'Vagrantfile': 'Vagrant.configure' }, '');
  assert(infra.includes('docker') && infra.includes('vagrant'), 'infra stack');

  const sec = await generate({ agent: 'cursor', domain: 'security', task: 'review API' });
  assert(sec.includes('Safety & Governance') && sec.includes('Compliance Mapping') && sec.includes('Honest Quality Gates'), 'security prompt carries safety/compliance/honesty');
  assert(sec.includes('MITRE ATT&CK'), 'classic compliance mapping');

  const aiSec = await generate({ agent: 'cursor', domain: 'security', task: 'x', recipe: 'aisec-prompt-injection' });
  assert(aiSec.includes('OWASP LLM Top 10'), 'AI-security compliance mapping');

  const buildPrompt = await generate({ agent: 'cursor', domain: 'lab-build', task: 'build a tool', projectScan: { stack: ['tauri', 'node'], commands: ['npm test'], root: '/x', tree: 'x/' } });
  assert(buildPrompt.includes('Ship Plan') && buildPrompt.includes('tauri build'), 'stack-aware ship plan');
  assert(buildPrompt.includes('Test Matrix'), 'build prompts carry test matrix');

  const chat = await generate({ agent: 'deepseek', task: 'explain DNS' });
  assert(!chat.includes('Ship Plan') && !chat.includes('Safety & Governance'), 'non-build/non-sec prompts stay lean');
  assert(chat.includes('Honest Quality Gates'), 'honest gates are universal');
  console.log('blueprint sections: OK');
}

async function testBlueprintRecipes() {
  const ids = ['tauri-desktop-app', 'avalonia-desktop-app', 'llm-finetune-study', 'ad-soc-lab', 'c2-training-range', 'mcp-sec-tool', 'ai-audit-cli', 're-stage-pipeline', 'grc-risk-pipeline', 'vuln-ai-lab'];
  for (const id of ids) {
    const r = getRecipe(id);
    assert(r, `recipe ${id} exists`);
    const rendered = renderRecipe(id, { task: 'blueprint test', context: 'ctx', constraints: 'none' });
    assert(!/\{\{[^}]+\}\}/.test(rendered), `recipe ${id} renders clean`);
  }
  const validation = validateRecipes();
  assert(validation.valid, `blueprint recipes validate: ${validation.errors.join('; ')}`);
  assert(validation.recipeCount >= 121, `121+ recipes, got ${validation.recipeCount}`);
  assert(validation.categories.blueprints === 10, 'blueprints category has 10 recipes');

  const sec = parseChain('@blueprint-sec');
  assert.deepStrictEqual(sec, CHAIN_PRESETS['@blueprint-sec'], 'sec preset expands');
  buildChain(sec);
  assert.throws(() => parseChain('@nope'), /preset/, 'unknown preset rejected');
  console.log('blueprint recipes: OK');
}

async function testScaffold() {
  const { buildScaffold } = require('../src/scaffold');
  const files = buildScaffold({ stack: ['node', 'docker'], commands: ['npm test', 'npm run lint'] });
  assert(files['.github/workflows/ci.yml'].includes('npm test') && files['.github/workflows/ci.yml'].includes('docker compose config'), 'ci covers detected stacks');
  assert(files['Makefile'].includes('npm test'), 'makefile uses detected test command');
  assert('.env.example' in files, 'env example scaffolded');
  const py = buildScaffold({ stack: ['python'], commands: ['pytest'] });
  assert(py['.github/workflows/ci.yml'].includes('pytest -q'), 'python ci scaffold');
  const args = parseArgs(['--scaffold', '--task', 'x', '--out', './out']);
  assert(args.scaffold === true, '--scaffold parses');
  console.log('scaffold: OK');
}

async function testMemory() {
  const { findSimilarPrompts, tokens } = require('../src/memory');
  const history = [
    { task: 'review api key handling in express app', context: 'node', prompt: 'x'.repeat(300), edited: true, scorePercent: 80 },
    { task: 'build a tower defense game', context: 'canvas', prompt: 'y'.repeat(300) },
    { task: 'unrelated gardening guide', context: '', prompt: 'z'.repeat(300) }
  ];
  const sim = findSimilarPrompts('review the api keys of my express app', { history });
  assert(sim.length === 1 && sim[0].edited === true, 'finds similar prompts and prefers edited ones');
  const none = findSimilarPrompts('quantum entanglement essay', { history });
  assert(none.length === 0, 'no overlap returns nothing');
  const short = findSimilarPrompts('review api keys', { history: [{ task: 'x', prompt: 'tiny' }] });
  assert(short.length === 0, 'too-short prompts ignored');
  assert(tokens('review api-key handling') .includes('api-key') && tokens('a bb').length === 0, 'tokenizer sane');
  console.log('memory: OK');
}

async function testPackTextImport() {
  const { importPackFromText, buildPack } = require('../src/recipe-packs');
  const os = require('os');
  const fs = require('fs');
  const recipe = { id: 'pack-import-fixture', label: 'Fixture', category: 'build', tagline: 't', template: 'Do {{task}}\n{{context}}\n{{constraints}}', placeholders: ['task', 'context', 'constraints'] };
  const pack = buildPack({ name: 'fixture-pack', recipes: [recipe] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-pack-'));
  try {
    const res = await importPackFromText(JSON.stringify(pack), { scope: 'project', project: dir });
    assert(res.imported.length === 1, 'text import writes recipes');
    assert(fs.existsSync(path.join(dir, '.mpa', 'recipes', 'pack-import-fixture.json')), 'recipe file lands in .mpa/recipes');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('pack text import: OK');
}

async function testGoldenRegression() {
  const { runGoldenTests } = require('./golden');
  const results = await runGoldenTests({ update: process.env.GOLDEN_UPDATE === '1' });
  for (const r of results) {
    assert.strictEqual(r.status === 'match' || r.status === 'updated', true, `golden ${r.id} ${r.status} — run "node tests/golden.js --update" if this change is intentional (${r.file || r.id})`);
  }
  assert.strictEqual(results.length, 4, 'all golden cases ran');
  console.log('golden regression: OK');
}

async function testGroundingLoop() {
  const { detectCommands } = require('../src/context');
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpa-ground-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node t.js', lint: 'eslint .', build: 'tsc' } }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture');

  const cmds = detectCommands({ 'package.json': '{"scripts":{"test":"x","lint":"y","build":"z"}}', 'Makefile': 'all: x\n\ntest: pytest\n', 'Cargo.toml': '[package]' });
  assert(cmds.includes('npm test') && cmds.includes('npm run lint') && cmds.includes('make test') && cmds.includes('cargo test'), `detectCommands: ${cmds}`);

  const scan = scanProject(dir);
  assert(scan.commands.includes('npm test') && scan.commands.includes('npm run lint'), 'scanProject attaches commands');

  const prompt = await generate({ agent: 'cursor', task: 'fix the parser bug', projectScan: scan });
  assert(prompt.includes('Project Grounding'), 'template prompt has grounding section');
  assert(prompt.includes('npm test'), 'grounding includes real verify command');
  assert(prompt.includes('Execution Loop'), 'template prompt has loop contract');
  assert(prompt.includes('**PLAN**') && prompt.includes('**VERIFY**') && prompt.includes('**ITERATE**') && prompt.includes('**REPORT**'), 'loop has all phases');
  assert(prompt.includes('run the project\'s checks and read the output: npm test && npm run lint && npm run build'), 'loop cites concrete commands');

  const recipePrompt = await generate({ agent: 'claude', task: 'snake game', recipe: 'one-shot-game', projectScan: scan });
  assert(recipePrompt.includes('Project Grounding') && recipePrompt.includes('Execution Loop'), 'recipe path gets grounding + loop');

  const chatPrompt = await generate({ agent: 'deepseek', task: 'explain X', projectScan: scan });
  assert(chatPrompt.includes('**SELF-VERIFY**'), 'terminal-less agent gets self-verify phase');

  const bare = await generate({ agent: 'cursor', task: 'fix bug' });
  assert(!bare.includes('Project Grounding'), 'no grounding without a scan');
  assert(bare.includes('Execution Loop'), 'loop contract always present');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('grounding + loop: OK');
}

async function main() {
  await testGenerator();
  await testNoRewritePassthrough();
  await testRewriteFallback();
  await testExporters();
  testCLIArgs();
  testRuleEnhancer();
  testContextScan();
  testArchitectHelpers();
  testConfig();
  testRecipes();
  testPlatforms();
  await testRecipeGeneration();
  await testPlatformInTemplate();
  testNewExporters();
  testHistory();
  await testBatchGeneration();
  await testScorer();
  await testCustomRecipes();
  await testChaining();
  await testRecipePacks();
  await testDiff();
  await testI18n();
  testPiping();
  testPromptTesting();
  await testCollaboration();
  testAnalytics();
  await testPlugins();
  await testTemplatize();
  testProfiles();
  await testOfflineTemplateMode();
  await testStreaming();
  await testIntegrationSweep();
  await testGroundingLoop();
  await testBlueprintSections();
  await testBlueprintRecipes();
  await testScaffold();
  await testMemory();
  await testPackTextImport();
  await testGoldenRegression();
  console.log('All tests passed.');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
