const assert = require('assert');
const { generate } = require('../src/generator');
const { exportPrompt } = require('../src/exporters');
const { parseArgs } = require('../src/cli');

function testGenerator() {
  const prompt = generate({
    agent: 'cursor',
    domain: 'security',
    task: 'Review API key handling',
    context: 'RAG script in REMnux',
    constraints: 'No hardcoded secrets',
    outputFormat: 'markdown',
    tone: 'professional',
    includeExamples: true
  });
  assert(prompt.includes('Role: Senior IDE Pair Programmer'), 'Should include agent role');
  assert(prompt.includes('Review API key handling'), 'Should include task');
  assert(prompt.includes('No hardcoded secrets'), 'Should include constraints');
  console.log('generator: OK');
}

function testExporters() {
  const prompt = generate({ task: 'Test', agent: 'generic' });
  const cr = exportPrompt(prompt, 'cursorrules');
  assert(cr.ext === '.cursorrules' && cr.content.includes('.cursorrules'), 'cursorrules export failed');
  const oc = exportPrompt(prompt, 'opencode');
  assert(oc.ext === '.json' && oc.content.includes('systemPrompt'), 'opencode export failed');
  const vs = exportPrompt(prompt, 'vscode', 'test');
  assert(vs.ext === '.code-snippets' && vs.content.includes('test'), 'vscode export failed');
  console.log('exporters: OK');
}

function testCLIArgs() {
  const args = parseArgs(['--agent', 'cursor', '--task', 'review', '--export', 'cursorrules']);
  assert(args.agent === 'cursor');
  assert(args.task === 'review');
  assert(args.export === 'cursorrules');
  console.log('cli args: OK');
}

function main() {
  testGenerator();
  testExporters();
  testCLIArgs();
  console.log('All tests passed.');
}

main();
