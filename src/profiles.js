const fs = require('fs');
const os = require('os');
const path = require('path');

const PROFILE_FIELDS = [
  'agent', 'agents', 'domain', 'outputFormat', 'tone', 'lang', 'includeExamples',
  'rewrite', 'consult', 'provider', 'model', 'apiBase', 'recipe', 'chain',
  'score', 'expect', 'noJudge', 'context', 'constraints'
];

const PROFILE_NAME = /^[a-z0-9][a-z0-9-]*$/;

function resolveProfileDirectory({ scope = 'project', project = process.cwd(), profileDir } = {}) {
  if (profileDir) return path.resolve(profileDir);
  if (scope === 'user') return path.join(os.homedir(), '.mpa', 'profiles');
  if (scope === 'project') return path.join(path.resolve(project || process.cwd()), '.mpa', 'profiles');
  throw new Error('Profile scope must be "project" or "user".');
}

function validateProfileName(name) {
  if (!PROFILE_NAME.test(String(name || ''))) {
    throw new Error(`Invalid profile name "${name}". Use lowercase letters, numbers, hyphens.`);
  }
}

function pickProfileFields(args = {}) {
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    if (args[field] !== undefined) profile[field] = args[field];
  }
  return profile;
}

function saveProfile(name, args, options = {}) {
  validateProfileName(name);
  const directory = resolveProfileDirectory(options);
  const filePath = path.join(directory, `${name}.json`);
  if (fs.existsSync(filePath) && !options.overwrite) {
    throw new Error(`Profile already exists: ${filePath}. Use --overwrite-recipe to replace it.`);
  }
  const profile = { name, savedAt: new Date().toISOString(), config: pickProfileFields(args) };
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return { profile, filePath };
}

function loadProfile(name, options = {}) {
  validateProfileName(name);
  const directories = options.profileDir
    ? [path.resolve(options.profileDir)]
    : [resolveProfileDirectory({ scope: 'project', project: options.project }), resolveProfileDirectory({ scope: 'user' })];
  for (const directory of [...new Set(directories)]) {
    const filePath = path.join(directory, `${name}.json`);
    if (!fs.existsSync(filePath)) continue;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed.config !== 'object') {
      throw new Error(`Profile file is malformed: ${filePath}`);
    }
    return { profile: parsed, filePath };
  }
  throw new Error(`Profile not found: "${name}". See --profiles.`);
}

function listProfiles(options = {}) {
  const directories = options.profileDir
    ? [path.resolve(options.profileDir)]
    : [resolveProfileDirectory({ scope: 'project', project: options.project }), resolveProfileDirectory({ scope: 'user' })];
  const found = [];
  for (const directory of [...new Set(directories)]) {
    try {
      if (!fs.existsSync(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          found.push({ name: entry.name.slice(0, -5), directory });
        }
      }
    } catch { /* unreadable profile dirs are optional */ }
  }
  return found;
}

function applyProfile(args, config, providedFlags) {
  const applied = [];
  for (const [key, value] of Object.entries(config)) {
    const flag = `--${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`;
    if (!providedFlags.has(flag)) {
      args[key] = value;
      applied.push(key);
    }
  }
  return applied;
}

module.exports = { PROFILE_FIELDS, resolveProfileDirectory, validateProfileName, pickProfileFields, saveProfile, loadProfile, listProfiles, applyProfile };
