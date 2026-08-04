function ciWorkflow(stack = []) {
  const steps = [];
  if (stack.includes('node')) steps.push('      - run: npm ci\n      - run: npm test\n      - run: npm run build');
  if (stack.includes('python')) steps.push('      - run: pip install -r requirements.txt\n      - run: pytest -q');
  if (stack.includes('rust')) steps.push('      - run: cargo test --locked\n      - run: cargo build --release');
  if (stack.includes('go')) steps.push('      - run: go test ./...\n      - run: go build ./...');
  if (stack.includes('dotnet')) steps.push('      - run: dotnet build -c Release\n      - run: dotnet test -c Release --no-build');
  if (stack.includes('docker')) steps.push('      - run: docker compose config -q');
  if (!steps.length) steps.push('      - run: echo "Add your test command here" && exit 1');
  return `name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${steps.join('\n')}
`;
}

function makefile(stack = [], commands = []) {
  const test = commands.find(c => /test/.test(c)) || (stack.includes('python') ? 'pytest -q' : stack.includes('rust') ? 'cargo test' : stack.includes('go') ? 'go test ./...' : stack.includes('dotnet') ? 'dotnet test' : stack.includes('node') ? 'npm test' : 'echo "no test runner detected"');
  const build = stack.includes('node') ? 'npm run build' : stack.includes('rust') ? 'cargo build --release' : stack.includes('go') ? 'go build ./...' : stack.includes('dotnet') ? 'dotnet build -c Release' : stack.includes('python') ? 'python -m compileall .' : 'echo "no build step"';
  return `.PHONY: test build

test:
\t${test}

build:
\t${build}
`;
}

function envExample(stack = []) {
  const lines = ['# Environment template — copy to .env and fill in real values.', '# Secrets must never be committed.'];
  if (stack.includes('node') || stack.includes('python')) lines.push('API_KEY=', 'API_BASE_URL=');
  if (stack.includes('docker')) lines.push('COMPOSE_PROJECT_NAME=myapp');
  return lines.join('\n') + '\n';
}

function buildScaffold({ stack = [], commands = [] } = {}) {
  const files = {
    '.github/workflows/ci.yml': ciWorkflow(stack),
    'Makefile': makefile(stack, commands),
    '.env.example': envExample(stack)
  };
  return files;
}

module.exports = { buildScaffold, ciWorkflow, makefile, envExample };
