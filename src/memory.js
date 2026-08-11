const { loadHistory } = require('./history');

function tokens(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) || []);
}

function findSimilarPrompts(query, { history = null, limit = 3, minOverlap = 2 } = {}) {
  const entries = history || loadHistory();
  const q = new Set(tokens(query));
  if (!q.size) return [];
  const scored = entries
    .filter(e => e && e.prompt && e.prompt.trim().length > 200)
    .map(e => {
      const t = tokens(`${e.task || ''} ${e.context || ''}`);
      const overlap = t.filter(w => q.has(w)).length;
      if (overlap < minOverlap) return null;
      let score = overlap;
      if (e.edited) score += 1.5;
      if (typeof e.scorePercent === 'number') score += e.scorePercent / 100;
      return { entry: e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(x => ({
    task: x.entry.task || '(no task)',
    prompt: x.entry.prompt,
    edited: !!x.entry.edited,
    scorePercent: typeof x.entry.scorePercent === 'number' ? x.entry.scorePercent : null
  }));
}

module.exports = { findSimilarPrompts, tokens };
