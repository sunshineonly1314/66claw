---
summary: "CLI reference for `openclawcn approvals` (exec approvals for gateway or node hosts)"
read_when:
  - You want to edit exec approvals from the CLI
  - You need to manage allowlists on gateway or node hosts
---

# `openclawcn approvals`

Manage exec approvals for the **local host**, **gateway host**, or a **node host**.
By default, commands target the local approvals file on disk. Use `--gateway` to target the gateway, or `--node` to target a specific node.

Related:
- Exec approvals: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## Common commands

```bash
openclawcn approvals get
openclawcn approvals get --node <id|name|ip>
openclawcn approvals get --gateway
```

## Replace approvals from a file

```bash
openclawcn approvals set --file ./exec-approvals.json
openclawcn approvals set --node <id|name|ip> --file ./exec-approvals.json
openclawcn approvals set --gateway --file ./exec-approvals.json
```

## Allowlist helpers

```bash
openclawcn approvals allowlist add "~/Projects/**/bin/rg"
openclawcn approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
openclawcn approvals allowlist add --agent "*" "/usr/bin/uname"

openclawcn approvals allowlist remove "~/Projects/**/bin/rg"
```

## Notes

- `--node` uses the same resolver as `openclawcn nodes` (id, name, ip, or id prefix).
- `--agent` defaults to `"*"`, which applies to all agents.
- The node host must advertise `system.execApprovals.get/set` (macOS app or headless node host).
- Approvals files are stored per host at `~/.openclawcn/exec-approvals.json`.
