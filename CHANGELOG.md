# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
