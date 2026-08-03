const express = require('express');
const path = require('path');
const { generate } = require('./generator');
const { consultArchitect } = require('./architect');
const { scanProject, summarize } = require('./context');
const { exportPrompt } = require('./exporters');
const { loadEnvChain, resolveLLM } = require('./config');
const { listRecipes, recipeCategories } = require('./recipes');
const { buildCustomRecipe, saveCustomRecipe, loadCustomRecipes } = require('./custom-recipes');
const { platforms } = require('./platforms');
const { listHistory, getHistoryEntry } = require('./history');
const { scorePrompt } = require('./scorer');
const { diffLines, summarizeDiff, configChanges } = require('./diff');
const { recordEvent, loadEvents, summarize: summarizeAnalytics } = require('./analytics');
const { loadPlugins } = require('./plugins');

loadEnvChain();
const plugins = loadPlugins();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function withCustomRecipes(config = {}) {
  const project = config.project || process.cwd();
  return { ...config, customRecipes: loadCustomRecipes({ project, recipeDir: config.recipeDir }), pluginPlatforms: plugins.platforms, pluginEnhancers: plugins.enhancers, enhanceWith: config.enhanceWith || [] };
}

app.post('/api/generate', async (req, res) => {
  try {
    const cfg = withCustomRecipes(req.body);
    if (cfg.consult) {
      resolveLLM(cfg);
      const result = await consultArchitect(cfg);
      const score = scorePrompt(result.prompt, { agent: cfg.agent });
      recordEvent('generate', { agent: cfg.agent, mode: 'consult', domain: cfg.domain, recipe: cfg.recipe || null, scorePercent: score.percent });
      return res.json({ prompt: result.prompt, mode: 'consult', scanned: result.scanned, score });
    }
    const prompt = await generate(cfg);
    const score = scorePrompt(prompt, { agent: cfg.agent });
    recordEvent('generate', { agent: cfg.agent, mode: 'template', domain: cfg.domain, recipe: cfg.recipe || null, scorePercent: score.percent });
    res.json({ prompt, mode: 'template', score });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const { config, format, name } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid "config" object' });
    }
    if (!format) {
      return res.status(400).json({ error: 'Missing "format"' });
    }
    const cfg = withCustomRecipes(config);
    let prompt;
    if (cfg.consult) {
      resolveLLM(cfg);
      prompt = (await consultArchitect(cfg)).prompt;
    } else {
      prompt = await generate(cfg);
    }
    const result = exportPrompt(prompt, format, name, plugins.exporters);
    recordEvent('export', { format, agent: config.agent });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/meta', (req, res) => {
  const plats = {};
  for (const [id, p] of Object.entries(platforms)) {
    plats[id] = { name: p.name, type: p.type, modes: p.modes, terminal: p.terminal, multiAgent: p.multiAgent, strengths: p.strengths };
  }
  const customRecipes = loadCustomRecipes({ project: req.query.project || process.cwd() });
  res.json({ recipes: listRecipes(customRecipes), recipeCategories, platforms: plats });
});

app.post('/api/recipes/preview', (req, res) => {
  try {
    const recipe = buildCustomRecipe(req.body?.recipe || req.body);
    res.json({ recipe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/recipes', (req, res) => {
  try {
    const body = req.body || {};
    const recipe = buildCustomRecipe(body.recipe || body);
    const saved = saveCustomRecipe(recipe, {
      scope: body.scope || 'project',
      project: body.project || process.cwd(),
      recipeDir: body.recipeDir,
      overwrite: body.overwrite === true
    });
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/scan', (req, res) => {
  try {
    const scan = scanProject(req.body?.path || process.cwd());
    if (!scan) return res.status(400).json({ error: 'Path does not exist or is not a directory' });
    res.json({ scan, summary: summarize(scan) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/plugins', (req, res) => {
  res.json({
    loaded: plugins.loaded,
    errors: plugins.errors,
    exporters: Object.keys(plugins.exporters),
    platforms: Object.keys(plugins.platforms),
    enhancers: Object.keys(plugins.enhancers),
    scanners: Object.keys(plugins.scanners)
  });
});

app.get('/api/analytics', (req, res) => {
  res.json(summarizeAnalytics(loadEvents()));
});

app.get('/api/history', (req, res) => {  const entries = listHistory({ search: req.query.search, limit: parseInt(req.query.limit) || 50 });
  res.json(entries);
});

app.get('/api/history/:id', (req, res) => {
  const entry = getHistoryEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json({ id: entry.id, timestamp: entry.timestamp, agent: entry.agent, domain: entry.domain, mode: entry.mode, task: entry.task, prompt: entry.prompt });
});

app.get('/api/diff', (req, res) => {
  const { id1, id2 } = req.query;
  if (!id1 || !id2) return res.status(400).json({ error: 'id1 and id2 query params are required' });
  const a = getHistoryEntry(id1);
  const b = getHistoryEntry(id2);
  if (!a || !b) return res.status(404).json({ error: `No history entry for ${!a ? id1 : id2}` });
  const ops = diffLines(a.prompt, b.prompt);
  res.json({
    a: { id: a.id, timestamp: a.timestamp, agent: a.agent, task: a.task },
    b: { id: b.id, timestamp: b.timestamp, agent: b.agent, task: b.task },
    summary: summarizeDiff(ops),
    configChanges: configChanges(a, b),
    diff: ops
  });
});

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;

function start() {
  app.listen(PORT, HOST, () => {
    console.log(`Meta-Prompt Architect web UI running at http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
