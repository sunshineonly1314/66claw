---
name: open-app
description: "Find and launch any desktop application on Windows by name. Supports Chinese and English app names, common aliases, registry, shortcuts, and UWP Store apps."
nameZh: "打开应用"
descriptionZh: "通过名称查找并启动Windows桌面应用程序"
metadata: {"openclawcn":{"emoji":"🚀","os":["win32"],"always":true}}
---

# Open App Skill (Windows)

Use the built-in `open_app` tool to find and launch desktop applications on Windows.
No PowerShell scripting needed — just call the tool with the app name.

## Quick Start

Launch an app:
```
open_app({name: "Chrome"})
open_app({name: "网易云音乐"})
open_app({name: "微信"})
```

Find an app (return path without launching):
```
open_app({name: "WeChat", action: "find"})
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | *(required)* | App name keyword, supports Chinese and English |
| `action` | `"launch"` \| `"find"` | `"launch"` | `launch` = find and open; `find` = locate only |

## Common App Name Examples

Users may ask in various ways. The tool handles aliases automatically:

| User Says | Tool Searches |
|-----------|---------------|
| 微信 | WeChat, 微信 |
| 网易云 / 网易云音乐 | CloudMusic, 网易云音乐, Netease |
| 钉钉 / DingTalk | DingDing, 钉钉, DingTalk |
| 飞书 / Lark | Feishu, 飞书, Lark |
| 企业微信 / WeCom | WXWork, 企业微信, WeCom |
| QQ音乐 | QQMusic, QQ音乐 |
| 谷歌浏览器 | Chrome, Google Chrome |
| vscode / vs code | Visual Studio Code, Code |
| b站 / bilibili | bilibili, 哔哩哔哩 |
| 记事本 | Notepad |
| 计算器 | Calculator, calc |
| 画图 | mspaint, Paint |

For apps not in the alias table, just pass the actual app name and it will be found via registry/shortcuts/filesystem.

## How It Works (Internal)

The tool searches 5 layers in order, stops at first match:

1. **App Paths registry** — `HKLM/HKCU\...\App Paths\*.exe` (fastest, <50ms)
2. **Uninstall registry** — DisplayName matching + exe extraction (~100ms)
3. **Start Menu + Desktop shortcuts** — `.lnk` file resolution (~500ms)
4. **Filesystem scan** — `Program Files`, `Program Files (x86)`, `LOCALAPPDATA` (1-3s)
5. **UWP/Store apps** — `Get-AppxPackage` + manifest AppId query (~500ms)

## Return Values

**Success (launched):**
```
已启动: 网易云音乐
路径: C:\Program Files\Netease\CloudMusic\cloudmusic.exe
(来源: registry)
```

**Success (find only):**
```
找到应用: 网易云音乐
路径: C:\Program Files\Netease\CloudMusic\cloudmusic.exe
(来源: registry)
```

**Not found:**
```
未找到匹配 '某应用' 的应用。建议检查应用是否已安装。
```

## Tips

- Always prefer `open_app` over writing PowerShell scripts to find/launch apps.
- If the user asks to "open" or "launch" or "start" any app, use this tool.
- Use `action: "find"` when the user wants to know where an app is installed.
- The tool is Windows-only; on macOS use `open -a "App Name"` via exec instead.
- UWP/Store apps (like Calculator, Paint, Photos) are also supported.
