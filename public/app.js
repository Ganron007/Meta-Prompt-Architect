const state = {
  prompt: '',
  config: {}
};

function getConfig() {
  return {
    agent: document.getElementById('agent').value,
    domain: document.getElementById('domain').value,
    task: document.getElementById('task').value.trim(),
    context: document.getElementById('context').value.trim(),
    constraints: document.getElementById('constraints').value.trim(),
    outputFormat: document.getElementById('outputFormat').value,
    tone: document.getElementById('tone').value,
    includeExamples: document.getElementById('includeExamples').checked
  };
}

async function generate() {
  const config = getConfig();
  if (!config.task) {
    showToast('Please enter a task description.', 'error');
    return;
  }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Generating...';

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
    document.getElementById('output').textContent = data.prompt;
    showToast('Prompt generated.');
  } catch (err) {
    showToast(err.message || 'Generation failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⚡</span> Generate Prompt';
  }
}

async function exportFile() {
  if (!state.prompt) {
    showToast('Generate a prompt first.', 'error');
    return;
  }

  const format = document.getElementById('exportFormat').value;
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
    showToast('Generate a prompt first.', 'error');
    return;
  }
  navigator.clipboard.writeText(state.prompt).then(() => {
    showToast('Copied to clipboard.');
  }).catch(() => {
    showToast('Copy failed.', 'error');
  });
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
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 2500);
}

document.getElementById('generateBtn').addEventListener('click', generate);
document.getElementById('exportBtn').addEventListener('click', exportFile);
document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
