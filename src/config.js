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

function resolveAPIKey(args) {
  if (args.apiKey) return args.apiKey;
  if (args.provider === 'openai' || args.provider === 'openai-compatible') return process.env.OPENAI_API_KEY;
  if (args.provider === 'deepseek') return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (args.provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (args.provider === 'mimo') return process.env.MIMO_API_KEY;
  return undefined;
}

function resolveAPIBase(args) {
  if (args.apiBase) return args.apiBase;
  if (args.provider === 'deepseek') return process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  if (args.provider === 'ollama') return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  if (args.provider === 'mimo') return process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com';
  return process.env.OPENAI_BASE_URL;
}

function resolveModel(args) {
  if (args.model) return args.model;
  const defaults = {
    openai: 'gpt-4o-mini',
    'openai-compatible': 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
    anthropic: 'claude-3-5-haiku-latest',
    ollama: 'llama3.2',
    mimo: 'mimo-v2.5'
  };
  return defaults[args.provider] || 'gpt-4o-mini';
}

function resolveFallbackModel(args) {
  if (args.fallbackModel) return args.fallbackModel;
  if (process.env.ARCHITECT_MODEL_FALLBACK) return process.env.ARCHITECT_MODEL_FALLBACK;
  if (args.provider === 'mimo') return args.model === 'mimo-v2.5-pro' ? 'mimo-v2.5' : 'mimo-v2.5-pro';
  return undefined;
}

function resolveLLM(args) {
  args.provider = args.provider || process.env.ARCHITECT_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : (process.env.ANTHROPIC_API_KEY ? 'anthropic' : (process.env.MIMO_API_KEY ? 'mimo' : 'ollama')));
  args.apiKey = resolveAPIKey(args);
  args.apiBase = args.apiBase || process.env.ARCHITECT_API_BASE || resolveAPIBase(args);
  args.model = args.model || process.env.ARCHITECT_MODEL || resolveModel(args);
  args.fallbackModel = resolveFallbackModel(args);
  if (args.provider !== 'ollama' && !args.apiKey) {
    throw new Error(`--consult requires an API key for provider "${args.provider}" (set the env var or pass --api-key), or use --provider ollama for a local model.`);
  }
  return args;
}

module.exports = { loadEnv, loadEnvChain, resolveAPIKey, resolveAPIBase, resolveModel, resolveFallbackModel, resolveLLM };
