const fs = require('fs');
const path = require('path');
const { generate } = require('../src/generator');
const { buildChain, wrapChainStep } = require('../src/chain');

const GOLDEN_DIR = path.join(__dirname, 'golden');

const CASES = [
  {
    id: 'template-cursor-security',
    description: 'template mode, cursor + security domain',
    build: () => generate({ agent: 'cursor', domain: 'security', task: 'Review API key handling', context: 'RAG script in REMnux', constraints: 'No hardcoded secrets', outputFormat: 'markdown', tone: 'professional', includeExamples: true })
  },
  {
    id: 'recipe-one-shot-game',
    description: 'recipe mode, one-shot-game',
    build: () => generate({ agent: 'claude', task: 'a snake game', recipe: 'one-shot-game' })
  },
  {
    id: 'chain-prd-saas',
    description: 'chain mode, prd-then-build → saas-starter (step 1)',
    build: async () => {
      const chain = buildChain(['prd-then-build', 'saas-starter']);
      const prompt = await generate({ agent: 'gpt', task: 'kanban app', recipe: chain[0].id });
      return wrapChainStep(chain, 0, prompt);
    }
  },
  {
    id: 'template-es-security',
    description: 'template mode, Spanish scaffolding',
    build: () => generate({ agent: 'cursor', domain: 'security', task: 'Review API key handling', lang: 'es' })
  }
];

async function runGoldenTests({ update = false } = {}) {
  const results = [];
  for (const c of CASES) {
    const file = path.join(GOLDEN_DIR, `${c.id}.txt`);
    const actual = await c.build();
    if (update) {
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.writeFileSync(file, actual, 'utf8');
      results.push({ id: c.id, status: 'updated' });
      continue;
    }
    if (!fs.existsSync(file)) {
      results.push({ id: c.id, status: 'missing', file });
      continue;
    }
    const expected = fs.readFileSync(file, 'utf8');
    results.push({ id: c.id, status: actual === expected ? 'match' : 'drift', file });
  }
  return results;
}

module.exports = { runGoldenTests, CASES, GOLDEN_DIR };

if (require.main === module) {
  const update = process.argv.includes('--update') || process.env.GOLDEN_UPDATE === '1';
  runGoldenTests({ update }).then(results => {
    for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id}`);
    const failed = results.filter(r => r.status === 'drift' || r.status === 'missing');
    process.exit(failed.length && !update ? 1 : 0);
  });
}
