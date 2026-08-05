# Maintenance Playbook

How to keep Meta-Prompt-Architect relevant over time. Prompt tooling decays in
known places — this doc maps each freshness surface to the file that owns it
and the procedure for updating it.

## Freshness surfaces

| Surface | File | Why it stales | Suggested cadence |
|---|---|---|---|
| Platform playbooks | `src/platforms.js` | Agents ship new modes, context features, config file locations every few weeks | Every 1–2 months |
| Recipes | `src/recipes.js` | New ATT&CK techniques, OWASP LLM Top 10 revisions, new AI frameworks | Quarterly additions |
| Compliance mappings | `src/i18n.js` (`complianceClassic`/`complianceAI`) + security recipes | EU AI Act enforcement phases, NIST AI 600-1, ISO 42001, framework revisions | On regulatory events |
| Piping targets | `src/piping.js` | Agents change rules/config file paths and formats | When an agent updates |
| i18n strings | `src/i18n.js` | Every new prompt section must exist in all 4 locales (en/es/ja/zh) | Per feature |
| Golden files, badges | `tests/golden/`, README badges | Procedural — enforced by tests | Per change (see release checklist) |

## Updating a platform playbook

1. Edit the agent entry in `src/platforms.js` (`modes`, `context`, `config`,
   `multiAgent`, `terminal`, `playbook` tips). Verify facts against the
   agent's current docs — playbooks are instructions the generated prompt
   gives the agent, so wrong facts degrade every prompt.
2. `npm test` — playbook changes alter generated output, so golden files
   drift: `node tests/golden.js --update`, then re-run `npm test`.
3. CHANGELOG entry under `[Unreleased]`.

## Adding or updating recipes

Follow [recipe-authoring.md](recipe-authoring.md). In short:

1. Add the recipe object in `src/recipes.js` using only `{{task}}`,
   `{{context}}`, `{{constraints}}` placeholders and a registered category
   (new categories go in `recipeCategories` at the top of the file).
2. Verify: `node src/cli.js --validate-recipes` and `npm test` (the
   integration sweep renders every recipe and rejects leftover placeholders).
3. Update README: recipe count badge, the category table row/count, and the
   `recipes.js` line in Project Structure.

## Compliance mapping updates

Framework references live in two places:

- `src/i18n.js` — `complianceClassic` (ATT&CK/OWASP/NIST CSF) and
  `complianceAI` (OWASP LLM Top 10/ATLAS/NIST AI 600-1/EU AI Act/ISO 42001),
  in all four locales.
- Security recipes in `src/recipes.js` that cite specific framework versions.

When a framework revises (e.g., a new OWASP LLM Top 10 edition), update both,
regenerate goldens, and note it in the CHANGELOG.

## Piping target updates

`src/piping.js` maps each agent to its config file location and write mode
(overwrite vs append). When an agent changes where it reads prompts:

1. Update the target writer and its user-facing log line.
2. Update the `--pipe` row in README and the usage guide.
3. `npm test` (the piping suite asserts file paths for all 8 targets).

## i18n rule

Every user-visible prompt section must have strings in `en`, `es`, `ja`,
`zh`. A new section without all four locales is an incomplete change — the
Spanish golden file (`tests/golden/template-es-security.txt`) will catch
missing `es` strings, but review all four before committing.

## Release checklist

1. `npm test` — all suites green.
2. Badge sync: README `tests-N_passing` equals the real suite count;
   `recipes-N` equals `--validate-recipes` output.
3. If generated output changed intentionally: `node tests/golden.js --update`,
   then `npm test` again.
4. CHANGELOG: move `[Unreleased]` content into a versioned section with the
   date. Breaking changes require a major bump.
5. Version bump: `package.json`, `package-lock.json`, README version badge.
6. Live smoke (if LLM-facing code changed): `node src/cli.js --consult
   --agent generic --task "say OK" --no-project` and the same with
   `--stream --reasoning low` against the configured endpoint.
7. Commit, `git tag vX.Y.Z`, push branch and tag.

## Web UI parity check

When a CLI feature ships, confirm the web UI exposes it or consciously
doesn't: `public/index.html` (controls), `public/app.js` (`getConfig` +
render), `src/server.js` (endpoint passes the field through
`withCustomRecipes`). History, analytics, scoring, diff, streaming, and the
recipe builder are the parity-sensitive surfaces.
