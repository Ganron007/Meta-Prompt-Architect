const assert = require('assert');
const path = require('path');
const { generate } = require('../src/generator');
const { exportPrompt } = require('../src/exporters');
const { parseArgs } = require('../src/cli');
const { enhanceWithRules } = require('../src/enhancer');
const { scanProject, summarize } = require('../src/context');
const { unwrapPrompt, ARCHITECT_SYSTEM } = require('../src/architect');
const { loadEnv, resolveLLM } = require('../src/config');
const { listRecipes, renderRecipe, getRecipe } = require('../src/recipes');
const { buildPlaybook, getPlatform } = require('../src/platforms');
const { addHistoryEntry, listHistory, getHistoryEntry, clearHistory } = require('../src/history');

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
  const args = parseArgs(['--agent', 'cursor', '--task', 'review', '--export', 'cursorrules', '--rewrite', '--provider', 'openai', '--consult', '--project', '.']);
  assert(args.agent === 'cursor');
  assert(args.task === 'review');
  assert(args.export === 'cursorrules');
  assert(args.rewrite === true);
  assert(args.provider === 'openai');
  assert(args.consult === true);
  assert(args.project === '.');
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
  assert(list.length >= 49, `expected at least 49 recipes, got ${list.length}`);
  const categories = new Set(list.map(r => r.category));
  assert(categories.has('build'), 'should have build category');
  assert(categories.has('security'), 'should have security category');
  assert(categories.has('sec-research'), 'should have sec-research category');
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
  assert(renderRecipe('nonexistent', { task: 'x' }) === null, 'unknown recipe returns null');
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
  console.log('All tests passed.');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
