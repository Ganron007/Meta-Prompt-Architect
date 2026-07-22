# Meta-Prompt Architect

A prompt engineering workbench for solo engineers running multi-faceted operations. Generate platform-aware, context-grounded prompts for Cursor, Claude, OpenCode, DeepSeek, Kimi, GPT, Windsurf, Cline, and generic agents — with 45 one-shot recipes, LLM consult mode, batch generation, prompt history, and direct agent piping. Export to `.cursorrules`, `.clinerules`, `AGENTS.md`, `.windsurfrules`, OpenCode JSON/JSONC, VS Code snippets, Custom GPT instructions, or Antigravity markdown.

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
cd Meta-Prompt-Architect
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
| `--agent` | `cursor`, `deepseek`, `kimi`, `claude`, `gpt`, `windsurf`, `cline`, `opencode`, `generic` |
| `--domain` | `lab-build`, `code-review`, `security`, `feature-exploration`, `release-readiness`, `general` |
| `--task` | Brief task description |
| `--context` | Additional background |
| `--constraints` | Rules to enforce |
| `--project` | Project directory to scan for context (default: cwd) |
| `--no-project` | Skip project scanning |
| `--format` | `markdown`, `json`, `table`, `code`, `diagram`, `text` |
| `--tone` | `professional`, `casual`, `strict` |
| `--examples` | Include examples |
| `--rewrite` | Use an LLM to rewrite raw input professionally |
| `--consult` | LLM authors the prompt using the COA meta-prompt + scanned context |
| `--recipe` | Use a proven one-shot recipe (see `--recipes`) |
| `--recipes` | List available recipes and exit |
| `--provider` | `openai`, `deepseek`, `anthropic`, `ollama`, `openai-compatible`, `mimo` |
| `--model` | LLM model name |
| `--api-key` | API key (or use env var) |
| `--api-base` | Custom API base URL |
| `--export` | `cursorrules`, `clinerules`, `agents-md`, `windsurfrules`, `opencode`, `opencode-jsonc`, `vscode`, `custom-gpt`, `antigravity`, `markdown` |
| `--name` | Output filename (without extension) |
| `--out` | Output directory |
| `--agents` | Comma-separated list for batch generation (e.g. `cursor,claude,deepseek`) |
| `--pipe` | Send prompt directly to agent CLI: `cursor`, `claude`, `opencode` |
| `--history` | List prompt history |
| `--history-get` | Show a specific prompt from history by ID |
| `--history-replay` | Regenerate a prompt from history |
| `--history-clear` | Clear prompt history |
| `--json` | Machine-readable JSON output |
| `--scan` | Print scanned project context and exit |
| `--serve` | Start web UI on `http://localhost:3000` |

## One-shot recipes

45 proven mega-prompt patterns across 5 categories — pick one and describe your project:

```bash
# List all recipes (grouped by category)
node src/cli.js --recipes

# Build a complete game in one prompt
node src/cli.js --recipe one-shot-game --agent cursor --task "tower defense with elemental towers"

# AI × Cybersecurity: multi-agent SOC analyst
node src/cli.js --recipe ai-soc-analyst --agent claude --task "SOC with Splunk and CrowdStrike"

# LangGraph agent with human-in-the-loop
node src/cli.js --recipe langgraph-agent --agent cursor --task "research agent that searches arxiv"
```

| Category | Recipes |
|---|---|
| **Software Build** (8) | `readme-driven`, `one-shot-game`, `fullstack-app`, `prd-then-build`, `saas-starter`, `clone-builder`, `codebase-overhaul`, `spec-first-api` |
| **Cybersecurity** (18) | `pentest-report`, `threat-model`, `secure-code-review`, `incident-response`, `malware-analysis`, `red-team-plan`, `security-architecture`, `ctf-builder`, `hardening-guide`, `detection-rules`, `security-audit`, `reverse-engineering`, `bug-bounty-recon`, `compliance-gap`, `supply-chain-audit`, `forensic-analysis`, `exploit-dev`, `security-tool` |
| **AI / Agentic** (10) | `langgraph-agent`, `langchain-rag`, `crewai-crew`, `autogen-team`, `mcp-server`, `ai-eval-suite`, `agent-tool-use`, `prompt-engineering-suite`, `finetune-pipeline`, `ai-api-gateway` |
| **AI × Cybersecurity** (6) | `ai-soc-analyst`, `ai-threat-hunter`, `ai-malware-analyst`, `ai-pentest-crew`, `ai-code-security`, `ai-incident-responder` |
| **AI × Operations** (3) | `ai-research-crew`, `ai-devops-agent`, `ai-data-pipeline` |

## Platform awareness

Every generated prompt includes a **Platform Playbook** — instructions that tell the target agent how to exploit its own platform's full capabilities (agent modes, context features like `@codebase` or `CLAUDE.md`, multi-agent sub-tasks, terminal access, config files). Supported platforms: Cursor, Claude, OpenCode, DeepSeek, Kimi, GPT, Windsurf, Cline/Roo Code, and generic.

## Batch generation

Generate platform-tailored prompts for multiple agents in one command:

```bash
node src/cli.js --agents cursor,claude,deepseek --task "Review API key handling" --domain security
```

Each agent gets its own Platform Playbook. In `--json` mode, output is an array.

## Prompt history

Every generated prompt is saved locally to `.prompt-history.json`:

```bash
# List recent prompts
node src/cli.js --history

# View a specific prompt
node src/cli.js --history-get 045646

# Regenerate from a past entry
node src/cli.js --history-replay 045646

# Clear all history
node src/cli.js --history-clear
```

## Direct agent piping

Send the generated prompt straight to the target agent:

```bash
# Write to .cursorrules (Cursor picks it up automatically)
node src/cli.js --pipe cursor --agent cursor --task "Review auth module"

# Pipe to Claude Code CLI
node src/cli.js --pipe claude --agent claude --task "Refactor the API layer"

# Pipe to OpenCode CLI
node src/cli.js --pipe opencode --agent opencode --task "Add tests for utils"
```

## Shareable URLs

The web UI **Share** button encodes the full configuration into URL query params. Paste the link anywhere — opening it restores the exact setup, ready to forge.

## Professional rewriting

By default, your raw task text passes through unchanged. Enable rewriting with `--rewrite` to polish rough input before templating:

- Without an LLM provider: a lightweight rule-based enhancer cleans up abbreviations and casual phrasing (e.g., `pls check my code` → `Please review my code`).
- With an LLM provider: the enhancer uses the LLM to professionally rewrite your task, context, and constraints.

```bash
# Use OpenAI
node src/cli.js --agent cursor --task "pls check my code for bugs" --rewrite --provider openai --model gpt-4o-mini

# Use local Ollama (free, offline)
node src/cli.js --agent cursor --task "make sure my rag pipeline is safe" --rewrite --provider ollama --model llama3.2

# Use DeepSeek
node src/cli.js --agent deepseek --task "review api key stuff" --rewrite --provider deepseek --model deepseek-chat
```

Supported providers:

- **OpenAI** — set `OPENAI_API_KEY`
- **DeepSeek** — set `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`
- **Anthropic** — set `ANTHROPIC_API_KEY`
- **Ollama** — runs locally on `http://localhost:11434`
- **OpenAI-compatible** — any provider with a `/v1/chat/completions` endpoint
- **MiMo (Xiaomi)** — set `MIMO_API_KEY`

Copy `.env.example` to `.env` and fill in your keys.

## Web UI

```bash
npm start
```

Open http://localhost:3000 and fill in the form to generate and export prompts.
The server binds to `127.0.0.1` by default (set `HOST` to override). Set `PORT` to change the port.

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
- **`.clinerules`** — Cline / Roo Code project instructions
- **`AGENTS.md`** — Claude Code / OpenCode project instructions
- **`.windsurfrules`** — Windsurf workspace rules
- **OpenCode JSON / JSONC** — system prompt block for OpenCode CLI
- **VS Code Snippet** — reusable `.code-snippets` file
- **Custom GPT** — OpenAI Custom GPT instructions JSON
- **Antigravity** — markdown instructions file

## Project structure

```
.
├── bin/prompt-architect     # CLI entry point
├── src/
│   ├── cli.js               # CLI logic
│   ├── config.js            # Env loading & LLM provider resolution
│   ├── server.js            # Express web UI (localhost only)
│   ├── generator.js         # Template-based prompt construction
│   ├── architect.js         # LLM consult mode (COA meta-prompt)
│   ├── context.js           # Project scanner for grounding
│   ├── enhancer.js          # Rule/LLM input polishing
│   ├── llm.js               # Multi-provider LLM client
│   ├── templates.js         # Agent and domain profiles
│   ├── platforms.js         # Platform capability profiles & playbooks
│   ├── recipes.js           # 45 one-shot prompt recipes
│   ├── history.js           # Local prompt history store
│   ├── piping.js            # Direct agent CLI piping
│   └── exporters.js         # Export formatters
├── public/                  # Web UI assets
└── tests/                   # Smoke tests
```

## License

MIT
