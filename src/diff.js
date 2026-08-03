const CONFIG_FIELDS = ['agent', 'domain', 'task', 'context', 'constraints', 'outputFormat', 'tone', 'includeExamples', 'recipe', 'mode', 'consult', 'rewrite'];

function diffLines(a, b) {
  const A = String(a || '').split('\n');
  const B = String(b || '').split('\n');
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ type: 'same', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', text: A[i] }); i++; }
    else { ops.push({ type: 'add', text: B[j] }); j++; }
  }
  while (i < n) ops.push({ type: 'del', text: A[i++] });
  while (j < m) ops.push({ type: 'add', text: B[j++] });
  return ops;
}

function summarizeDiff(ops) {
  return {
    added: ops.filter(o => o.type === 'add').length,
    removed: ops.filter(o => o.type === 'del').length,
    unchanged: ops.filter(o => o.type === 'same').length
  };
}

function collapseSameRuns(ops, context = 2) {
  const out = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type !== 'same') { out.push(ops[i]); i++; continue; }
    let j = i;
    while (j < ops.length && ops[j].type === 'same') j++;
    const run = ops.slice(i, j);
    if (run.length <= context * 2 + 1) out.push(...run);
    else {
      out.push(...run.slice(0, context));
      out.push({ type: 'gap', text: `${run.length - context * 2} unchanged lines` });
      out.push(...run.slice(-context));
    }
    i = j;
  }
  return out;
}

function formatDiff(ops) {
  const lines = [];
  for (const op of collapseSameRuns(ops)) {
    if (op.type === 'same') lines.push(`  ${op.text}`);
    else if (op.type === 'del') lines.push(`- ${op.text}`);
    else if (op.type === 'add') lines.push(`+ ${op.text}`);
    else lines.push(`  ··· (${op.text})`);
  }
  return lines.join('\n');
}

function configChanges(entryA = {}, entryB = {}) {
  const changes = [];
  for (const field of CONFIG_FIELDS) {
    const a = entryA[field];
    const b = entryB[field];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      changes.push({ field, from: a ?? null, to: b ?? null });
    }
  }
  return changes;
}

module.exports = { diffLines, summarizeDiff, collapseSameRuns, formatDiff, configChanges, CONFIG_FIELDS };
