# Usage Guide

Task-oriented walkthrough of every Meta-Prompt Architect feature, with
copy-paste examples. CLI commands assume you are in the repo root
(`node src/cli.js ...`); the same features are available in the web UI
(`npm start` → http://localhost:3000).

- [Setup](#setup)
- [Your first prompt (template mode)](#your-first-prompt-template-mode)
- [Project grounding](#project-grounding)
- [Execution loop](#execution-loop)
- [Consult mode (LLM-authored)](#consult-mode-llm-authored)
- [Reasoning effort](#reasoning-effort)
- [One-shot recipes](#one-shot-recipes)
- [Prompt chaining](#prompt-chaining)
- [Quality scoring](#quality-scoring)
- [Prompt testing](#prompt-testing)
- [Rewrite (input polishing)](#rewrite-input-polishing)
- [Custom recipes](#custom-recipes)
- [Recipe packs (share/import)](#recipe-packs)
- [Templatize existing prompts](#templatize-existing-prompts)
- [Profiles](#profiles)
- [History & version diff](#history--version-diff)
- [Review gate](#review-gate)
- [Export formats](#export-formats)
- [Direct piping to agents](#direct-piping-to-agents)
- [Batch generation](#batch-generation)
- [Multi-language scaffolding](#multi-language-scaffolding)
- [Analytics](#analytics)
- [Plugins](#plugins)
- [JSON output](#json-output)
- [Configuration reference](#configuration-reference)

## Setup

```bash
git clone https://github.com/Ganron007/Meta-Prompt-Architect.git
cd Meta-Prompt-Architect
npm install
cp .env.example .env   # then fill in your LLM settings
```

`.env` (only needed for LLM features — template mode works fully offline):

```ini
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # any OpenAI-compatible endpoint
OPENAI_MODEL=your-model
# OPENAI_REASONING=high                     # optional: low | medium | high
# OPENAI_FALLBACK_MODEL=backup-model        # optional retry model
```

Local models work too — Ollama: `OPENAI_BASE_URL=http://localhost:11434/v1`
(no API key required for keyless servers).

## Your first prompt (template mode)

Fast, offline, deterministic. No LLM involved.

```bash
node src/cli.js --agent cursor --domain security --task "Review API key handling"
```

Useful modifiers:

```bash
# Add background + hard rules
node src/cli.js --agent claude --domain code-review \
  --task "Review the auth module" \
  --context "Express 4 app, JWT sessions, Postgres" \
  --constraints "No breaking API changes; cite file:line for every finding"

# Change output format / tone / include examples
node src/cli.js --agent gpt --task "Plan a migration" --format table --tone strict --examples
```

Agents: `cursor`, `claude`, `opencode`, `deepseek`, `kimi`, `gpt`, `windsurf`,
`cline`, `generic`. Domains: `lab-build`, `code-review`, `security`,
`feature-exploration`, `release-readiness`, `general`.

## Project grounding

Every prompt is automatically prefilled with real facts from your project —
root, git branch, trimmed structure, and detected verify commands
(`npm test`, `make test`, `pytest`, `cargo test`, `go test ./...`). This is
what keeps output concrete instead of generic.

```bash
# Ground in the current directory (default)
node src/cli.js --agent cursor --task "Fix the login bug"

# Ground in another project
node src/cli.js --agent cursor --task "Fix the login bug" --project ../my-app

# Skip grounding entirely
node src/cli.js --agent cursor --task "Fix the login bug" --no-project

# Inspect exactly what gets injected
node src/cli.js --scan --project ../my-app
```

## Execution loop

No flags needed — every generated prompt ends with a mandatory loop:
PLAN → ACT → VERIFY (using your project's detected commands) → ITERATE
(max 5, never claim success on failing checks) → REPORT with evidence.
Chat-only agents (DeepSeek/Kimi/GPT) get a SELF-VERIFY phase instead.

## Consult mode (LLM-authored)

The Architect LLM writes the prompt itself, grounded in a scan of your
project. Requires `.env` LLM settings.

```bash
node src/cli.js --consult --agent cursor --task "harden my RAG API keys" --project .

# Watch it write token by token
node src/cli.js --consult --stream --agent claude --task "merge my two scrapers"
```

If the LLM call fails, consult falls back to template mode automatically.

## Reasoning effort

For reasoning-capable models:

```bash
node src/cli.js --consult --reasoning high --agent cursor --task "design the schema"
```

Or set a default in `.env`: `OPENAI_REASONING=high` (CLI flag wins).
Applies to consult, streaming, `--rewrite`, `--test`, and `--templatize`.

## One-shot recipes

111 proven mega-prompts across 16 categories (security, DFIR, reverse
engineering, malware analysis, AI frameworks, and more).

```bash
node src/cli.js --recipes                                   # full catalog
node src/cli.js --recipe dfir-network-forensics --agent cursor \
  --task "Analyze the given pcap and identify C2 comms"
```

`--vars '{"key":"value"}'` fills extra placeholders on **custom** recipes —
see [Custom recipes](#custom-recipes).

## Prompt chaining

Link recipes into pipelines — each step gets handoff instructions, carried
context, and quality gates.

```bash
node src/cli.js --chain prd-then-build,saas-starter --agent claude --task "kanban app"

# Chain + export: one file per step (step1-prd-then-build, step2-saas-starter)
node src/cli.js --chain prd-then-build,saas-starter --agent cursor \
  --task "kanban app" --export markdown --out ./out
```

## Quality scoring

Score any generated prompt against a 6-dimension rubric (specificity,
structure, constraints, platform utilization, completeness, actionability).

```bash
node src/cli.js --agent cursor --recipe threat-model --task "model our API" --score
# → grade + percent on stderr, per-dimension breakdown in --json
```

The web UI shows the score as a chip on every forged prompt.

## Prompt testing

Run the generated prompt against your LLM and evaluate the response:
format compliance, required keywords, and an LLM-as-judge pass.

```bash
node src/cli.js --recipe appsec-api-security --task "review REST endpoints" \
  --test --expect "severity,remediation" --show-response

# Skip the judge pass (cheaper)
node src/cli.js --agent gpt --task "write a haiku about logs" --test --no-judge
```

## Rewrite (input polishing)

Polish a rough task before templating. Uses your LLM when configured,
rule-based cleanup otherwise.

```bash
node src/cli.js --agent cursor --rewrite \
  --task "pls check the auth code thx" --context "express app"
```

## Custom recipes

Build reusable prompt patterns with your own placeholders. Saved to
`.mpa/recipes/` (project) or `~/.mpa/recipes/` (user) and validated on load.

```bash
node src/cli.js --create-recipe \
  --recipe-name "Incident Postmortem" \
  --recipe-category security \
  --recipe-role "incident commander writing blameless postmortems" \
  --recipe-steps "Gather timeline|Identify root cause|Define action items" \
  --recipe-rules "Blameless tone|Cite log evidence" \
  --recipe-output "Postmortem doc with timeline table and action items" \
  --recipe-placeholders "severity,service"

# Use it
node src/cli.js --recipe incident-postmortem --task "last night's outage" \
  --vars '{"severity":"SEV-2","service":"billing-api"}'

# Save to your user library instead of the project
node src/cli.js --create-recipe ... --recipe-scope user
```

Team workflow: commit `.mpa/recipes/` to your repo — teammates get the
recipes automatically. The web UI has a guided builder (Build recipe button).

## Recipe packs

Share recipe collections as portable JSON.

```bash
# Export a category (or "all") to ./out
node src/cli.js --export-pack dfir

# Publish to a GitHub Gist (needs GITHUB_TOKEN)
node src/cli.js --share-pack dfir

# Import from a file, URL, or Gist
node src/cli.js --import-recipe ./out/dfir-pack.json
node src/cli.js --import-recipe https://gist.github.com/<user>/<id>
```

## Templatize existing prompts

Reverse-engineer a prompt you already have into a reusable recipe.

```bash
node src/cli.js --templatize ./my-best-prompt.md
cat prompt.md | node src/cli.js --templatize -

# No LLM? Use the offline heuristic extractor
node src/cli.js --templatize ./prompt.md --offline
```

## Profiles

Save and reuse generation configs. Secrets (`apiKey`) and tasks are never
persisted.

```bash
node src/cli.js --save-profile sec-review --agent claude --domain security \
  --format markdown --tone strict --consult

node src/cli.js --profile sec-review --task "review the new endpoints"
node src/cli.js --profiles        # list saved
```

Explicit CLI flags always override profile values.

## History & version diff

Every generated prompt is auto-saved locally (`.prompt-history.json`).

```bash
node src/cli.js --history                    # list recent
node src/cli.js --history-get a1b2c3         # show one
node src/cli.js --history-replay a1b2c3      # regenerate with the same config
node src/cli.js --history-diff a1b2c3 d4e5f6 # diff prompts + see which config changed
node src/cli.js --history-clear              # wipe
```

The web UI History modal gives the same diff side-by-side: open History,
select two entries, Diff selected.

## Review gate

Edit and approve the prompt in `$EDITOR` before it is exported, piped, or
saved to history.

```bash
node src/cli.js --agent cursor --task "refactor auth" --review --export cursorrules
```

## Export formats

10 formats: `cursorrules`, `clinerules`, `agents-md`, `windsurfrules`,
`opencode`, `opencode-jsonc`, `vscode`, `custom-gpt`, `antigravity`,
`markdown`.

```bash
node src/cli.js --agent cursor --task "Review auth" --export cursorrules --out ./
node src/cli.js --agent claude --task "Harden API" --export agents-md --name AGENTS --out ./
node src/cli.js --agent gpt --task "Support bot persona" --export custom-gpt
```

## Direct piping to agents

Write the prompt straight into an agent's config/command location:
`cursor`, `claude`, `opencode`, `aider`, `windsurf`, `continue`, `cody`,
`copilot`.

```bash
node src/cli.js --pipe claude --agent claude --task "Refactor the API layer"
node src/cli.js --pipe cursor --agent cursor --task "Add rate limiting"
node src/cli.js --pipe copilot --task "Repo-wide coding standards"
```

Cursor/Windsurf overwrite their rules file; Copilot appends to
`.github/copilot-instructions.md`; Continue/Cody register named commands.

## Batch generation

One task, platform-tailored prompts for several agents at once.

```bash
node src/cli.js --agents cursor,claude,deepseek --task "Review auth module"

# Batch + export → one file per agent (suffix added automatically)
node src/cli.js --agents cursor,claude --task "Review auth" --export markdown --out ./out
```

## Multi-language scaffolding

Translate the template scaffolding (headings, instructions, loop contract)
while keeping your task content and technical terms intact.

```bash
node src/cli.js --agent cursor --task "Revisa el manejo de claves" --lang es
node src/cli.js --agent windsurf --task "認証をレビュー" --lang ja
node src/cli.js --agent claude --task "审查密钥处理" --lang zh
```

## Analytics

Local usage tracking (`.mpa-analytics.json`) — generation, export, and test
events.

```bash
node src/cli.js --analytics
# → totals, top agents/recipes, quality trend, test pass rate
```

Web UI: the Stats button opens the dashboard. Files stay local and are
gitignored by default.

## Plugins

Drop manifest JSON files into `.mpa/plugins/` (project) or
`~/.mpa/plugins/` (user) to add exporters, platforms, enhancers, or scanners.

```bash
node src/cli.js --plugins                          # list loaded
node src/cli.js --enhance-with jira-context --task "fix PROJ-123"
node src/cli.js --scanner monorepo --consult --task "..." --project .
```

Manifest shapes and examples: see the Plugin System section in README and
`src/plugins.js` validation.

## JSON output

Machine-readable output for scripting — includes score and test results
when enabled.

```bash
node src/cli.js --agent cursor --task "Review auth" --json --score --test \
  | jq '.score.percent, .test.verdict'
```

## Configuration reference

Precedence: CLI flags → profile → `.env` → built-in defaults.

| Setting | Flag | Env var | Default |
|---|---|---|---|
| API key | `--api-key` | `OPENAI_API_KEY` | — |
| Base URL | `--api-base` | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| Model | `--model` | `OPENAI_MODEL` | — (required for LLM features) |
| Reasoning effort | `--reasoning` | `OPENAI_REASONING` | — |
| Fallback model | — | `OPENAI_FALLBACK_MODEL` | — |
| Gist publishing | — | `GITHUB_TOKEN` | — |

Full flag list: `node src/cli.js --help`. HTTP endpoints for the web server:
[docs/api.md](api.md).
