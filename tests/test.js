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
  const args = parseArgs(['--agent', 'cursor', '--task', 'review', '--export', 'cursorrules', '--rewrite', '--provider', 'openai', '--consult', '--project', '.', '--validate-recipes']);
  assert(args.agent === 'cursor');
  assert(args.task === 'review');
  assert(args.export === 'cursorrules');
  assert(args.rewrite === true);
  assert(args.provider === 'openai');
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
  const args = { provider: 'ollama' };
  resolveLLM(args);
  assert(args.provider === 'ollama', 'ollama provider should resolve');
  assert(args.model === 'llama3.2', 'ollama default model');
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
  console.log('All tests passed.');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
