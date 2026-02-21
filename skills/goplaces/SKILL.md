---
name: goplaces
description: Query Google Places API (New) via the goplaces CLI for text search, place details, resolve, and reviews. Use for human-friendly place lookup or JSON output for scripts.
nameZh: "地图导航"
descriptionZh: "通过Google Places API搜索地点、查看详情和评论"
homepage: https://github.com/steipete/goplaces
metadata: {"openclawcn":{"emoji":"📍","requires":{"bins":["goplaces"],"env":["GOOGLE_PLACES_API_KEY"]},"primaryEnv":"GOOGLE_PLACES_API_KEY","install":[{"id":"brew","kind":"brew","formula":"steipete/tap/goplaces","bins":["goplaces"],"label":"安装 goplaces (brew)"},{"id":"download","kind":"download","url":"https://github.com/steipete/goplaces/releases/latest","bins":["goplaces"],"label":"下载 goplaces","os":["win32","linux"]}]}}
---

# goplaces

Modern Google Places API (New) CLI. Human output by default, `--json` for scripts.

Install
- Homebrew: `brew install steipete/tap/goplaces`

Config
- `GOOGLE_PLACES_API_KEY` required.
- Optional: `GOOGLE_PLACES_BASE_URL` for testing/proxying.

Common commands
- Search: `goplaces search "coffee" --open-now --min-rating 4 --limit 5`
- Bias: `goplaces search "pizza" --lat 40.8 --lng -73.9 --radius-m 3000`
- Pagination: `goplaces search "pizza" --page-token "NEXT_PAGE_TOKEN"`
- Resolve: `goplaces resolve "Soho, London" --limit 5`
- Details: `goplaces details <place_id> --reviews`
- JSON: `goplaces search "sushi" --json`

Notes
- `--no-color` or `NO_COLOR` disables ANSI color.
- Price levels: 0..4 (free → very expensive).
- Type filter sends only the first `--type` value (API accepts one).
