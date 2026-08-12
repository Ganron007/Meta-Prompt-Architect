# Usage Guide

Task-oriented walkthrough of every Meta-Prompt Architect feature, with
copy-paste examples. CLI commands assume you are in the repo root
(`node src/cli.js ...`); the same features are available in the web UI
(`npm start` → http://localhost:3000).

- [Setup](#setup)
- [Your first prompt (template mode)](#your-first-prompt-template-mode)
- [Project grounding](#project-grounding)
- [Execution loop](#execution-loop)
- [Repo scaffold](#repo-scaffold)
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

Fast, offline, deterministic. No LLM involved. Prompts are **goal-first** —
they open with `## Goal` and your task, then context, playbook, grounding,
and the execution loop.

```bash
node src/cli.js --agent cursor --domain security --task "Review API key handling"
```

### Task granularity — how big should the prompt be?

| Granularity | What you get | When |
|---|---|---|
| `micro` | Goal + context + grounding + one-line loop. No playbook, no boilerplate | Small, single-goal tasks (<14 words auto-detected) |
| `task` | Full template: playbook, grounding, loop, honest gates (+ ship/test for builds, safety/compliance for security) | The default for normal tasks |
| `mega` | Recipe contract (playbook + grounding + loop + sections appended) | Any recipe / chain |

```bash
node src/cli.js --agent cursor --task "fix login bug"                      # auto → micro
node src/cli.js --agent cursor --task "fix login bug" --granularity task   # force full template
node src/cli.js --agent cursor --task "harden the API" --lean              # goal-only, no boilerplate
```

The web UI has a "Task scope" selector (Auto / Micro / Task / Mega) and a
Lean toggle. Lean keeps Goal, Context, Playbook, Grounding, and the loop —
nothing else — which is the right shape when you share a project folder and
want zero filler.

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

### Recipe vs Domain — which one do I use?

They shape the prompt in two mutually exclusive ways:

| | Recipe | Domain |
|---|---|---|
| What it is | A complete proven mega-prompt (role, workflow, rules) for a task category | A generic angle applied to freeform template output |
| Used when | You know the *kind* of work (`dfir-network-forensics`, `threat-model`) | You have a freeform task and no matching recipe |
| Effect on prompt | The recipe template IS the prompt body | The domain profile sets the perspective (lab build, review, security...) |
| Interaction | Recipe selected → domain ignored | No recipe → domain applies |

### Task / Context / Constraints — what do they do?

All three are the *inputs* your prompt is built from, in every mode:

- **Task** (required) — the mission statement. Becomes the objective (or the
  recipe's task slot).
- **Context** — background the agent cannot infer: existing stack, file names,
  prior attempts. Rendered as an "Additional context" section.
- **Constraints** — hard rules it must obey ("no breaking API changes",
  "cite file:line"). Rendered as rules.

On top of these, the tool *auto-adds* project grounding (scanned facts),
the execution loop, ship plan, test matrix, and quality gates — so your
inputs only need to carry intent, not boilerplate.

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

Build-oriented prompts (build/blueprints/AI categories, `lab-build` domain)
additionally carry a **Ship Plan** (stack-aware build/test/deploy steps +
checksummed release) and a **Test Matrix** (unit/integration/e2e/CI).
Security prompts add **Safety & Governance** (intent-level tools, HITL,
scope policy, audit ledger, isolation) and **Compliance Mapping**
(ATT&CK/OWASP/NIST CSF, or OWASP LLM Top 10/ATLAS/NIST AI 600-1 for AI
security). Every prompt ends with **Honest Quality Gates**.

## Repo scaffold

Write a skeleton for the detected stack (CI workflow, Makefile, .env.example):

```bash
node src/cli.js --scaffold --project ../my-app --out ./out
# → out/scaffold/.github/workflows/ci.yml, Makefile, .env.example
```

## Consult mode (LLM-authored)

The Architect LLM writes the prompt itself, grounded in a scan of your
project. Requires `.env` LLM settings.

```bash
node src/cli.js --consult --agent cursor --task "harden my RAG API keys" --project .

# Watch it write token by token
node src/cli.js --consult --stream --agent claude --task "merge my two scrapers"

# Disable history-as-memory few-shot (on by default)
node src/cli.js --consult --no-memory --agent cursor --task "fresh idea"
```

If the LLM call fails, consult falls back to template mode automatically.

**History-as-memory:** consult automatically retrieves up to 3 similar
past prompts from your history (preferring human-edited, higher-scored ones)
and feeds them to the Architect as few-shot examples, so it reuses what
already worked for similar tasks. The web UI output pane is editable — edit
the prompt, then copy/export; edits are recorded and prioritized as memory
next time.

**Self-refining:** after drafting, consult scores its own output against the
rubric and issues one targeted revision pass when the score is below
threshold (default 70) — so you get generation *and* a quality check within
the guided request. The UI marks refined prompts (`· refined`) and shows the
final score chip. Disable with `--no-refine`.

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

# Lifecycle presets
node src/cli.js --chain @blueprint-sec --agent claude --task "AD lab + tooling + GRC program"
node src/cli.js --chain @blueprint-ai --agent claude --task "AI security program"

# Chain + export: one file per step (step1-prd-then-build, step2-saas-starter)
node src/cli.js --chain prd-then-build,saas-starter --agent cursor \
  --task "kanban app" --export markdown --out ./out
```

The web UI has a chain input with the preset buttons too — set the chain,
then Forge to get the whole lifecycle in one output.

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
