const fs = require('fs');
const path = require('path');
const { listRecipes, getRecipe } = require('./recipes');
const { validateCustomRecipe, resolveRecipeDirectory, STANDARD_PLACEHOLDERS } = require('./custom-recipes');

const PACK_FORMAT = 'mpa-recipe-pack';
const PACK_VERSION = 1;

function isUrl(source) {
  return /^https?:\/\//i.test(String(source || ''));
}

function normalizeSource(source) {
  const raw = String(source || '').trim();
  if (!isUrl(raw)) return raw;
  const gist = raw.match(/^https?:\/\/gist\.github\.com\/[^/]+\/([a-f0-9]+)\/?$/i);
  if (gist) return `https://gist.githubusercontent.com/${raw.split('/')[3]}/${gist[1]}/raw`;
  return raw;
}

function buildPack({ name, recipes, metadata = {} }) {
  const packName = String(name || '').trim();
  if (!packName) throw new Error('Recipe pack name is required.');
  if (!Array.isArray(recipes) || recipes.length === 0) throw new Error('Recipe pack needs at least one recipe.');
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    name: packName,
    metadata: {
      created: new Date().toISOString(),
      generator: 'meta-prompt-architect',
      count: recipes.length,
      ...metadata
    },
    recipes
  };
}

function validatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return { valid: false, errors: ['pack must be a JSON object'] };
  }
  if (pack.format !== PACK_FORMAT) errors.push(`format must be "${PACK_FORMAT}"`);
  if (typeof pack.name !== 'string' || !pack.name.trim()) errors.push('pack name is required');
  if (!Array.isArray(pack.recipes) || pack.recipes.length === 0) {
    errors.push('pack must contain a non-empty recipes array');
  } else {
    pack.recipes.forEach((recipe, i) => {
      const check = validateCustomRecipe(recipe);
      if (!check.valid) errors.push(`recipe ${i + 1} (${recipe && recipe.id ? recipe.id : 'no-id'}): ${check.errors.join('; ')}`);
    });
  }
  return { valid: errors.length === 0, errors };
}

function exportPack({ category, name, customRecipes = {} }) {
  const wanted = String(category || '').trim().toLowerCase();
  const listed = listRecipes(customRecipes);
  const selected = wanted === 'all'
    ? listed
    : listed.filter(r => r.category === wanted);
  if (selected.length === 0) {
    throw new Error(wanted === 'all' ? 'No recipes available to export.' : `No recipes in category "${category}". See --recipes.`);
  }
  const recipes = selected.map(r => {
    const recipe = getRecipe(r.id, customRecipes);
    return { ...recipe, id: r.id, placeholders: recipe.placeholders || [...STANDARD_PLACEHOLDERS] };
  });
  return buildPack({
    name: name || (wanted === 'all' ? 'full-recipe-book' : `${wanted}-recipes`),
    recipes,
    metadata: { category: wanted }
  });
}

async function readPackSource(source) {
  const normalized = normalizeSource(source);
  if (isUrl(normalized)) {
    const res = await fetch(normalized, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${normalized}`);
    return res.text();
  }
  const filePath = path.resolve(normalized);
  if (!fs.existsSync(filePath)) throw new Error(`Recipe pack file not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

async function importPack(source, options = {}) {
  let pack;
  try {
    pack = JSON.parse(await readPackSource(source));
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error(`Recipe pack is not valid JSON (${err.message}).`);
    throw err;
  }
  const validation = validatePack(pack);
  if (!validation.valid) throw new Error(`Invalid recipe pack: ${validation.errors.join(' | ')}`);

  const directory = resolveRecipeDirectory(options);
  fs.mkdirSync(directory, { recursive: true });
  const imported = [];
  const skipped = [];
  for (const recipe of pack.recipes) {
    const filePath = path.join(directory, `${recipe.id}.json`);
    if (fs.existsSync(filePath) && !options.overwrite) {
      skipped.push(recipe.id);
      continue;
    }
    fs.writeFileSync(filePath, `${JSON.stringify(recipe, null, 2)}\n`, 'utf8');
    imported.push(recipe.id);
  }
  return { pack: { name: pack.name, count: pack.recipes.length }, directory, imported, skipped };
}

module.exports = { PACK_FORMAT, isUrl, normalizeSource, buildPack, validatePack, exportPack, importPack };
