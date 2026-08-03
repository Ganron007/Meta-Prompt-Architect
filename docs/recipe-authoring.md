# Recipe Authoring Guide

Recipes are proven one-shot mega-prompts. A recipe takes a user's task (plus
optional context/constraints/variables) and expands it into a complete,
structured agent prompt.

## Where recipes live

| Kind | Location | Share via |
|---|---|---|
| Bundled | `src/recipes.js` (`recipes` map) | ships with the tool |
| Custom (project) | `.mpa/recipes/<id>.json` | commit to your repo |
| Custom (user) | `~/.mpa/recipes/<id>.json` | `--export-pack` / Gist |

## Recipe object shape

```json
{
  "schemaVersion": 1,
  "id": "my-recipe",
  "label": "My Recipe",
  "tagline": "One-line description shown in listings.",
  "category": "build",
  "origin": "Custom Recipe Builder",
  "taskHint": "Hint shown in the web UI when the recipe is selected.",
  "placeholders": ["task", "context", "constraints", "audience"],
  "template": "You are ...\n\n## Mission\n\n{{task}}\n..."
}
```

Rules enforced by `validateCustomRecipe` (also run by `--validate-recipes`):

- `id` — kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), unique across bundled +
  custom recipes.
- `label`, `tagline`, `category`, `template` — required, non-empty.
- `category` — must be registered (see Categories below).
- `placeholders` — must include `task`, `context`, `constraints`; custom names
  are `^[a-z][a-z0-9_]*$`.
- `template` — must contain `{{task}}`; every `{{name}}` must be declared in
  `placeholders` and use the exact `{{name}}` form (no spaces).

## Placeholders

| Placeholder | Filled from |
|---|---|
| `{{task}}` | `--task` (required, defaults to `[DESCRIBE YOUR PROJECT HERE]`) |
| `{{context}}` | `--context` (rendered as an `## Additional context` section) |
| `{{constraints}}` | `--constraints` (defaults to `No additional constraints.`) |
| custom | `--vars '{"name": "value"}'` or the web UI recipe input fields |

## Categories

Bundled category ids (register new ones in `recipeCategories` in
`src/recipes.js` — used by `--recipes` grouping and the web UI optgroups):

`build`, `security`, `sec-research`, `dfir`, `reverse-eng`, `malware`, `aisec`,
`redteam`, `blueteam`, `cloudsec`, `appsec`, `osint`, `crypto`, `ai`,
`ai-security`, `ai-ops`

## Quality bar

A good recipe:

1. **Assigns a concrete role** ("You are a staff release engineer…"), not a
   generic assistant.
2. **Breaks work into ordered phases/steps** with completion criteria.
3. **States hard rules explicitly** ("Do not invent evidence", "Never skip
   unresolved blockers") — these score well on the Constraints dimension.
4. **Defines the output format** precisely (sections, tables, fields).
5. **Leaves no open placeholders** — after interpolation, nothing the agent
   must guess.
6. **Is self-contained** — the agent can execute without follow-up questions.

Score your rendered recipe: `node src/cli.js --recipe <id> --task "x" --score`.
Aim for grade B (75%) or better.

## Testing requirements

- `npm test` runs the integration sweep: **every** recipe must render with no
  leftover `{{placeholders}}` and must interpolate `{{task}}`.
- If you add a bundled recipe with template sections that appear in the golden
  prompts, regenerate goldens intentionally: `node tests/golden.js --update`.
- Validate the book: `node src/cli.js --validate-recipes`.

## Authoring workflows

- **Guided builder (CLI):** `--create-recipe --recipe-name "..." --recipe-role
  "..." --recipe-steps "a|b|c" --recipe-rules "x|y" --recipe-output "..."`
- **Web UI wizard:** "Build recipe" toggle → form with live preview → save.
- **From an existing prompt:** `--templatize my-prompt.md` (LLM or `--offline`).
