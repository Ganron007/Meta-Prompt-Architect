const fs = require('fs');
const path = require('path');

const KEY_FILES = [
  'AGENTS.md', 'CLAUDE.md', 'README.md', 'README',
  'package.json', 'pyproject.toml', 'requirements.txt', 'Pipfile',
  'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle',
  '.cursorrules', 'opencode.json', 'opencode.jsonc',
  'docker-compose.yml', 'Dockerfile', 'Makefile', 'Vagrantfile',
  '.env.example'
];

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'env', 'target', 'coverage',
  '.idea', '.vs', '.turbo', '.cache', 'tmp', 'temp', 'logs'
]);

const SKIP_PATTERNS = [/^\.env($|\.)/i, /secret/i, /\.pem$/i, /\.key$/i];

function scanProject(root, opts = {}) {
  root = path.resolve(root || process.cwd());
  if (!fs.existsSync(root)) return null;

  const maxFileBytes = opts.maxFileBytes || 6000;
  const files = {};

  for (const name of KEY_FILES) {
    const p = path.join(root, name);
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const content = fs.readFileSync(p, 'utf8');
        files[name] = content.slice(0, maxFileBytes) + (content.length > maxFileBytes ? '\n... [truncated]' : '');
      }
    } catch { /* unreadable file — skip */ }
  }

  const tree = buildTree(root, {
    maxDepth: opts.maxDepth ?? 2,
    maxEntries: opts.maxEntries ?? 80
  });

  const git = readGitInfo(root);

  const commands = detectCommands(files);
  const stack = detectStack(files, tree);

  return { root, files, tree, git, commands, stack };
}

function detectStack(files = {}, tree = '') {
  const stack = [];
  const pkg = files['package.json'];
  let pkgJson = null;
  if (pkg) {
    try { pkgJson = JSON.parse(pkg.replace(/\n\.\.\. \[truncated\]$/, '')); } catch { /* partial */ }
  }
  if (pkgJson) {
    const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
    if (deps['@tauri-apps/api']) stack.push('tauri');
    if (deps.react || deps.vue || deps.svelte) stack.push('frontend');
    stack.push('node');
  }
  const ml = /torch|transformers|peft|qlora/i.test(files['pyproject.toml'] || '') || /torch|transformers|peft|qlora/i.test(files['requirements.txt'] || '');
  if (files['pyproject.toml'] || files['requirements.txt'] || files['Pipfile']) stack.push('python');
  if (ml) stack.push('python-ml');
  if (files['Cargo.toml']) stack.push('rust');
  if (files['go.mod']) stack.push('go');
  if (files['docker-compose.yml'] || files['Dockerfile']) stack.push('docker');
  if (files['Vagrantfile'] || /Vagrantfile/.test(tree)) stack.push('vagrant');
  if (/\.csproj|\.sln/.test(tree)) stack.push('dotnet');
  return stack;
}

function detectCommands(files = {}) {
  const commands = [];
  const pkg = files['package.json'];
  if (pkg) {
    try {
      const scripts = JSON.parse(pkg.replace(/\n\.\.\. \[truncated\]$/, '')).scripts || {};
      if (scripts.test) commands.push('npm test');
      if (scripts.lint) commands.push('npm run lint');
      if (scripts.typecheck) commands.push('npm run typecheck');
      if (scripts.build) commands.push('npm run build');
    } catch { /* unparsable package.json — skip */ }
  }
  if (files['Makefile'] && /(^|\n)\s*test\s*:/.test(files['Makefile'])) commands.push('make test');
  if ((files['pyproject.toml'] && /pytest/i.test(files['pyproject.toml'])) ||
      (files['requirements.txt'] && /pytest/i.test(files['requirements.txt']))) commands.push('pytest');
  if (files['Cargo.toml']) commands.push('cargo test');
  if (files['go.mod']) commands.push('go test ./...');
  return [...new Set(commands)].slice(0, 6);
}

function buildTree(root, { maxDepth, maxEntries }) {
  const lines = [];
  let count = 0;

  function walk(dir, depth, prefix) {
    if (depth > maxDepth || count >= maxEntries) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    entries = entries
      .filter(e => !IGNORE_DIRS.has(e.name) && !SKIP_PATTERNS.some(p => p.test(e.name)))
      .filter(e => !(e.name.startsWith('.') && e.name !== '.github'))
      .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));

    for (const e of entries) {
      if (count >= maxEntries) return;
      count++;
      const isLast = e === entries[entries.length - 1];
      lines.push(`${prefix}${isLast ? '└─' : '├─'} ${e.name}${e.isDirectory() ? '/' : ''}`);
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), depth + 1, prefix + (isLast ? '   ' : '│  '));
      }
    }
  }

  lines.push(path.basename(root) + '/');
  walk(root, 1, '');
  return lines.join('\n');
}

function readGitInfo(root) {
  try {
    const headPath = path.join(root, '.git', 'HEAD');
    if (!fs.existsSync(headPath)) return null;
    const head = fs.readFileSync(headPath, 'utf8').trim();
    const branch = head.startsWith('ref:') ? head.split('/').pop() : head.slice(0, 7);
    return { branch };
  } catch { return null; }
}

function summarize(scan) {
  if (!scan) return '(no project context available)';
  let out = `Root: ${scan.root}\n`;
  if (scan.git?.branch) out += `Git branch: ${scan.git.branch}\n`;
  out += `\nStructure:\n${scan.tree}\n`;
  for (const [name, content] of Object.entries(scan.files)) {
    out += `\n--- ${name} ---\n${content}\n`;
  }
  return out;
}

module.exports = { scanProject, summarize, detectCommands, detectStack, KEY_FILES };
