# HTTP API Reference

The web server (`npm start`, default `http://127.0.0.1:3000`) exposes a JSON
API. Set `HOST`/`PORT` to change binding. All POST endpoints accept and return
`application/json` unless noted.

## POST /api/generate

Generate a prompt.

**Body:** generation config — `task` (required), `agent`, `domain`, `context`,
`constraints`, `outputFormat`, `tone`, `lang`, `includeExamples`, `recipe`,
`variables`, `consult`, `rewrite`, `model`, `apiKey`, `apiBase`, `reasoning`,
`project`, `noProject`, `enhanceWith`.

**Response:**

```json
{
  "prompt": "...",
  "mode": "template | consult",
  "scanned": { "root": "...", "files": ["..."], "branch": "main" },
  "score": {
    "total": 48, "maxTotal": 60, "percent": 80, "grade": "B",
    "dimensions": [{ "id": "specificity", "label": "Specificity", "score": 8, "max": 10, "findings": ["..."] }]
  }
}
```

`scanned` is only present in consult mode with a project scan.

## POST /api/generate/stream

Consult-mode streaming via Server-Sent Events. Body: same as `/api/generate`
(must include `"consult": true`). Events:

```
data: {"token": "..."}            — repeated, one per streamed chunk
data: {"done": true, "prompt": "...", "mode": "consult", "scanned": {...}, "score": {...}}
data: {"error": "..."}            — on failure
```

## POST /api/export

Export a prompt in a file format.

**Body:** `{ "config": { ...generation config }, "format": "cursorrules | clinerules | agents-md | windsurfrules | opencode | opencode-jsonc | vscode | custom-gpt | antigravity | markdown | <plugin exporter id>", "name": "optional-name" }`

**Response:** `{ "ext": ".cursorrules", "content": "..." }`

Errors: 400 when `config` or `format` is missing.

## POST /api/scan

Scan a project directory for grounding context.

**Body:** `{ "path": "C:/my/project" }` (defaults to server cwd)

**Response:** `{ "scan": { "root", "tree", "files", "git" }, "summary": "..." }`

Errors: 400 for non-existent paths.

## GET /api/meta

Static metadata for the UI.

**Response:** `{ "recipes": [{ "id", "label", "tagline", "category", "taskHint", "placeholders", "source" }], "recipeCategories": {...}, "platforms": { "<id>": { "name", "type", "modes", "terminal", "multiAgent", "strengths" } } }`

Custom recipes from `.mpa/recipes/` are included (`source: "custom"`).

## POST /api/recipes/preview

Build a custom recipe draft without saving (used by the web UI wizard).

**Body:** `{ "name", "category", "role", "steps", "hardRules", "outputFormat", "placeholders" }`

**Response:** `{ "recipe": {...} }` or 400 with validation errors.

## POST /api/recipes

Build and save a custom recipe.

**Body:** same fields as preview, plus `scope` (`"project"` | `"user"`),
`project`, `recipeDir`, `overwrite` (boolean).

**Response:** 201 `{ "recipe": {...}, "directory": "...", "filePath": "..." }`
— 400 with validation errors or when the recipe exists and `overwrite` is not
set.

## GET /api/history?search=&limit=

List history entries (newest first, max `limit`, default 50).

**Response:** `[{ "id", "timestamp", "agent", "domain", "mode", "recipe", "task", "promptLength" }]`

## GET /api/history/:id

Full history entry (accepts id suffix). **Response:** `{ "id", "timestamp", "agent", "domain", "mode", "task", "prompt" }` — 404 when missing.

## GET /api/diff?id1=&id2=

Diff two history entries.

**Response:**

```json
{
  "a": { "id", "timestamp", "agent", "task" },
  "b": { "id", "timestamp", "agent", "task" },
  "summary": { "added": 19, "removed": 18, "unchanged": 27 },
  "configChanges": [{ "field": "agent", "from": "cursor", "to": "claude" }],
  "diff": [{ "type": "same | add | del", "text": "..." }]
}
```

Errors: 400 when ids are missing, 404 when an entry is not found.

## GET /api/analytics

Usage summary: `{ "totalEvents", "generated", "byAgent", "byMode", "byRecipe", "byExportFormat", "tests": { "total", "passed" }, "quality": { "scoredPrompts", "avgPercent", "overTime" } }`

## GET /api/plugins

Loaded plugins: `{ "loaded": ["exporter:yaml"], "errors": [{ "file", "error" }], "exporters": [...], "platforms": [...], "enhancers": [...], "scanners": [...] }`
