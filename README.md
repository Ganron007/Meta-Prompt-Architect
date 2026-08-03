# Meta-Prompt Architect

A prompt engineering workbench that generates platform-aware, context-grounded prompts for AI coding agents. Combines 49 proven one-shot recipes, LLM consult mode with project scanning, multi-agent batch generation, and direct CLI piping into a single tool.

**Supported agents:** Cursor · Claude Code · OpenCode · DeepSeek · Kimi · GPT · Windsurf · Cline/Roo Code · Generic

**Export targets:** `.cursorrules` · `.clinerules` · `AGENTS.md` · `.windsurfrules` · OpenCode JSON/JSONC · VS Code Snippets · Custom GPT · Antigravity · Markdown

---

## Features

| Capability | Description |
|---|---|
| **Platform Playbooks** | Every prompt includes agent-specific instructions exploiting the target platform's full capabilities (modes, context features, multi-agent support, terminal access) |
| **49 One-Shot Recipes** | Proven mega-prompt patterns across software build, cybersecurity, security research, AI/agentic frameworks, and cross-domain AI integration |
| **Consult Mode** | An LLM "Chief Operations Architect" authors the prompt using a structured meta-prompt, grounded in your actual project files |
| **Batch Generation** | Generate platform-tailored prompts for multiple agents in a single command |
| **Prompt History** | Local auto-save with search, replay, and clear |
| **Direct Piping** | Send generated prompts straight to Cursor, Claude Code, or OpenCode CLI |
| **Web UI** | Full-viewport drafting console with dark/light themes, shareable URLs, and keyboard shortcuts |

---

## Installation

```bash
git clone https://github.com/Ganron007/Meta-Prompt-Architect.git
cd Meta-Prompt-Architect
npm install
```

---

## Quick Start

```bash
# Generate a prompt for Cursor
node src/cli.js --agent cursor --domain security --task "Review API key handling in a RAG script"

# Use a one-shot recipe
node src/cli.js --recipe one-shot-game --agent cursor --task "tower defense with elemental towers"

# LLM consult mode (requires API key or Ollama)
node src/cli.js --consult --agent claude --task "harden my RAG API keys" --project .

# Batch: generate for multiple agents at once
node src/cli.js --agents cursor,claude,deepseek --task "Review auth module" --domain security

# Export directly to .cursorrules
node src/cli.js --agent cursor --task "Review API key handling" --export cursorrules --out ./

# Pipe directly to Claude Code
node src/cli.js --pipe claude --agent claude --task "Refactor the API layer"

# Start the web UI
node src/cli.js --serve
```

---

## CLI Reference

| Option | Description |
|---|---|
| `--agent` | Target agent: `cursor`, `deepseek`, `kimi`, `claude`, `gpt`, `windsurf`, `cline`, `opencode`, `generic` |
| `--agents` | Comma-separated list for batch generation |
| `--domain` | `lab-build`, `code-review`, `security`, `feature-exploration`, `release-readiness`, `general` |
| `--task` | Task description (required) |
| `--context` | Additional background |
| `--constraints` | Rules to enforce |
| `--project` | Project directory to scan for context (default: cwd) |
| `--no-project` | Skip project scanning |
| `--format` | Output format: `markdown`, `json`, `table`, `code`, `diagram`, `text` |
| `--tone` | `professional`, `casual`, `strict` |
| `--examples` | Include examples in the prompt |
| `--rewrite` | Polish raw input via rules or LLM before templating |
| `--consult` | LLM authors the prompt using the COA meta-prompt + scanned context |
| `--recipe` | Use a one-shot recipe (see `--recipes` to list) |
| `--recipes` | List all available recipes grouped by category |
| `--provider` | LLM provider: `openai`, `deepseek`, `anthropic`, `ollama`, `openai-compatible`, `mimo` |
| `--model` | LLM model name |
| `--api-key` | API key (or set via env var) |
| `--api-base` | Custom API base URL |
| `--export` | Export format: `cursorrules`, `clinerules`, `agents-md`, `windsurfrules`, `opencode`, `opencode-jsonc`, `vscode`, `custom-gpt`, `antigravity`, `markdown` |
| `--name` | Output filename (without extension) |
| `--out` | Output directory (default: `./out`) |
| `--pipe` | Send prompt to agent CLI: `cursor`, `claude`, `opencode` |
| `--history` | List prompt history |
| `--history-get <id>` | Show a specific prompt from history |
| `--history-replay <id>` | Regenerate from a history entry |
| `--history-clear` | Clear all history |
| `--json` | Machine-readable JSON output |
| `--scan` | Print scanned project context and exit |
| `--serve` | Start web UI on `http://localhost:3000` |

---

## One-Shot Recipes

49 proven mega-prompt patterns across 6 categories. Each recipe is a complete, self-contained prompt template with hard rules against placeholders.

```bash
node src/cli.js --recipes          # List all, grouped by category
node src/cli.js --recipe <id> --agent <agent> --task "<description>"
```

| Category | Count | Recipes |
|---|---|---|
| **Software Build** | 8 | `readme-driven`, `one-shot-game`, `fullstack-app`, `prd-then-build`, `saas-starter`, `clone-builder`, `codebase-overhaul`, `spec-first-api` |
| **Cybersecurity** | 18 | `pentest-report`, `threat-model`, `secure-code-review`, `incident-response`, `malware-analysis`, `red-team-plan`, `security-architecture`, `ctf-builder`, `hardening-guide`, `detection-rules`, `security-audit`, `reverse-engineering`, `bug-bounty-recon`, `compliance-gap`, `supply-chain-audit`, `forensic-analysis`, `exploit-dev`, `security-tool` |
| **Security Research** | 4 | `sec-research-solve`, `sec-research-build`, `sec-research-hunt`, `sec-research-validate` |
| **AI / Agentic Frameworks** | 10 | `langgraph-agent`, `langchain-rag`, `crewai-crew`, `autogen-team`, `mcp-server`, `ai-eval-suite`, `agent-tool-use`, `prompt-engineering-suite`, `finetune-pipeline`, `ai-api-gateway` |
| **AI × Cybersecurity** | 6 | `ai-soc-analyst`, `ai-threat-hunter`, `ai-malware-analyst`, `ai-pentest-crew`, `ai-code-security`, `ai-incident-responder` |
| **AI × Operations** | 3 | `ai-research-crew`, `ai-devops-agent`, `ai-data-pipeline` |

### Security Research Methodology

The `sec-research-*` recipes implement a full 8-phase-gate research methodology (G0–G7) with evidence ledgers, adversarial audit, multi-agent policy, false-completion rules, and mode-specific contracts:

- **LAB_SOLVE** — Exploit a designed training lab end-to-end
- **LAB_BUILD** — Build a vulnerable lab + working exploit + fixed control
- **LAB_HUNT** — Hunt without assumptions; zero-finding outcome permitted
- **CLAIM_VALIDATE** — Verify or refute a vulnerability/exploit claim

---

## Platform Awareness

Every generated prompt includes a **Platform Playbook** section tailored to the target agent. The playbook instructs the agent on:

- Which mode to operate in (Agent, Composer, Cascade, Task tool, etc.)
- Which context features to leverage (`@codebase`, `CLAUDE.md`, `@file`, MCP servers)
- Whether and how to use multi-agent capabilities (sub-agents, background agents)
- Terminal access patterns (run tests, lint, build after changes)
- Config files to read and update

---

## Consult Mode

Consult mode uses an LLM to author the final prompt from scratch, grounded in your actual project:

1. Scans your project (README, manifests, file tree, git branch)
2. Sends the scan + your task + platform capabilities to the LLM
3. The LLM produces a structured prompt following the Universal Prompt Structure
4. Completeness is enforced: every step, path, and constraint from your input survives

```bash
node src/cli.js --consult --agent cursor --task "harden my RAG API keys" --project .
```

Requires an API key (set via `.env` or env vars) or a running Ollama instance.

---

## Configuration

Copy `.env.example` to `.env` and fill in your provider key:

```bash
cp .env.example .env
```

| Provider | Env Var |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| MiMo (Xiaomi) | `MIMO_API_KEY` |
| Ollama | No key needed (runs locally on `:11434`) |
| OpenAI-compatible | `OPENAI_API_KEY` + `ARCHITECT_API_BASE` |

---

## Web UI

```bash
npm start
```

Opens at `http://localhost:3000`. The server binds to `127.0.0.1` by default (set `HOST` to override, `PORT` to change port).

Features: recipe dropdown with category grouping, platform capability chips, dark/light theme toggle, Ctrl+Enter to forge, shareable URLs, word count, live status.

---

## Portable Executable

```bash
npm run build
```

Produces standalone binaries in `dist/` (no Node.js required on target):

- `meta-prompt-architect-win.exe`
- `meta-prompt-architect-linux`
- `meta-prompt-architect-macos`

---

## Project Structure

```
.
├── bin/prompt-architect       # CLI entry point
├── src/
│   ├── cli.js                 # CLI argument parsing and orchestration
│   ├── config.js              # Env loading & LLM provider resolution
│   ├── server.js              # Express web UI (localhost only)
│   ├── generator.js           # Template-based prompt construction
│   ├── architect.js           # LLM consult mode (COA meta-prompt)
│   ├── context.js             # Project scanner for grounding
│   ├── enhancer.js            # Rule/LLM input polishing
│   ├── llm.js                 # Multi-provider LLM client
│   ├── templates.js           # Agent and domain profiles
│   ├── platforms.js           # Platform capability profiles & playbooks
│   ├── recipes.js             # 49 one-shot prompt recipes
│   ├── history.js             # Local prompt history store
│   ├── piping.js              # Direct agent CLI piping
│   └── exporters.js           # Export formatters (10 formats)
├── public/                    # Web UI assets (HTML, CSS, JS)
└── tests/                     # Test suite (16 tests)
```

---

## Research Foundations

This tool synthesizes patterns from established prompt engineering research:

- **LangGPT** — structured role/profile/goal/skills/rules/workflow prompts
- **Prompt Engineering Guide** (dair-ai) — zero-shot, few-shot, CoT, ReAct
- **prompts.chat** — open prompt library and MCP integrations
- **Promptfoo** — prompt testing, evaluation, and red-teaming
- **Microsoft Promptbase** — advanced methodologies (Medprompt+)
- **GPTs leaked prompts** — real-world system-prompt patterns

---

## License

MIT
