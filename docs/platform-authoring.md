# Platform Playbook Authoring Guide

Every generated prompt includes a **Platform Playbook**: a section that tells
the target agent how to exploit its own platform's capabilities for the task.
Platforms are defined in `src/platforms.js` (built-ins) or as plugins
(`.mpa/plugins/*.js`).

## Platform object shape

```js
{
  name: 'Acme Agent',               // display name
  type: 'IDE agent',                // plugins: pass as "agentType" ("type" is reserved)
  modes: ['Turbo mode', 'Review mode'],
  context: ['@acme', '@workspace'], // context/reference features
  config: ['.acmerc'],              // config files the platform reads
  multiAgent: 'Spawns parallel workers for independent subtasks.',
  terminal: true,                   // can it run shell commands?
  strengths: ['fast inline edits', 'workspace-wide search'],
  playbook: [                       // the actual guidance (see below)
    'Use Turbo mode for any task touching more than one file.',
    'Run the project test command after code changes.'
  ]
}
```

Required fields: `name`, `modes`, `context`, `config` (arrays, may be empty),
`multiAgent` (string), `terminal` (boolean), `strengths`, `playbook` (arrays),
plus `type`/`agentType`.

## Playbook writing guidelines

Each playbook entry is one numbered instruction. Good entries are:

1. **Specific to the platform** — name the actual mode, feature, or config
   file ("Use @codebase to find existing patterns"), not generic advice.
2. **Actionable in one step** — imperative verb first.
3. **Ordered by workflow** — discovery first, then editing, then verification.
4. **Verification-aware** — end with running tests/linters when `terminal` is
   true; when false, instruct complete-file output instead.
5. **5–9 entries** — enough to be useful, short enough to be read.

Bad entries: "Be careful with code." (vague), "Use the terminal." (which
command? when?), "Follow best practices." (empty).

## Adding a built-in platform

1. Add the object to `platforms` in `src/platforms.js`.
2. Add the agent profile to `templates.agentProfiles` in `src/templates.js`
   (title + rules used by template mode).
3. Add the id to the CLI `--agent` help list and README option table.
4. Tests: the integration sweep asserts every agent id gets a playbook.

## Adding a plugin platform

```js
// .mpa/plugins/acme.js
module.exports = {
  name: 'Acme Agent',
  type: 'platform',
  id: 'acme',
  agentType: 'IDE agent',
  modes: ['Turbo mode'],
  context: ['@acme'],
  config: ['.acmerc'],
  multiAgent: 'none',
  terminal: true,
  strengths: ['fast'],
  playbook: ['Use Turbo mode for everything.']
};
```

Then: `node src/cli.js --agent acme --task "..."` — the plugin playbook is
used, template mode falls back to the generic agent profile. Verify with
`--plugins`.

## Testing the integration

```bash
node src/cli.js --agent acme --task "smoke test"   # playbook section present?
node src/cli.js --plugins                           # loaded without errors?
npm test                                            # sweep + goldens green?
```
