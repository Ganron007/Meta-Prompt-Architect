# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Expanded agent piping** (`src/piping.js`): five new `--pipe` targets —
  `aider` (via `--message-file`), `windsurf` (writes `.windsurfrules`),
  `continue` (writes `.continue/prompts/<name>.prompt` slash command),
  `cody` (merges a custom command into `.vscode/cody.json`), and `copilot`
  (appends to `.github/copilot-instructions.md` without clobbering).
  `--pipe` is now documented in `--help`.
- **Multi-language support** (`src/i18n.js`): `--lang en|es|ja|zh` translates the
  template scaffolding (headings, role line, objective steps, input labels,
  output specs, initialization) while keeping user content, technical terms,
  and the Platform Playbook in original form. Consult mode instructs the
  Architect LLM to author in the selected language. Language dropdown in the
  web UI; `lang` is stored in history and restored on replay.
- **Prompt versioning & diff** (`src/diff.js`): LCS line diff between any two
  history entries. `--history-diff <id1> <id2>` prints a collapsed +/- diff
  plus a config-change summary (which config fields produced the output
  changes). `GET /api/diff?id1&id2` exposes the same data; the web UI History
  button opens a modal to browse entries, select two, and view the diff with
  config-change chips.
- **Recipe packs** (`src/recipe-packs.js`): shareable pack format
  (`mpa-recipe-pack` JSON with name, version, metadata, recipes).
  `--export-pack <category|all>` writes a pack to `--out`; `--import-recipe
  <url|file>` imports from a file, URL, or GitHub Gist (auto-normalized to raw)
  into the recipe store with skip/overwrite handling. Imported recipes appear
  in `--recipes`, the web UI dropdown, and `/api/meta`.
- **Prompt chaining** (`src/chain.js`): `--chain id1,id2,...` links recipes into
  an ordered pipeline. Each step's prompt is wrapped in a Chain Context section
  with handoff-in/handoff-out instructions, context carryover rules (task,
  constraints, decisions, artifacts, risks), and a quality gate checklist.
  Works with bundled and custom recipes, batch agents, `--score`, `--json`,
  and `--export` (files get `-stepN-id` suffixes).
- **Custom Recipe Builder** (`src/custom-recipes.js`): define reusable prompt
  patterns with role, workflow steps, hard rules, output format, and custom
  placeholders. Saved recipes are validated (required fields, registered
  category, `{{task}}` present, declared placeholders) and loaded alongside
  bundled recipes in the CLI, web UI dropdown, and `/api/meta`.
- `--create-recipe` CLI flag with `--recipe-name/-category/-role/-steps/
  -rules/-output/-placeholders` options; saves to project-local
  `.mpa/recipes/` (default) or `~/.mpa/recipes/` via `--recipe-scope user`.
- `--vars <json>` supplies values for a custom recipe's extra placeholders;
  values are stored in history and restored on `--history-replay`.
- `--recipe-dir <dir>` and `--overwrite-recipe` for explicit recipe
  directories and replacement.
- Web UI recipe builder panel: form with live preview (`/api/recipes/preview`)
  and save; recipe dropdown marks custom recipes; per-recipe input fields
  appear for custom placeholders.

### Fixed
- Batch `--export` previously wrote every agent's prompt to the same filename;
  multi-result runs now write one file per result with a distinguishing suffix.

## [1.4.0] - 2026-08-03

### Added
- **Prompt quality scoring** (`src/scorer.js`): rule-based, offline rubric that
  grades every generated prompt on six dimensions (1–10 each) — Specificity,
  Structure, Constraints, Platform utilization, Completeness, Actionability —
  with per-dimension findings, a /60 total, percentage, and A–F grade.
- `--score` CLI flag: prints the score breakdown to stderr (stdout stays
  pipeable) and embeds the score object in `--json` output.
- `/api/generate` now returns a `score` object for template and consult modes.
- Web UI output header shows a colored grade chip (`B · 80%`) with a hover
  tooltip listing per-dimension scores; chip resets on Clear.
- `--validate-recipes` validates all bundled recipes for required fields,
  registered categories, required `{{task}}` interpolation, and supported
  placeholders.

## [1.3.0] - 2026-08-03

### Added
- **62 new one-shot recipes across 10 cybersecurity categories** (111 total,
  up from 49):
  - DFIR (8): disk forensics, memory forensics, network forensics, timeline
    analysis, evidence handling, IR automation, threat intel correlation,
    log analysis
  - Reverse Engineering (8): static, dynamic, protocol, firmware,
    unpacking/deobfuscation, binary diffing, vulnerability research,
    decompiler workflow
  - Malware Analysis (8): static triage, dynamic sandbox, behavioral,
    family classification, C2 protocol, packer analysis, YARA rule writing,
    sandbox evasion
  - AI/ML Security (8): prompt injection, adversarial ML, model extraction,
    LLM red team, AI supply chain, model robustness, data poisoning,
    AI agent security
  - Red Team Operations (8): initial access, persistence, privilege
    escalation, lateral movement, exfiltration, C2 operations, cloud
    exploitation, social engineering
  - Blue Team / Detection Engineering (6): SIEM rules, threat hunt, alert
    triage, detection pipeline, EDR tuning, purple team
  - Cloud Security (5): AWS audit, Azure audit, Kubernetes, container
    security, IAM review
  - Application Security (4): API security, mobile security, SAST/DAST,
    secure SDLC
  - OSINT / Threat Intelligence (4): collection, actor profiling, IOC
    management, intel report
  - Cryptography (3): implementation review, protocol analysis, PQC migration
- Category labels for all 10 new categories in the CLI `--recipes` listing
  and the web UI recipe dropdown.

## [1.2.0] - 2026-07-22

### Added
- **Redesigned web UI**: full-viewport two-pane drafting console (config left,
  paper-style output right) with zero page scrolling, Ctrl+Enter to forge,
  live status strip, word count, engine badge, and copy fallback.
- Dark output sheet by default (no more white flash) with a persisted
  light/dark theme toggle in the top bar.
- Per-pane Clear buttons: inputs (task/context/constraints) and output.
- **Recipe book** (`--recipe` / `--recipes`): 49 proven one-shot mega-prompt
  patterns across 6 categories — Software Build (8), Cybersecurity (18),
  Security Research Lab Methodology (4), AI/Agentic Frameworks (10),
  AI × Cybersecurity (6), AI × Operations (3).
  Grouped by category in CLI and as optgroups in the web UI dropdown.
- **Security Research Orchestrator** recipes: full 8-phase-gate methodology
  (G0–G7) with evidence ledgers, adversarial audit, multi-agent policy,
  false-completion rules, and mode-specific contracts for LAB_SOLVE,
  LAB_BUILD, LAB_HUNT, and CLAIM_VALIDATE.
- **Platform awareness** (`src/platforms.js`): every generated prompt now
  includes a Platform Playbook section that tells the target agent how to
  exploit its own platform's features (modes, context features, config files,
  multi-agent support, terminal access). Covers Cursor, Claude, OpenCode,
  DeepSeek, Kimi, GPT, Windsurf, Cline/Roo Code, and generic.
- New agent profiles: Windsurf, Cline/Roo Code, OpenCode.
- `/api/meta` endpoint serves recipes and platform data to the web UI.
- Web UI shows platform capability chips when an agent is selected and
  recipe taglines + task hints when a recipe is chosen.
- **New export formats**: `.clinerules`, `AGENTS.md`, `.windsurfrules`,
  Custom GPT instructions JSON.
- **Batch generation** (`--agents cursor,claude,deepseek`): generate
  platform-tailored prompts for multiple agents in one command.
- **Prompt history**: every generated prompt is saved locally
  (`.prompt-history.json`). Browse with `--history`, view with
  `--history-get <id>`, regenerate with `--history-replay <id>`,
  clear with `--history-clear`. Also exposed via `/api/history`.
- **Direct agent piping** (`--pipe cursor|claude|opencode`): send the
  generated prompt straight to the target agent's CLI or config file.
- **Shareable URLs**: the web UI Share button encodes the full config
  into URL query params — paste the link anywhere to restore the setup.
- **Consult mode** (`--consult`): an LLM "Chief Operations Architect" authors the
  final prompt using a structured COA meta-prompt, grounded in scanned project
  context (`src/architect.js`).
- **Project scanner** (`src/context.js`): reads key files (README, package.json,
  manifests, etc.), builds a directory tree, and reads git branch info to ground
  prompts in real project structure.
- **Multi-provider LLM client** (`src/llm.js`): OpenAI-compatible, Anthropic,
  Ollama, and MiMo (Xiaomi) with automatic fallback model support.
- **Shared config module** (`src/config.js`): env loading and LLM provider
  resolution extracted from CLI for reuse by the server.
- `--scan` flag to print scanned project context and exit.
- `--json` flag for machine-readable output.
- `--project` / `--no-project` flags to control project scanning.
- `mimo` provider support in CLI, web UI, and config resolution.
- Web UI project path field for consult-mode grounding.
- Unknown CLI flags now emit a warning instead of being silently ignored.

### Changed
- Rule-based enhancer no longer runs by default in template mode — only when
  `--rewrite` is passed (previously mangled user text with aggressive
  replacements like `get`→`generate`, `do`→`perform`).
- Web server binds to `127.0.0.1` by default (set `HOST` to override) instead
  of all interfaces.
- `generate()` is now async; server `listen` is guarded behind `start()`.

### Fixed
- **Consult prompts no longer lose details**: `unwrapPrompt` previously cut the
  prompt at the first nested code fence (non-greedy regex) — it now unwraps
  from the first opening fence to the last closing fence, keeping nested
  fences intact. Also handles unterminated fences.
- Architect meta-prompt no longer caps output at 200–500 words; completeness is
  now enforced (every step, version tag, path, and constraint must survive),
  and multi-step plans are mirrored step-for-step.
- Project scan reads up to 6 KB per key file (was 3 KB) for richer grounding.
- Restored input validation on `/api/export` (`config` and `format` required).
- `/api/scan` returns 400 for non-existent paths instead of null.
- Removed triplicated `thru` replacement rule in the enhancer.
- Removed destructive enhancer rules (`get`, `do`, `need`, `want`, `help me`,
  `i need`, `can you`, `please`) that corrupted user input.
- OpenCode export now includes a `_note` clarifying it is a prompt block, not
  a full `opencode.json` config.
- README updated: project structure, CLI options table, MiMo provider,
  directory name, localhost binding note.

## [1.1.0] - 2026-07-13

### Added
- Portable single-file executables via `pkg` (`npm run build` → `dist/`).
- Redesigned web UI: glassmorphism cards, animated aurora background, custom
  controls, gradient buttons, and centered toast notifications.
- `text` output format option in the engine, CLI, and web UI.
- `opencode-jsonc` export format documented and available in the UI.
- `LICENSE` (MIT), `CHANGELOG.md`, and a more complete `.gitignore`.

### Fixed
- `bin/prompt-architect` now actually invokes `main()` (was silently a no-op due
  to the `require.main === module` guard), so `npm start` / `--serve` via the bin
  and the packaged executable work correctly.
- CLI `--format` flag now correctly maps to `outputFormat` (previously defaulted
  to `markdown` and ignored the option).
- Removed a dead no-op `lines.map(l => l)` in `generator.js`.
- Aligned README and CLI help flag lists (`antigravity` export, `text` format).
- Added input validation to the `/api/export` endpoint (`config` / `format`
  required) and filename sanitization in the CLI export path.

## [1.0.0] - 2026-07-13

### Added
- Initial release: prompt generator and exporter for Cursor, OpenCode, VS Code,
  and other AI agents.
- CLI (`src/cli.js`) with agent/domain/task/context/constraints/format/tone
  options and multiple export formats.
- Web UI (`src/server.js` + `public/`) with generate/export/copy.
- Agent and domain profile templates (`src/templates.js`).
- Export formatters (`src/exporters.js`): `.cursorrules`, OpenCode JSON/JSONC,
  VS Code snippets, Antigravity, Markdown.
