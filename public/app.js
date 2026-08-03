const state = {
  prompt: '',
  config: {},
  meta: null
};

const $ = (id) => document.getElementById(id);
const CATEGORY_LABELS = {
  build: 'Software Build', security: 'Cybersecurity', 'sec-research': 'Security Research (Lab Methodology)',
  dfir: 'DFIR — Forensics & IR', 'reverse-eng': 'Reverse Engineering', malware: 'Malware Analysis',
  aisec: 'AI / ML Security', redteam: 'Red Team Operations', blueteam: 'Blue Team / Detection',
  cloudsec: 'Cloud Security', appsec: 'Application Security', osint: 'OSINT / Threat Intel',
  crypto: 'Cryptography', ai: 'AI / Agentic Frameworks', 'ai-security': 'AI × Cybersecurity',
  'ai-ops': 'AI × Operations'
};

function getConfig() {
  const consult = $('consult').checked;
  return {
    agent: $('agent').value,
    domain: $('domain').value,
    task: $('task').value.trim(),
    context: $('context').value.trim(),
    constraints: $('constraints').value.trim(),
    outputFormat: $('outputFormat').value,
    tone: $('tone').value,
    includeExamples: $('includeExamples').checked,
    consult,
    rewrite: $('rewrite').checked,
    recipe: $('recipe').value || undefined,
    provider: $('provider').value,
    model: $('model').value.trim(),
    apiKey: $('apiKey').value.trim(),
    apiBase: $('apiBase').value.trim(),
    project: $('builderProject').value.trim() || $('project').value.trim() || undefined,
    variables: getRecipeVariables()
  };
}

function getRecipeVariables() {
  const variables = {};
  document.querySelectorAll('[data-recipe-variable]').forEach((input) => {
    if (input.value.trim()) variables[input.dataset.recipeVariable] = input.value.trim();
  });
  return variables;
}

function toggleLLMConfig() {
  const on = $('rewrite').checked || $('consult').checked;
  $('llmConfig').classList.toggle('open', on);
  const tag = $('engineTag');
  if ($('consult').checked) {
    tag.textContent = 'CONSULT ENGINE';
    tag.classList.add('consult');
  } else {
    tag.textContent = 'TEMPLATE ENGINE';
    tag.classList.remove('consult');
  }
}

function setDefaultModel() {
  const provider = $('provider').value;
  const modelInput = $('model');
  const defaults = {
    openai: 'gpt-4o-mini',
    'openai-compatible': 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
    anthropic: 'claude-3-5-haiku-latest',
    ollama: 'llama3.2',
    mimo: 'mimo-v2.5'
  };
  if (!modelInput.value || Object.values(defaults).includes(modelInput.value)) {
    modelInput.value = defaults[provider] || '';
  }
}

function setStatus(text, ledState) {
  $('statusStrip').textContent = text;
  $('statusLed').className = 'status-led' + (ledState ? ' ' + ledState : '');
  $('stripDot').className = 'strip-dot' + (ledState ? ' ' + ledState : '');
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

async function generate() {
  const config = getConfig();
  if (!config.task) {
    showToast('Enter a task first — rough is fine, nothing gets dropped.', 'error');
    $('task').focus();
    return;
  }

  const btn = $('generateBtn');
  const label = btn.querySelector('.btn-label');
  btn.disabled = true;
  label.textContent = 'Forging\u2026';
  $('paper').parentElement.classList.add('forging');
  setStatus(config.consult ? 'Consulting the Architect\u2026' : 'Templating prompt\u2026', 'busy');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    state.prompt = data.prompt;
    state.config = config;

    const out = $('output');
    out.textContent = data.prompt;
    out.classList.remove('placeholder');
    replayPaper();

    const meta = $('outputMeta');
    meta.textContent = `${wordCount(data.prompt)} words \u00b7 ${data.mode}`;
    meta.classList.add('live');

    const chip = $('scoreChip');
    if (data.score) {
      chip.hidden = false;
      chip.textContent = `${data.score.grade} \u00b7 ${data.score.percent}%`;
      chip.className = 'score-chip grade-' + data.score.grade.toLowerCase();
      chip.title = data.score.dimensions.map(d => `${d.label}: ${d.score}/10`).join('\n');
    } else {
      chip.hidden = true;
    }

    if (data.mode === 'consult' && data.scanned) {
      setStatus(`Forged via consult \u2014 grounded in ${data.scanned.files.length} files @ ${data.scanned.root}`, 'ok');
    } else if (data.mode === 'consult') {
      setStatus('Forged via consult \u2014 no project scan supplied.', 'ok');
    } else {
      setStatus('Forged via template engine \u2014 offline, no LLM used.', 'ok');
    }
    showToast('Prompt forged.');
  } catch (err) {
    setStatus(`Failed: ${err.message}`, 'err');
    showToast(err.message || 'Generation failed.', 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Forge prompt';
    $('paper').parentElement.classList.remove('forging');
  }
}

async function exportFile() {
  if (!state.prompt) {
    showToast('Forge a prompt first.', 'error');
    return;
  }

  const format = $('exportFormat').value;
  const name = 'generated-prompt';

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: state.config, format, name })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    download(data.content, `${name}${data.ext}`, 'text/plain');
    showToast(`Exported ${data.ext}`);
  } catch (err) {
    showToast(err.message || 'Export failed.', 'error');
  }
}

function copyToClipboard() {
  if (!state.prompt) {
    showToast('Forge a prompt first.', 'error');
    return;
  }
  const done = () => showToast('Copied to clipboard.');
  const fail = () => showToast('Copy failed \u2014 select the text manually.', 'error');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(state.prompt).then(done).catch(() => { legacyCopy(); });
  } else {
    legacyCopy();
  }

  function legacyCopy() {
    try {
      const ta = document.createElement('textarea');
      ta.value = state.prompt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch { fail(); }
  }
}

function replayPaper() {
  $('paper').style.animation = 'none';
  void $('paper').offsetWidth;
  $('paper').style.animation = '';
}

function clearInputs() {
  ['task', 'context', 'constraints'].forEach(id => { $(id).value = ''; });
  document.querySelectorAll('[data-recipe-variable]').forEach(input => { input.value = ''; });
  $('task').focus();
  showToast('Inputs cleared.');
}

function clearOutput() {
  state.prompt = '';
  state.config = {};
  const out = $('output');
  out.textContent = 'Forge a prompt and it lands here \u2014\nready to copy straight into your agent.';
  out.classList.add('placeholder');
  replayPaper();
  const meta = $('outputMeta');
  meta.textContent = 'awaiting input';
  meta.classList.remove('live');
  $('scoreChip').hidden = true;
  setStatus('Ready. Template engine runs offline; flip on Consult for LLM-authored prompts.', '');
  showToast('Output cleared.');
}

function shareUrl() {
  if (!state.prompt) {
    showToast('Forge a prompt first.', 'error');
    return;
  }
  const cfg = getConfig();
  const params = new URLSearchParams();
  if (cfg.agent) params.set('a', cfg.agent);
  if (cfg.domain) params.set('d', cfg.domain);
  if (cfg.task) params.set('t', cfg.task);
  if (cfg.context) params.set('c', cfg.context);
  if (cfg.constraints) params.set('x', cfg.constraints);
  if (cfg.outputFormat) params.set('f', cfg.outputFormat);
  if (cfg.tone) params.set('n', cfg.tone);
  if (cfg.includeExamples) params.set('e', '1');
  if (cfg.consult) params.set('k', '1');
  if (cfg.rewrite) params.set('r', '1');
  if (cfg.recipe) params.set('p', cfg.recipe);
  const url = `${location.origin}${location.pathname}?${params.toString()}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Shareable URL copied to clipboard.');
  }).catch(() => {
    showToast('Copy failed — URL: ' + url, 'error');
  });
}

function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.toString()) return;
  const map = { a: 'agent', d: 'domain', t: 'task', c: 'context', x: 'constraints', f: 'outputFormat', n: 'tone', p: 'recipe' };
  for (const [short, long] of Object.entries(map)) {
    const val = params.get(short);
    if (val) {
      const el = $(long);
      if (el) el.value = val;
    }
  }
  if (params.get('e') === '1') $('includeExamples').checked = true;
  if (params.get('k') === '1') $('consult').checked = true;
  if (params.get('r') === '1') $('rewrite').checked = true;
  toggleLLMConfig();
  onRecipeChange();
  if (params.get('t')) {
    setStatus('Loaded from shared URL. Press Forge to generate.', '');
  }
}

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let toastTimer = null;
function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 2600);
}

let historySelection = new Set();

async function openHistory() {
  const modal = $('historyModal');
  modal.hidden = false;
  $('diffView').hidden = true;
  $('configChanges').innerHTML = '';
  $('diffSummary').textContent = '';
  historySelection = new Set();
  $('diffBtn').disabled = true;
  const list = $('historyList');
  list.innerHTML = '<p class="modal-hint">Loading…</p>';
  try {
    const res = await fetch('/api/history?limit=50');
    const entries = await res.json();
    if (!entries.length) {
      list.innerHTML = '<p class="modal-hint">No history yet. Forge a prompt first.</p>';
      return;
    }
    list.innerHTML = '';
    for (const e of entries) {
      const row = document.createElement('label');
      row.className = 'history-row';
      const when = new Date(e.timestamp).toLocaleString();
      row.innerHTML = `<input type="checkbox" data-id="${e.id}" /> <span class="history-id">${e.id.slice(-6)}</span> <span class="history-task">${(e.task || '(no task)').slice(0, 60)}</span> <span class="history-meta">${e.agent} · ${e.mode || 'template'} · ${when}</span>`;
      row.querySelector('input').addEventListener('change', (ev) => {
        const id = ev.target.dataset.id;
        if (ev.target.checked) {
          if (historySelection.size >= 2) {
            const first = historySelection.values().next().value;
            historySelection.delete(first);
            const old = list.querySelector(`input[data-id="${first}"]`);
            if (old) old.checked = false;
          }
          historySelection.add(id);
        } else {
          historySelection.delete(id);
        }
        $('diffBtn').disabled = historySelection.size !== 2;
      });
      list.appendChild(row);
    }
  } catch (err) {
    list.innerHTML = `<p class="modal-hint">Failed to load history: ${err.message}</p>`;
  }
}

async function runDiff() {
  const [id1, id2] = [...historySelection];
  try {
    const res = await fetch(`/api/diff?id1=${encodeURIComponent(id1)}&id2=${encodeURIComponent(id2)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    $('diffSummary').textContent = `+${data.summary.added} / -${data.summary.removed} lines (${data.summary.unchanged} unchanged)`;
    const cfg = $('configChanges');
    cfg.innerHTML = data.configChanges.length
      ? data.configChanges.map(c => `<span class="chip amber">${c.field}: ${String(c.from)} → ${String(c.to)}</span>`).join('')
      : '<span class="chip">no config changes</span>';
    const view = $('diffView');
    view.hidden = false;
    view.innerHTML = '';
    const addLine = (cls, prefix, text) => {
      const div = document.createElement('div');
      div.className = `diff-line ${cls}`;
      div.textContent = `${prefix} ${text}`;
      view.appendChild(div);
    };
    let buffer = [];
    const flushSame = () => {
      if (buffer.length <= 4) {
        buffer.forEach(t => addLine('diff-same', ' ', t));
      } else {
        buffer.slice(0, 2).forEach(t => addLine('diff-same', ' ', t));
        addLine('diff-gap', '', `··· ${buffer.length - 4} unchanged lines ···`);
        buffer.slice(-2).forEach(t => addLine('diff-same', ' ', t));
      }
      buffer = [];
    };
    for (const op of data.diff) {
      if (op.type === 'same') { buffer.push(op.text); continue; }
      flushSame();
      addLine(op.type === 'add' ? 'diff-add' : 'diff-del', op.type === 'add' ? '+' : '-', op.text);
    }
    flushSame();
    if (!view.children.length) view.innerHTML = '<div class="diff-gap">prompts are identical</div>';
  } catch (err) {
    showToast(err.message || 'Diff failed.', 'error');
  }
}

$('generateBtn').addEventListener('click', generate);
$('exportBtn').addEventListener('click', exportFile);
$('copyBtn').addEventListener('click', copyToClipboard);
$('shareBtn').addEventListener('click', shareUrl);
$('historyBtn').addEventListener('click', openHistory);
$('historyClose').addEventListener('click', () => { $('historyModal').hidden = true; });
$('diffBtn').addEventListener('click', runDiff);
$('clearInputsBtn').addEventListener('click', clearInputs);
$('clearOutputBtn').addEventListener('click', clearOutput);
$('rewrite').addEventListener('change', toggleLLMConfig);
$('consult').addEventListener('change', toggleLLMConfig);
$('provider').addEventListener('change', setDefaultModel);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    generate();
  }
});

function isLight() {
  return document.documentElement.dataset.theme === 'light';
}

function toggleTheme() {
  if (isLight()) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = 'light';
  }
  try { localStorage.setItem('mpa-theme', isLight() ? 'light' : 'dark'); } catch (e) {}
  showToast(isLight() ? 'Light drafting table.' : 'Dark mode \u2014 easy on the eyes.');
}

$('themeToggle').addEventListener('click', toggleTheme);

function renderPlatformChips(agentId) {
  const wrap = $('platformChips');
  wrap.innerHTML = '';
  if (!state.meta || !state.meta.platforms[agentId]) return;
  const p = state.meta.platforms[agentId];
  const chips = [];
  if (p.terminal) chips.push({ text: 'terminal', amber: false });
  if (p.multiAgent && !p.multiAgent.startsWith('No')) chips.push({ text: 'multi-agent', amber: true });
  p.modes.slice(0, 3).forEach(m => chips.push({ text: m.split('(')[0].trim(), amber: false }));
  chips.forEach((c, i) => {
    const el = document.createElement('span');
    el.className = 'chip' + (c.amber ? ' amber' : '');
    el.textContent = c.text;
    el.style.animationDelay = `${i * 0.05}s`;
    wrap.appendChild(el);
  });
}

function onRecipeChange() {
  const id = $('recipe').value;
  const tagline = $('recipeTagline');
  const task = $('task');
  if (!id || !state.meta) {
    tagline.textContent = '';
    task.placeholder = 'Full plan, rough idea, arrow lists \u2014 paste anything. Nothing gets dropped.';
    renderRecipeVariables([]);
    return;
  }
  const r = state.meta.recipes.find(x => x.id === id);
  if (r) {
    tagline.textContent = r.tagline;
    renderRecipeVariables(r.placeholders || []);
  }
  const hints = {
    'readme-driven': 'Describe the project: what it does, who it is for, key features...',
    'one-shot-game': 'Describe the game: genre, core mechanic, setting, win/lose condition...',
    'fullstack-app': 'Describe the app: what it does, core features, preferred stack...',
    'prd-then-build': 'Describe the product idea: problem it solves, target user, key features...',
    'saas-starter': 'Describe the SaaS: what it does, who pays for it, core value prop...',
    'clone-builder': 'Name the app to clone and your twist: "Trello but for recipe planning"...',
    'codebase-overhaul': 'Point at the codebase and say what hurts: "legacy Flask app, no tests"...',
    'spec-first-api': 'Describe the API: domain, resources, key operations, consumers...',
    'pentest-report': 'Describe the target: scope, type (web/network/mobile), rules of engagement...',
    'threat-model': 'Describe the system: architecture, data flows, trust boundaries, tech stack...',
    'secure-code-review': 'Paste the code or point at the repo. Specify language, framework, concerns...',
    'incident-response': 'Describe the incident type: ransomware, data breach, phishing, DDoS...',
    'malware-analysis': 'Describe the sample: file type, hash, source, suspected family, behavior...',
    'red-team-plan': 'Describe the engagement: target org, objectives, scope, timeline...',
    'security-architecture': 'Describe or paste the architecture: components, data flows, cloud services...',
    'ctf-builder': 'Describe the challenge: category (web/pwn/crypto/forensics), difficulty...',
    'hardening-guide': 'Name the target: OS (Ubuntu 24.04), service (nginx), cloud (AWS)...',
    'detection-rules': 'Name the threat or ATT&CK technique: "T1059.001 PowerShell", "Log4Shell"...',
    'security-audit': 'Specify target and framework: "AWS vs CIS Benchmarks", "web app vs NIST CSF"...',
    'reverse-engineering': 'Describe the binary: file type, architecture, what you want to understand...',
    'bug-bounty-recon': 'Name the target domain or program scope, known info, exclusions...',
    'compliance-gap': 'Specify framework and system: "SOC 2 Type II for a B2B SaaS on AWS"...',
    'supply-chain-audit': 'Point at the project: repo URL or paste package.json / requirements.txt...',
    'forensic-analysis': 'Describe the evidence: disk image, memory dump, pcap, log set, incident...',
    'exploit-dev': 'Describe the vulnerability: CVE ID, software/version, vuln type, target env...',
    'security-tool': 'Describe the tool: what it scans/monitors/analyzes, target, output format...',
    'langgraph-agent': 'Describe the agent: what it does, tools needed, when to pause for human input...',
    'langchain-rag': 'Describe the knowledge base and use case: docs, code, tickets, papers...',
    'crewai-crew': 'Describe the mission: what the crew accomplishes, roles needed, tools...',
    'autogen-team': 'Describe the problem the team solves, roles needed, code execution needed?',
    'mcp-server': 'Describe what the MCP server exposes: DB queries, API access, file ops...',
    'ai-eval-suite': 'Describe what you are evaluating: a prompt, RAG pipeline, agent, classifier...',
    'agent-tool-use': 'Describe the agent and tools: API calls, DB queries, file ops, calculations...',
    'prompt-engineering-suite': 'Describe the prompts: use case, target model, quality criteria, volume...',
    'finetune-pipeline': 'Describe model, task, data: "fine-tune Llama 3 for medical Q&A, 5K examples"...',
    'ai-api-gateway': 'Describe routing needs: providers, models, use cases, volume, cost limits...',
    'ai-soc-analyst': 'Describe your SOC: alert sources, team size, top alert types, tools...',
    'ai-threat-hunter': 'Describe the hunt: environment, data sources, threat intel, hypotheses...',
    'ai-malware-analyst': 'Describe analysis needs: sample types, sandbox availability, reporting...',
    'ai-pentest-crew': 'Describe the engagement: target, scope, rules of engagement, depth...',
    'ai-code-security': 'Point at the codebase: language, framework, compliance requirements...',
    'ai-incident-responder': 'Describe IR needs: environment, detection sources, response capabilities...',
    'ai-research-crew': 'Describe the research topic, depth, output format, citation requirements...',
    'ai-devops-agent': 'Describe the infrastructure: stack, monitoring, deployment, common failures...',
    'ai-data-pipeline': 'Describe the pipeline: sources, transformations, destination, volume, SLA...',
    'sec-research-solve': 'Describe the lab objective: expected exploit outcome, target binary/repo, attacker start...',
    'sec-research-build': 'Describe the lab to build: vulnerability class, target stack, learning objective...',
    'sec-research-hunt': 'Describe the target to hunt: codebase, binary, firmware, config, scope, depth...',
    'sec-research-validate': 'Paste the claim to validate: CVE description, researcher writeup, exploit assertion...'
  };
  task.placeholder = (r && r.taskHint) || hints[id] || task.placeholder;
  task.focus();
}

function renderRecipeVariables(placeholders) {
  const variables = placeholders.filter(name => !['task', 'context', 'constraints'].includes(name));
  const section = $('recipeVariables');
  const fields = $('recipeVariableFields');
  fields.innerHTML = '';
  section.hidden = variables.length === 0;

  for (const name of variables) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.htmlFor = `recipeVariable-${name}`;
    label.textContent = name.replace(/_/g, ' ');
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `recipeVariable-${name}`;
    input.dataset.recipeVariable = name;
    input.placeholder = `Value for {{${name}}}`;
    field.append(label, input);
    fields.appendChild(field);
  }
}

function getBuilderDraft() {
  return {
    name: $('builderName').value.trim(),
    category: $('builderCategory').value,
    role: $('builderRole').value.trim(),
    steps: $('builderSteps').value,
    hardRules: $('builderRules').value,
    outputFormat: $('builderOutput').value.trim(),
    placeholders: $('builderPlaceholders').value.trim()
  };
}

function getBuilderProject() {
  return $('builderProject').value.trim() || undefined;
}

function renderBuilderCategories() {
  const select = $('builderCategory');
  const selected = select.value || 'build';
  const categories = (state.meta && state.meta.recipeCategories) || CATEGORY_LABELS;
  select.innerHTML = '';
  for (const [id, label] of Object.entries(categories)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = Object.prototype.hasOwnProperty.call(categories, selected) ? selected : 'build';
}

function toggleRecipeBuilder() {
  const builder = $('recipeBuilder');
  builder.hidden = !builder.hidden;
  $('toggleRecipeBuilder').textContent = builder.hidden ? 'Build recipe' : 'Close builder';
  if (!builder.hidden) {
    renderBuilderCategories();
    $('builderName').focus();
  }
}

function showRecipePreview(recipe) {
  const preview = $('builderPreview');
  preview.textContent = recipe.template;
  preview.hidden = false;
}

async function previewRecipe() {
  const button = $('previewRecipeBtn');
  button.disabled = true;
  button.textContent = 'Building…';
  try {
    const res = await fetch('/api/recipes/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: getBuilderDraft() })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showRecipePreview(data.recipe);
    showToast('Template previewed.');
  } catch (err) {
    showToast(err.message || 'Recipe preview failed.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Preview template';
  }
}

async function saveRecipe() {
  const button = $('saveRecipeBtn');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const project = getBuilderProject();
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe: getBuilderDraft(),
        scope: $('builderScope').value,
        project
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showRecipePreview(data.recipe);
    await loadMeta(project);
    $('recipe').value = data.recipe.id;
    onRecipeChange();
    setStatus(`Saved custom recipe ${data.recipe.id}`, 'ok');
    showToast(`Saved ${data.recipe.id}.`);
  } catch (err) {
    showToast(err.message || 'Recipe save failed.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Save recipe';
  }
}

async function loadMeta(project) {
  try {
    const selected = $('recipe').value;
    const query = project ? `?${new URLSearchParams({ project }).toString()}` : '';
    const res = await fetch(`/api/meta${query}`);
    if (!res.ok) throw new Error('Unable to load recipe metadata.');
    state.meta = await res.json();
    const sel = $('recipe');
    sel.innerHTML = '<option value="">None — freeform task</option>';
    const grouped = {};
    for (const r of state.meta.recipes) {
      const cat = r.category || 'build';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    for (const [cat, items] of Object.entries(grouped)) {
      const og = document.createElement('optgroup');
      og.label = ((state.meta && state.meta.recipeCategories) || CATEGORY_LABELS)[cat] || cat;
      for (const r of items) {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.source === 'custom' ? `${r.label} · custom` : r.label;
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    if ([...sel.options].some(option => option.value === selected)) sel.value = selected;
    renderBuilderCategories();
    renderPlatformChips($('agent').value);
    onRecipeChange();
  } catch { /* meta is optional — UI still works without it */ }
}

$('agent').addEventListener('change', () => renderPlatformChips($('agent').value));
$('recipe').addEventListener('change', onRecipeChange);
$('toggleRecipeBuilder').addEventListener('click', toggleRecipeBuilder);
$('previewRecipeBtn').addEventListener('click', previewRecipe);
$('saveRecipeBtn').addEventListener('click', saveRecipe);

renderBuilderCategories();
loadMeta();
loadFromUrl();
toggleLLMConfig();
setDefaultModel();
