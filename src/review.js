const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

function defaultEditor() {
  return process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'vi');
}

function editInEditor(text, { editor = defaultEditor(), filePath = path.join(os.tmpdir(), `mpa-review-${Date.now()}.md`) } = {}) {
  fs.writeFileSync(filePath, text, 'utf8');
  try {
    execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
    return fs.readFileSync(filePath, 'utf8');
  } finally {
    try { fs.unlinkSync(filePath); } catch { /* temp cleanup is best-effort */ }
  }
}

async function confirmApproval(question, input = process.stdin, output = process.stderr) {
  if (!input.isTTY) return true;
  const rl = readline.createInterface({ input, output });
  return new Promise(resolve => {
    rl.question(`${question} [y/N] `, answer => {
      rl.close();
      resolve(/^y(es)?$/i.test(String(answer).trim()));
    });
  });
}

async function reviewPrompt(prompt, { editor, filePath, question = 'Approve this prompt?', input, output } = {}) {
  const edited = editInEditor(prompt, { editor, filePath });
  const approved = await confirmApproval(question, input, output);
  return { prompt: edited, approved, changed: edited !== prompt };
}

module.exports = { defaultEditor, editInEditor, confirmApproval, reviewPrompt };
