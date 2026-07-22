const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(process.cwd(), '.prompt-history.json');
const MAX_ENTRIES = 200;

function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch { /* best-effort */ }
}

function addHistoryEntry(entry) {
  const entries = loadHistory();
  const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
  entries.push({
    id,
    timestamp: new Date().toISOString(),
    ...entry
  });
  saveHistory(entries);
}

function listHistory({ search, limit = 50, agent } = {}) {
  let entries = loadHistory();
  if (search) {
    const term = search.toLowerCase();
    entries = entries.filter(e =>
      (e.task && e.task.toLowerCase().includes(term)) ||
      (e.prompt && e.prompt.toLowerCase().includes(term)) ||
      (e.agent && e.agent.toLowerCase().includes(term)) ||
      (e.domain && e.domain.toLowerCase().includes(term))
    );
  }
  if (agent) {
    entries = entries.filter(e => e.agent === agent);
  }
  return entries
    .reverse()
    .slice(0, limit)
    .map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      agent: e.agent,
      domain: e.domain,
      mode: e.mode,
      recipe: e.recipe,
      task: e.task,
      promptLength: e.prompt ? e.prompt.length : 0
    }));
}

function getHistoryEntry(id) {
  const entries = loadHistory();
  return entries.find(e => e.id === id || e.id.endsWith(id)) || null;
}

function clearHistory() {
  saveHistory([]);
}

module.exports = { loadHistory, saveHistory, addHistoryEntry, listHistory, getHistoryEntry, clearHistory, HISTORY_FILE };
