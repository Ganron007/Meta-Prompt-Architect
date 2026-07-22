# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-22

### Added
- **Redesigned web UI**: full-viewport two-pane drafting console (config left,
  paper-style output right) with zero page scrolling, Ctrl+Enter to forge,
  live status strip, word count, engine badge, and copy fallback.
- Dark output sheet by default (no more white flash) with a persisted
  light/dark theme toggle in the top bar.
- Per-pane Clear buttons: inputs (task/context/constraints) and output.
- **Recipe book** (`--recipe` / `--recipes`): 45 proven one-shot mega-prompt
  patterns across 5 categories — Software Build (8), Cybersecurity (18),
  AI/Agentic Frameworks (10), AI × Cybersecurity (6), AI × Operations (3).
  Grouped by category in CLI and as optgroups in the web UI dropdown.
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
