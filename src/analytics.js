const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(process.cwd(), '.mpa-analytics.json');
const MAX_EVENTS = 1000;

function loadEvents(file = DEFAULT_FILE) {
  try {
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data && data.events) ? data.events : [];
  } catch {
    return [];
  }
}

function recordEvent(type, data = {}, file = DEFAULT_FILE) {
  try {
    const events = loadEvents(file);
    events.push({ ts: new Date().toISOString(), type, ...data });
    fs.writeFileSync(file, `${JSON.stringify({ version: 1, events: events.slice(-MAX_EVENTS) }, null, 2)}\n`, 'utf8');
  } catch { /* analytics are best-effort and never block the main flow */ }
}

function topCounts(events, key, limit = 10) {
  const counts = {};
  for (const e of events) {
    const value = e[key];
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function summarize(events = []) {
  const generate = events.filter(e => e.type === 'generate');
  const scored = generate.filter(e => typeof e.scorePercent === 'number');
  const byDay = {};
  for (const e of scored) {
    const day = String(e.ts || '').slice(0, 10);
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
    byDay[day].total += e.scorePercent;
    byDay[day].count += 1;
  }
  return {
    totalEvents: events.length,
    generated: generate.length,
    byAgent: topCounts(generate, 'agent'),
    byMode: topCounts(generate, 'mode'),
    byRecipe: topCounts(generate, 'recipe'),
    byExportFormat: topCounts(events.filter(e => e.type === 'export'), 'format'),
    tests: {
      total: events.filter(e => e.type === 'test').length,
      passed: events.filter(e => e.type === 'test' && e.verdict === 'pass').length
    },
    quality: {
      scoredPrompts: scored.length,
      avgPercent: scored.length ? Math.round(scored.reduce((s, e) => s + e.scorePercent, 0) / scored.length) : null,
      overTime: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, avgPercent: Math.round(v.total / v.count), count: v.count }))
    }
  };
}

function formatAnalytics(summary) {
  const bar = (count, max) => '█'.repeat(Math.max(1, Math.round((count / Math.max(1, max)) * 20)));
  const section = (title, items) => {
    if (!items.length) return `  ${title}: none yet`;
    const max = Math.max(...items.map(i => i.count));
    return [`  ${title}:`].concat(items.map(i => `    ${String(i.value).padEnd(24)} ${bar(i.count, max)} ${i.count}`)).join('\n');
  };
  const lines = [
    `\n── Analytics ── ${summary.generated} prompts generated · ${summary.totalEvents} events`,
    section('Agents', summary.byAgent),
    section('Modes', summary.byMode),
    section('Top recipes', summary.byRecipe),
    section('Export formats', summary.byExportFormat),
    `  Tests: ${summary.tests.passed}/${summary.tests.total} passed`
  ];
  if (summary.quality.avgPercent !== null) {
    lines.push(`  Quality: avg ${summary.quality.avgPercent}% across ${summary.quality.scoredPrompts} scored prompts`);
    for (const point of summary.quality.overTime.slice(-7)) {
      lines.push(`    ${point.day}  ${'█'.repeat(Math.max(1, Math.round(point.avgPercent / 5)))} ${point.avgPercent}% (${point.count})`);
    }
  }
  return lines.join('\n');
}

module.exports = { loadEvents, recordEvent, summarize, formatAnalytics, DEFAULT_FILE };
