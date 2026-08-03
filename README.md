<p align="center">
  <img src="assets/logo.svg" alt="Meta-Prompt Architect" width="128" height="128"/>
</p>

<h1 align="center">Meta-Prompt Architect</h1>

<p align="center">
  <em>Platform-aware prompt engineering workbench for AI coding agents.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.0-ffb224?style=flat-square" alt="version"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-3ad9b5?style=flat-square" alt="node"/>
  <img src="https://img.shields.io/badge/tests-18_passing-3ad9b5?style=flat-square" alt="tests"/>
  <img src="https://img.shields.io/badge/recipes-111-ffb224?style=flat-square" alt="recipes"/>
  <img src="https://img.shields.io/badge/license-MIT-8fa89a?style=flat-square" alt="license"/>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#one-shot-recipes">Recipes</a> •
  <a href="#cli-reference">CLI</a> •
  <a href="#web-ui">Web UI</a> •
  <a href="#configuration">Config</a>
</p>

---

Generate platform-aware, context-grounded prompts for **Cursor**, **Claude Code**, **OpenCode**, **DeepSeek**, **Kimi**, **GPT**, **Windsurf**, **Cline/Roo Code**, and generic agents. Every prompt includes a Platform Playbook that tells the agent how to exploit its own capabilities.

## Features

| | |
|---|---|
| **Platform Playbooks** | Agent-specific instructions exploiting each platform's modes, context features, multi-agent support, and terminal access |
| **111 One-Shot Recipes** | Proven mega-prompts across software build, cybersecurity, DFIR, reverse engineering, malware analysis, AI security, red team, blue team, cloud, appsec, OSINT, cryptography, and AI/agentic frameworks |
| **Consult Mode** | LLM-authored prompts grounded in your actual project files via structured meta-prompt |
| **Quality Scoring** | 6-dimension rubric (specificity, structure, constraints, platform utilization, completeness, actionability) via `--score`, in the web UI header, and in `--json` |
| **Custom Recipe Builder** | Define reusable prompt patterns with custom placeholders via `--create-recipe` or the web UI wizard; saved to `.mpa/recipes/` and validated on load |
| **Batch Generation** | Platform-tailored prompts for multiple agents in one command |
| **Prompt History** | Local auto-save with search, replay, and clear |
| **Direct Piping** | Send prompts straight to Cursor, Claude Code, or OpenCode CLI |
| **Web UI** | Full-viewport drafting console with dark/light themes, shareable URLs, Ctrl+Enter |
| **10 Export Formats** | `.cursorrules`, `.clinerules`, `AGENTS.md`, `.windsurfrules`, OpenCode JSON, VS Code Snippets, Custom GPT, and more |

## Quick Start

```bash
git clone https://github.com/Ganron007/Meta-Prompt-Architect.git
cd Meta-Prompt-Architect
npm install
```

```bash
# Generate a prompt
node src/cli.js --agent cursor --domain security --task "Review API key handling"

# Use a one-shot recipe
node src/cli.js --recipe one-shot-game --agent cursor --task "tower defense game"

# LLM consult mode (needs API key or Ollama)
node src/cli.js --consult --agent claude --task "harden my RAG API" --project .

# Batch: multiple agents at once
node src/cli.js --agents cursor,claude,deepseek --task "Review auth module"

# Export to .cursorrules
node src/cli.js --agent cursor --task "Review auth" --export cursorrules --out ./

# Pipe directly to Claude Code
node src/cli.js --pipe claude --agent claude --task "Refactor the API layer"

# Web UI
node src/cli.js --serve

# Validate the bundled recipe catalog
node src/cli.js --validate-recipes
```

## One-Shot Recipes

111 proven patterns across 16 categories. List them with `--recipes`:

| Category | Count | Examples |
|---|---|---|
| **Software Build** | 8 | `readme-driven`, `one-shot-game`, `fullstack-app`, `prd-then-build`, `saas-starter`, `clone-builder` |
| **Cybersecurity** | 18 | `pentest-report`, `threat-model`, `malware-analysis`, `red-team-plan`, `exploit-dev`, `forensic-analysis` |
| **Security Research** | 4 | `sec-research-solve`, `sec-research-build`, `sec-research-hunt`, `sec-research-validate` |
| **DFIR** | 8 | `dfir-disk-forensics`, `dfir-memory-forensics`, `dfir-network-forensics`, `dfir-timeline-analysis`, `dfir-log-analysis` |
| **Reverse Engineering** | 8 | `re-static-analysis`, `re-dynamic-analysis`, `re-protocol-analysis`, `re-firmware-analysis`, `re-unpacking-deobfuscation` |
| **Malware Analysis** | 8 | `mal-static-triage`, `mal-dynamic-sandbox`, `mal-behavioral-analysis`, `mal-c2-protocol-analysis`, `mal-yara-rule-writing` |
| **AI / ML Security** | 8 | `aisec-prompt-injection`, `aisec-adversarial-ml`, `aisec-llm-red-team`, `aisec-ai-supply-chain`, `aisec-ai-agent-security` |
| **Red Team Operations** | 8 | `rt-initial-access`, `rt-persistence`, `rt-privilege-escalation`, `rt-lateral-movement`, `rt-c2-operations` |
| **Blue Team / Detection** | 6 | `blue-siem-rules`, `blue-threat-hunt`, `blue-alert-triage`, `blue-detection-pipeline`, `blue-purple-team` |
| **Cloud Security** | 5 | `cloud-aws-audit`, `cloud-azure-audit`, `cloud-k8s-security`, `cloud-container-security`, `cloud-iam-review` |
| **Application Security** | 4 | `appsec-api-security`, `appsec-mobile-security`, `appsec-sast-dast`, `appsec-secure-sdlc` |
| **OSINT / Threat Intel** | 4 | `osint-collection`, `osint-actor-profiling`, `osint-ioc-management`, `osint-intel-report` |
| **Cryptography** | 3 | `crypto-implementation-review`, `crypto-protocol-analysis`, `crypto-pqc-migration` |
| **AI / Agentic** | 10 | `langgraph-agent`, `langchain-rag`, `crewai-crew`, `autogen-team`, `mcp-server`, `ai-eval-suite` |
| **AI × Cybersecurity** | 6 | `ai-soc-analyst`, `ai-threat-hunter`, `ai-pentest-crew`, `ai-code-security`, `ai-incident-responder` |
| **AI × Operations** | 3 | `ai-research-crew`, `ai-devops-agent`, `ai-data-pipeline` |

The **Security Research** recipes implement a full 8-phase-gate methodology (G0–G7) with evidence ledgers, adversarial audit, multi-agent policy, and mode-specific contracts.

## CLI Reference

<details>
<summary><strong>Full option table</strong></summary>

| Option | Description |
|---|---|
| `--agent` | `cursor`, `deepseek`, `kimi`, `claude`, `gpt`, `windsurf`, `cline`, `opencode`, `generic` |
| `--agents` | Comma-separated list for batch generation |
| `--domain` | `lab-build`, `code-review`, `security`, `feature-exploration`, `release-readiness`, `general` |
| `--task` | Task description (required) |
| `--context` | Additional background |
| `--constraints` | Rules to enforce |
| `--project` | Project directory to scan (default: cwd) |
| `--format` | `markdown`, `json`, `table`, `code`, `diagram`, `text` |
| `--tone` | `professional`, `casual`, `strict` |
| `--rewrite` | Polish raw input via rules or LLM |
| `--consult` | LLM authors the prompt with project grounding |
| `--recipe` | Use a one-shot recipe |
| `--recipes` | List all recipes |
| `--provider` | `openai`, `deepseek`, `anthropic`, `ollama`, `openai-compatible`, `mimo` |
| `--model` | LLM model name |
| `--api-key` | API key (or env var) |
| `--export` | `cursorrules`, `clinerules`, `agents-md`, `windsurfrules`, `opencode`, `vscode`, `custom-gpt`, `markdown` |
| `--pipe` | Send to agent CLI: `cursor`, `claude`, `opencode` |
| `--history` | List prompt history |
| `--score` | Score the generated prompt against a 6-dimension quality rubric |
| `--validate-recipes` | Validate recipe fields, categories, and placeholders |
| `--create-recipe` | Build + save a custom recipe (use `--recipe-name/-category/-role/-steps/-rules/-output/-placeholders`) |
| `--recipe-scope` | Save custom recipes to `project` (`.mpa/recipes/`) or `user` (`~/.mpa/recipes/`) |
| `--vars` | JSON object with values for a custom recipe's extra placeholders |
| `--json` | Machine-readable output |
| `--serve` | Start web UI |

</details>

## Web UI

```bash
npm start    # http://localhost:3000
```

Full-viewport drafting console. Binds to `127.0.0.1` (set `HOST`/`PORT` to override).

- Recipe dropdown with category grouping and task hints
- Platform capability chips on agent selection
- Dark/light theme toggle (persisted)
- Ctrl+Enter to forge, Share button for URL-encoded configs
- Live status strip with word count and engine badge

## Configuration

```bash
cp .env.example .env
```

| Provider | Env Var |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| MiMo | `MIMO_API_KEY` |
| Ollama | *(no key — local on `:11434`)* |

## Project Structure

```
src/
├── cli.js           # CLI orchestration
├── config.js        # Env & provider resolution
├── server.js        # Express web UI
├── generator.js     # Template prompt construction
├── architect.js     # LLM consult mode
├── context.js       # Project scanner
├── platforms.js     # Platform playbooks (9 agents)
├── recipes.js       # 111 one-shot recipes
├── custom-recipes.js # Custom recipe builder (build/validate/save/load)
├── scorer.js        # Prompt quality rubric scorer
├── history.js       # Prompt history store
├── piping.js        # Agent CLI piping
├── llm.js           # Multi-provider LLM client
├── enhancer.js      # Input polishing
├── templates.js     # Agent/domain profiles
└── exporters.js     # 10 export formatters
```

## Research Foundations

Synthesizes patterns from: LangGPT · Prompt Engineering Guide (dair-ai) · prompts.chat · Promptfoo · Microsoft Promptbase · GPTs leaked prompts

---

<p align="center">
  <sub>Built for solo engineers running multi-faceted operations.</sub>
</p>

## License

[MIT](LICENSE)
