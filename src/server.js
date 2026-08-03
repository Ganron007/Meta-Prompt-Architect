const express = require('express');
const path = require('path');
const { generate } = require('./generator');
const { consultArchitect } = require('./architect');
const { scanProject, summarize } = require('./context');
const { exportPrompt } = require('./exporters');
const { loadEnvChain, resolveLLM } = require('./config');
const { listRecipes } = require('./recipes');
const { platforms } = require('./platforms');
const { listHistory, getHistoryEntry } = require('./history');
const { scorePrompt } = require('./scorer');

loadEnvChain();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/generate', async (req, res) => {
  try {
    const cfg = req.body;
    if (cfg.consult) {
      resolveLLM(cfg);
      const result = await consultArchitect(cfg);
      return res.json({ prompt: result.prompt, mode: 'consult', scanned: result.scanned, score: scorePrompt(result.prompt, { agent: cfg.agent }) });
    }
    const prompt = await generate(cfg);
    res.json({ prompt, mode: 'template', score: scorePrompt(prompt, { agent: cfg.agent }) });
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
    let prompt;
    if (config.consult) {
      resolveLLM(config);
      prompt = (await consultArchitect(config)).prompt;
    } else {
      prompt = await generate(config);
    }
    const result = exportPrompt(prompt, format, name);
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
  res.json({ recipes: listRecipes(), platforms: plats });
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

app.get('/api/history', (req, res) => {
  const entries = listHistory({ search: req.query.search, limit: parseInt(req.query.limit) || 50 });
  res.json(entries);
});

app.get('/api/history/:id', (req, res) => {
  const entry = getHistoryEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json({ id: entry.id, timestamp: entry.timestamp, agent: entry.agent, domain: entry.domain, mode: entry.mode, task: entry.task, prompt: entry.prompt });
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
