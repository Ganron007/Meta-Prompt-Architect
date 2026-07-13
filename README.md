# Meta-Prompt Architect

A simple, extensible prompt generator for solo engineers running multi-faceted operations. Build optimized prompts tailored for Cursor, DeepSeek, Kimi, Claude, GPT, and generic agents, then export them to `.cursorrules`, OpenCode JSON/JSONC, VS Code snippets, or Antigravity markdown.

## Research-backed design

This tool synthesizes patterns from the best prompt engineering resources:

- **LangGPT** (`langgptai/LangGPT`) — structured role/profile/goal/skills/rules/workflow prompts
- **Prompt Engineering Guide** (`dair-ai/Prompt-Engineering-Guide`) — zero-shot, few-shot, chain-of-thought, ReAct, and more
- **prompts.chat** (`f/prompts.chat`) — open prompt library, CLI, and MCP integrations
- **Promptfoo** (`promptfoo/promptfoo`) — prompt testing, evaluation, and red-teaming
- **Microsoft Promptbase** — advanced prompting methodologies such as Medprompt+
- **GPTs leaked prompts** (`linexjlin/GPTs`) — real-world system-prompt patterns

## Install

```bash
cd "Meta-Prompt Architect"
npm install
```

## CLI usage

```bash
# Generate a prompt and print it
node src/cli.js --agent cursor --domain security --task "Review API key handling in a RAG script" --context "Running in REMnux"

# Export as .cursorrules
node src/cli.js --agent cursor --domain security --task "Review API key handling" --export cursorrules --out ./

# Export for OpenCode
node src/cli.js --agent deepseek --domain code-review --task "Review Rust crate for unsafe code" --export opencode --name rust-review

# Start the web UI
node src/cli.js --serve
```

### CLI options

| Option | Description |
| --- | --- |
| `--agent` | `cursor`, `deepseek`, `kimi`, `claude`, `gpt`, `generic` |
| `--domain` | `lab-build`, `code-review`, `security`, `feature-exploration`, `release-readiness`, `general` |
| `--task` | Brief task description |
| `--context` | Additional background |
| `--constraints` | Rules to enforce |
| `--format` | `markdown`, `json`, `table`, `code`, `diagram`, `text` |
| `--tone` | `professional`, `casual`, `strict` |
| `--examples` | Include examples |
| `--export` | `cursorrules`, `opencode`, `opencode-jsonc`, `vscode`, `antigravity`, `markdown` |
| `--name` | Output filename (without extension) |
| `--out` | Output directory |
| `--serve` | Start web UI on `http://localhost:3000` |

## Web UI

```bash
npm start
```

Open http://localhost:3000 and fill in the form to generate and export prompts.

## Build a portable executable

`pkg` bundles Node + your code into a single standalone binary (no Node install required on the target machine).

```bash
npm install
npm run build
```

Binaries are written to `dist/`:

- `meta-prompt-architect-win.exe` (Windows)
- `meta-prompt-architect-linux` (Linux)
- `meta-prompt-architect-macos` (macOS)

Run it like the CLI, or start the web UI:

```bash
./dist/meta-prompt-architect-win.exe --agent cursor --task "Review API key handling"
./dist/meta-prompt-architect-win.exe --serve   # http://localhost:3000
```

Set `PORT` to change the web UI port.

## Export formats

- **Markdown** — copy-paste ready prompt
- **`.cursorrules`** — Cursor IDE system prompt file
- **OpenCode JSON / JSONC** — system prompt block for OpenCode CLI
- **VS Code Snippet** — reusable `.code-snippets` file
- **Antigravity** — markdown instructions file

## Project structure

```
.
├── bin/prompt-architect     # CLI entry point
├── src/
│   ├── cli.js               # CLI logic
│   ├── server.js            # Express web UI
│   ├── generator.js         # Prompt construction engine
│   ├── templates.js         # Agent and domain profiles
│   └── exporters.js         # Export formatters
├── public/                  # Web UI assets
└── tests/                   # Simple smoke tests
```

## License

MIT
