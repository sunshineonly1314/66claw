---
summary: "CLI reference for `openclawcn reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
---

# `openclawcn reset`

Reset local config/state (keeps the CLI installed).

```bash
openclawcn reset
openclawcn reset --dry-run
openclawcn reset --scope config+creds+sessions --yes --non-interactive
```

