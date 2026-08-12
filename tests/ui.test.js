const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Window } = require('happy-dom');

const ROOT = path.join(__dirname, '..');

function makeUi({ llm = { model: 'step-test', apiBase: 'https://api.test/v1', reasoning: 'high' } } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const window = new Window({ url: 'http://127.0.0.1:3000/' });
  window.document.write(html);
  window.fetch = async (url) => {
    if (String(url).startsWith('/api/meta')) {
      const recipes = [
        { id: 'dfir-network-forensics', label: 'Network Forensics', category: 'dfir', taskHint: 'x', placeholders: ['task', 'context', 'constraints'], source: 'bundled' },
        { id: 'tauri-desktop-app', label: 'Tauri Desktop App', category: 'blueprints', taskHint: 'x', placeholders: ['task', 'context', 'constraints'], source: 'bundled' },
        { id: 'custom-widget', label: 'Custom Widget', category: 'build', taskHint: 'x', placeholders: ['task', 'context', 'constraints', 'severity'], source: 'custom' }
      ];
      return { ok: true, json: async () => ({ recipes, recipeCategories: { dfir: 'DFIR', blueprints: 'Blueprints', build: 'Build' }, platforms: {}, llm }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  const code = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  window.eval(code);
  return window;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = (w, id) => w.document.getElementById(id);
function fire(w, el, type) {
  el.dispatchEvent(new w.Event(type, { bubbles: true }));
}

async function testUiMetaAndLlm() {
  const w = makeUi();
  await wait(80);
  const recipe = $(w, 'recipe');
  assert(recipe.options.length >= 4, `recipe options loaded (${recipe.options.length})`);
  assert($(w, 'llmServer').hidden === false, 'server LLM chip visible');
  assert($(w, 'llmServerValue').textContent.includes('step-test') && $(w, 'llmServerValue').textContent.includes('api.test'), 'chip shows model + host');
  assert($(w, 'model').placeholder === 'step-test', 'model placeholder prefilled');
  assert($(w, 'llmCustom').hidden === true, 'custom fields hidden by default');
  assert($(w, 'llmMoreBtn').hidden === false, 'add-another button shown');
  console.log('ui meta + llm chip: OK');
}

async function testUiLlmToggle() {
  const w = makeUi();
  await wait(80);
  fire(w, $(w, 'llmMoreBtn'), 'click');
  assert($(w, 'llmCustom').hidden === false, 'custom fields open on click');
  assert($(w, 'llmMoreBtn').textContent.includes('Close'), 'button flips to close');
  fire(w, $(w, 'llmMoreBtn'), 'click');
  assert($(w, 'llmCustom').hidden === true, 'custom fields close again');
  console.log('ui llm toggle: OK');
}

async function testUiNoLlm() {
  const w = makeUi({ llm: { model: null, apiBase: null, reasoning: null } });
  await wait(80);
  assert($(w, 'llmServer').hidden === true, 'server chip hidden without config');
  assert($(w, 'llmCustom').hidden === false, 'custom fields visible without config');
  assert($(w, 'llmHint').hidden === false, 'warning hint shown');
  console.log('ui no-llm state: OK');
}

async function testUiRecipeFilter() {
  const w = makeUi();
  await wait(80);
  const filter = $(w, 'recipeFilter');
  const recipe = $(w, 'recipe');
  filter.value = 'dfir';
  fire(w, filter, 'input');
  let visible = [...recipe.options].filter(o => o.value && !o.hidden);
  assert(visible.length === 1 && visible[0].value === 'dfir-network-forensics', `filter narrows to dfir (${visible.map(o => o.value)})`);
  assert($(w, 'recipeFilterEmpty').hidden === true, 'no empty hint when matches exist');
  filter.value = 'zzzz-no-match';
  fire(w, filter, 'input');
  assert($(w, 'recipeFilterEmpty').hidden === false, 'empty hint shown on no match');
  filter.value = '';
  fire(w, filter, 'input');
  visible = [...recipe.options].filter(o => o.value && !o.hidden);
  assert(visible.length === 3, 'filter cleared restores all');
  console.log('ui recipe filter: OK');
}

async function testUiRecipeVariablesHidden() {
  const w = makeUi();
  await wait(80);
  const vars = $(w, 'recipeVariables');
  assert(vars.hidden === true, 'recipe variables hidden for bundled recipes');
  const recipe = $(w, 'recipe');
  recipe.value = 'custom-widget';
  fire(w, recipe, 'change');
  assert(vars.hidden === false, 'custom recipe with placeholders shows inputs');
  const fields = $(w, 'recipeVariableFields');
  assert(fields.children.length === 1 && fields.children[0].querySelector('input').dataset.recipeVariable === 'severity', 'placeholder input rendered');
  console.log('ui recipe variables: OK');
}

async function testUiModalsHidden() {
  const w = makeUi();
  await wait(80);
  assert($(w, 'historyModal').hidden === true, 'history modal hidden on load');
  assert($(w, 'statsModal').hidden === true, 'stats modal hidden on load');
  console.log('ui modals hidden: OK');
}

async function testUiTaskModes() {
  const w = makeUi();
  await wait(80);
  assert($(w, 'layerFreeform').hidden === false, 'freeform layer visible by default');
  assert($(w, 'layerRecipe').hidden === true && $(w, 'layerChain').hidden === true, 'recipe/chain layers hidden by default');
  const btn = w.document.querySelector('.mode-seg button[data-mode="recipe"]');
  fire(w, btn, 'click');
  assert($(w, 'layerFreeform').hidden === true && $(w, 'layerRecipe').hidden === false, 'recipe mode swaps layers');
  const chainBtn = w.document.querySelector('.mode-seg button[data-mode="chain"]');
  fire(w, chainBtn, 'click');
  assert($(w, 'layerChain').hidden === false && $(w, 'layerRecipe').hidden === true, 'chain mode shows chain layer');
  assert($(w, 'presetBlueSec').hidden === false && $(w, 'presetBlueAi').hidden === false, 'chain presets visible in chain layer');
  fire(w, w.document.querySelector('.mode-seg button[data-mode="freeform"]'), 'click');
  assert($(w, 'layerFreeform').hidden === false, 'back to freeform restores layer');
  assert($(w, 'cancelBtn').hidden === true, 'cancel button hidden when idle');
  console.log('ui task modes: OK');
}

async function main() {
  await testUiMetaAndLlm();
  await testUiLlmToggle();
  await testUiNoLlm();
  await testUiRecipeFilter();
  await testUiRecipeVariablesHidden();
  await testUiModalsHidden();
  await testUiTaskModes();
  console.log('All UI tests passed.');
}

main().catch(err => {
  console.error('UI test failed:', err.message);
  process.exit(1);
});
