---
summary: "CLI reference for `openclawcn voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
---

# `openclawcn voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:
- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
openclawcn voicecall status --call-id <id>
openclawcn voicecall call --to "+15555550123" --message "Hello" --mode notify
openclawcn voicecall continue --call-id <id> --message "Any questions?"
openclawcn voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
openclawcn voicecall expose --mode serve
openclawcn voicecall expose --mode funnel
openclawcn voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.

