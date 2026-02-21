---
name: blucli
description: BluOS CLI (blu) for discovery, playback, grouping, and volume.
nameZh: "蓝牙控制"
descriptionZh: "BluOS CLI用于发现、播放、分组和音量控制"
homepage: https://blucli.sh
metadata: {"openclawcn":{"emoji":"🫐","requires":{"bins":["blu"]},"install":[{"id":"go","kind":"go","module":"github.com/steipete/blucli/cmd/blu@latest","bins":["blu"],"label":"安装 blucli (go)"}]}}
---

# blucli (blu)

Use `blu` to control Bluesound/NAD players.

Quick start
- `blu devices` (pick target)
- `blu --device <id> status`
- `blu play|pause|stop`
- `blu volume set 15`

Target selection (in priority order)
- `--device <id|name|alias>`
- `BLU_DEVICE`
- config default (if set)

Common tasks
- Grouping: `blu group status|add|remove`
- TuneIn search/play: `blu tunein search "query"`, `blu tunein play "query"`

Prefer `--json` for scripts. Confirm the target device before changing playback.
