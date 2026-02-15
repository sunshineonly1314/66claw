---
summary: "CLI reference for `openclawcn logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
---

# `openclawcn logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:
- Logging overview: [Logging](/logging)

## Examples

```bash
openclawcn logs
openclawcn logs --follow
openclawcn logs --json
openclawcn logs --limit 500
```

