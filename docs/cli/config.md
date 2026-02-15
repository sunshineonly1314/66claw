---
summary: "CLI reference for `openclawcn config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
---

# `openclawcn config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `openclawcn configure`).

## Examples

```bash
openclawcn config get browser.executablePath
openclawcn config set browser.executablePath "/usr/bin/google-chrome"
openclawcn config set agents.defaults.heartbeat.every "2h"
openclawcn config set agents.list[0].tools.exec.node "node-id-or-name"
openclawcn config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
openclawcn config get agents.defaults.workspace
openclawcn config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
openclawcn config get agents.list
openclawcn config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
openclawcn config set agents.defaults.heartbeat.every "0m"
openclawcn config set gateway.port 19001 --json
openclawcn config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.
