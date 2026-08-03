const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  try {
    const p = file || path.join(process.cwd(), '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch { /* best-effort env loading */ }
}

function loadEnvChain() {
  loadEnv(path.join(__dirname, '..', '.env'));
  loadEnv(path.join(process.cwd(), '.env'));
}

const { DEFAULT_BASE_URL } = require('./llm');

const VALID_REASONING = ['low', 'medium', 'high'];

function resolveLLM(args) {
  args.apiKey = args.apiKey || process.env.OPENAI_API_KEY;
  const customBase = args.apiBase || process.env.OPENAI_BASE_URL;
  args.apiBase = (customBase || DEFAULT_BASE_URL).replace(/\/+$/, '');
  args.model = args.model || process.env.OPENAI_MODEL;
  args.reasoning = args.reasoning || process.env.OPENAI_REASONING || undefined;
  args.fallbackModel = args.fallbackModel || process.env.OPENAI_FALLBACK_MODEL || undefined;
  if (args.reasoning && !VALID_REASONING.includes(args.reasoning)) {
    throw new Error(`Invalid reasoning effort "${args.reasoning}" — use one of: ${VALID_REASONING.join(', ')}.`);
  }
  if (!args.model) {
    throw new Error('No model configured — set OPENAI_MODEL in .env or pass --model.');
  }
  if (!args.apiKey && !customBase) {
    throw new Error('LLM features need an API key — set OPENAI_API_KEY in .env or pass --api-key (or point OPENAI_BASE_URL at a keyless local server).');
  }
  return args;
}

module.exports = { loadEnv, loadEnvChain, resolveLLM, VALID_REASONING };
