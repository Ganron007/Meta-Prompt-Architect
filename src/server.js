const express = require('express');
const path = require('path');
const { generate } = require('./generator');
const { exportPrompt } = require('./exporters');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/generate', (req, res) => {
  try {
    const prompt = generate(req.body);
    res.json({ prompt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/export', (req, res) => {
  try {
    const { config, format, name } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid "config" object' });
    }
    if (!format) {
      return res.status(400).json({ error: 'Missing "format"' });
    }
    const prompt = generate(config);
    const result = exportPrompt(prompt, format, name);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meta-Prompt Architect web UI running at http://localhost:${PORT}`);
});

module.exports = app;
