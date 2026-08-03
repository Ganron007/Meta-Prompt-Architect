const fs = require('fs');
const os = require('os');
const path = require('path');
const { recipeCategories } = require('./recipes');

const STANDARD_PLACEHOLDERS = ['task', 'context', 'constraints'];
const PLACEHOLDER_NAME = /^[a-z][a-z0-9_]*$/;
const RECIPE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toLines(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(/\r?\n|\|/).map(item => item.trim()).filter(Boolean);
}

function normalizePlaceholders(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,|]+/);
  const seen = new Set();
  const normalized = [];

  for (const item of raw) {
    const name = String(item || '').trim().replace(/^\{\{|\}\}$/g, '');
    if (!name || STANDARD_PLACEHOLDERS.includes(name) || seen.has(name)) continue;
    if (!PLACEHOLDER_NAME.test(name)) {
      throw new Error(`Invalid custom placeholder "${name}". Use lowercase letters, numbers, and underscores.`);
    }
    seen.add(name);
    normalized.push(name);
  }

  return normalized;
}

function displayName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function buildTemplate({ role, steps, hardRules, outputFormat, placeholders }) {
  const customInputs = placeholders.filter(name => !STANDARD_PLACEHOLDERS.includes(name));
  const additionalInputs = customInputs.length
    ? `\n## Additional inputs\n\n${customInputs.map(name => `- ${displayName(name)}: {{${name}}}`).join('\n')}\n`
    : '';

  return `You are ${role}.

## Mission

{{task}}

{{context}}${additionalInputs}
## Workflow

${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Hard rules

${hardRules.map(rule => `- ${rule}`).join('\n')}
- {{constraints}}

## Output format

${outputFormat}`;
}

function buildCustomRecipe(input = {}) {
  const label = String(input.name || input.label || '').trim();
  const role = String(input.role || '').trim();
  const category = String(input.category || '').trim();
  const steps = toLines(input.steps);
  const hardRules = toLines(input.hardRules || input.rules);
  const outputFormat = String(input.outputFormat || '').trim();
  const customPlaceholders = normalizePlaceholders(input.placeholders);

  if (!label) throw new Error('Recipe name is required.');
  if (!role) throw new Error('Recipe role/persona is required.');
  if (!category) throw new Error('Recipe category is required.');
  if (steps.length === 0) throw new Error('Add at least one workflow step.');
  if (hardRules.length === 0) throw new Error('Add at least one hard rule.');
  if (!outputFormat) throw new Error('Recipe output format is required.');

  const id = slugify(input.id || label);
  if (!id) throw new Error('Recipe name must contain letters or numbers.');

  const placeholders = [...STANDARD_PLACEHOLDERS, ...customPlaceholders];
  const recipe = {
    schemaVersion: 1,
    id,
    label,
    tagline: String(input.tagline || `Custom recipe for ${label}.`).trim(),
    category,
    origin: 'Custom Recipe Builder',
    taskHint: String(input.taskHint || 'Describe the task and provide the requested inputs.').trim(),
    placeholders,
    template: buildTemplate({ role, steps, hardRules, outputFormat, placeholders })
  };

  const validation = validateCustomRecipe(recipe);
  if (!validation.valid) throw new Error(`Invalid custom recipe: ${validation.errors.join('; ')}`);
  return recipe;
}

function validateCustomRecipe(recipe) {
  const errors = [];
  if (!recipe || typeof recipe !== 'object') return { valid: false, errors: ['recipe must be an object'] };

  for (const field of ['id', 'label', 'tagline', 'category', 'template']) {
    if (typeof recipe[field] !== 'string' || !recipe[field].trim()) {
      errors.push(`missing required field "${field}"`);
    }
  }

  if (typeof recipe.id === 'string' && !RECIPE_ID.test(recipe.id)) {
    errors.push('id must use lowercase letters, numbers, and hyphens');
  }
  if (typeof recipe.category === 'string' && !Object.prototype.hasOwnProperty.call(recipeCategories, recipe.category)) {
    errors.push(`unregistered category "${recipe.category}"`);
  }

  const placeholders = Array.isArray(recipe.placeholders) ? recipe.placeholders : [];
  const declared = new Set(placeholders);
  for (const name of STANDARD_PLACEHOLDERS) {
    if (!declared.has(name)) errors.push(`missing required placeholder "${name}"`);
  }
  for (const name of declared) {
    if (!PLACEHOLDER_NAME.test(name)) errors.push(`invalid placeholder name "${name}"`);
  }

  if (typeof recipe.template === 'string') {
    if (!recipe.template.includes('{{task}}')) errors.push('template must contain {{task}}');
    const matches = [...recipe.template.matchAll(/\{\{([^{}]*)\}\}/g)];
    const openMarkers = (recipe.template.match(/\{\{/g) || []).length;
    if (openMarkers !== matches.length) errors.push('template contains an unmatched {{ placeholder marker');
    for (const match of matches) {
      const raw = match[0];
      const name = match[1].trim();
      if (!declared.has(name)) errors.push(`undeclared placeholder ${raw}`);
      else if (raw !== `{{${name}}}`) errors.push(`placeholder ${raw} must use the exact {{${name}}} form`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function resolveRecipeDirectory({ scope = 'project', project = process.cwd(), recipeDir } = {}) {
  if (recipeDir) return path.resolve(recipeDir);
  if (scope === 'user') return path.join(os.homedir(), '.mpa', 'recipes');
  if (scope === 'project') return path.join(path.resolve(project || process.cwd()), '.mpa', 'recipes');
  throw new Error('Recipe scope must be "project" or "user".');
}

function saveCustomRecipe(recipeInput, options = {}) {
  const recipe = recipeInput && recipeInput.template ? recipeInput : buildCustomRecipe(recipeInput);
  const validation = validateCustomRecipe(recipe);
  if (!validation.valid) throw new Error(`Invalid custom recipe: ${validation.errors.join('; ')}`);

  const directory = resolveRecipeDirectory(options);
  const filePath = path.join(directory, `${recipe.id}.json`);
  if (fs.existsSync(filePath) && !options.overwrite) {
    throw new Error(`Custom recipe already exists: ${filePath}. Use --overwrite-recipe to replace it.`);
  }

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(recipe, null, 2)}\n`, 'utf8');
  return { recipe, directory, filePath };
}

function loadCustomRecipes({ project = process.cwd(), recipeDir, includeUser = true, includeProject = true } = {}) {
  const directories = recipeDir
    ? [path.resolve(recipeDir)]
    : [
      ...(includeUser ? [resolveRecipeDirectory({ scope: 'user' })] : []),
      ...(includeProject ? [resolveRecipeDirectory({ scope: 'project', project })] : [])
    ];
  const recipes = {};

  for (const directory of [...new Set(directories)]) {
    try {
      if (!fs.existsSync(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') continue;
        try {
          const recipe = JSON.parse(fs.readFileSync(path.join(directory, entry.name), 'utf8'));
          if (validateCustomRecipe(recipe).valid) recipes[recipe.id] = recipe;
        } catch { /* Ignore malformed custom recipe files; saved recipes remain usable. */ }
      }
    } catch { /* Missing or unreadable recipe directories are optional. */ }
  }

  return recipes;
}

function parseVariables(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const variables = JSON.parse(raw);
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      throw new Error('must be a JSON object');
    }
    return variables;
  } catch (err) {
    throw new Error(`--vars must be a JSON object (${err.message}).`);
  }
}

module.exports = {
  STANDARD_PLACEHOLDERS,
  buildCustomRecipe,
  validateCustomRecipe,
  resolveRecipeDirectory,
  saveCustomRecipe,
  loadCustomRecipes,
  parseVariables
};
