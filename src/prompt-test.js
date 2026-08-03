const { callLLM } = require('./llm');

function wordCount(text) {
  return String(text || '').trim() ? String(text).trim().split(/\s+/).length : 0;
}

function stripCodeFences(text) {
  const m = String(text).match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  return m ? m[1].trim() : String(text).trim();
}

function checkFormatCompliance(response, outputFormat = 'markdown') {
  const text = String(response || '');
  switch (outputFormat) {
    case 'json': {
      try {
        JSON.parse(stripCodeFences(text));
        return { pass: true, detail: 'response parses as JSON' };
      } catch (err) {
        return { pass: false, detail: `response is not valid JSON (${err.message.slice(0, 60)})` };
      }
    }
    case 'table':
      return { pass: /^\s*\|.+\|.+\|/m.test(text), detail: 'expects a Markdown table (| col | col |)' };
    case 'code':
      return { pass: /```/.test(text), detail: 'expects a fenced code block' };
    case 'diagram':
      return { pass: /(```mermaid|graph\s+(TD|LR)|sequenceDiagram|──|──>|->|→|^\s*[-*]\s)/m.test(text), detail: 'expects a Mermaid/ASCII/list diagram' };
    case 'markdown':
      return { pass: /(^|\n)#{1,4}\s|(^|\n)\s*[-*]\s|(^|\n)\s*\d+[.)]\s/.test(text), detail: 'expects Markdown headings, bullets, or numbered lists' };
    case 'text':
    default:
      return { pass: text.trim().length > 0, detail: 'expects non-empty plain text' };
  }
}

function evaluateResponse(response, { outputFormat = 'markdown', criteria = [] } = {}) {
  const checks = [];
  const words = wordCount(response);
  checks.push({
    name: 'substance',
    pass: words >= 20,
    detail: words >= 20 ? `${words} words` : `only ${words} words — response lacks substance`
  });
  const format = checkFormatCompliance(response, outputFormat);
  checks.push({ name: 'format-compliance', pass: format.pass, detail: format.detail });
  for (const criterion of criteria) {
    const needle = String(criterion).trim();
    if (!needle) continue;
    const pass = String(response).toLowerCase().includes(needle.toLowerCase());
    checks.push({ name: `criterion: ${needle}`, pass, detail: pass ? 'found in response' : 'missing from response' });
  }
  const verdict = checks.every(c => c.pass) ? 'pass' : 'fail';
  return { checks, verdict, words };
}

function buildJudgeMessages(prompt, response) {
  return [
    {
      role: 'system',
      content: 'You are a strict prompt-evaluation judge. Reply with ONLY a JSON object, no markdown fences, no commentary: {"relevance": <1-10>, "completeness": <1-10>, "formatCompliance": <1-10>, "reasoning": "<one sentence>"}'
    },
    {
      role: 'user',
      content: `## The prompt under test\n${prompt}\n\n## The LLM response to evaluate\n${response}\n\nScore the response: relevance (does it address the prompt's objective), completeness (are all required elements present), formatCompliance (does it follow the requested output format).`
    }
  ];
}

function parseJudgeResponse(raw) {
  const text = stripCodeFences(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('judge returned no JSON object');
  const parsed = JSON.parse(text.slice(start, end + 1));
  for (const key of ['relevance', 'completeness', 'formatCompliance']) {
    const value = Number(parsed[key]);
    if (!Number.isFinite(value) || value < 1 || value > 10) {
      throw new Error(`judge score "${key}" missing or out of range`);
    }
    parsed[key] = Math.round(value);
  }
  parsed.reasoning = String(parsed.reasoning || '');
  return parsed;
}

async function runPromptTest(prompt, { model, apiKey, apiBase, fallbackModel, reasoning, outputFormat = 'markdown', criteria = [], judge = true } = {}) {
  const response = await callLLM(model, apiKey, apiBase, [{ role: 'user', content: prompt }], 0.2, { fallbackModel, reasoning });
  const evaluation = evaluateResponse(response, { outputFormat, criteria });
  let judgeResult = null;
  if (judge) {
    try {
      const raw = await callLLM(model, apiKey, apiBase, buildJudgeMessages(prompt, response), 0, { reasoning });
      judgeResult = parseJudgeResponse(raw);
    } catch (err) {
      judgeResult = { error: `judge unavailable: ${err.message}` };
    }
  }
  const verdict = evaluation.verdict === 'pass' && (!judgeResult || judgeResult.error || (judgeResult.relevance >= 6 && judgeResult.completeness >= 6)) ? 'pass' : 'fail';
  return { response, evaluation, judge: judgeResult, verdict };
}

function formatTestReport(result, { showResponse = false } = {}) {
  const lines = [`\n── Prompt Test ── verdict: ${result.verdict.toUpperCase()}`];
  for (const c of result.evaluation.checks) {
    lines.push(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);
  }
  if (result.judge) {
    if (result.judge.error) {
      lines.push(`  judge: ${result.judge.error}`);
    } else {
      lines.push(`  judge: relevance ${result.judge.relevance}/10 · completeness ${result.judge.completeness}/10 · format ${result.judge.formatCompliance}/10`);
      if (result.judge.reasoning) lines.push(`         ${result.judge.reasoning}`);
    }
  }
  if (showResponse) lines.push(`\n── Test Response ──\n${result.response}`);
  return lines.join('\n');
}

module.exports = { evaluateResponse, checkFormatCompliance, buildJudgeMessages, parseJudgeResponse, runPromptTest, formatTestReport };
