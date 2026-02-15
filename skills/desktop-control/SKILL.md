---
name: desktop-control
description: "Control any Windows desktop application GUI via screenshots, clicks, typing, and keyboard shortcuts. Works with all apps including custom-rendered ones (ToDesk, DingTalk, etc.)."
nameZh: "桌面控制"
descriptionZh: "通过截图、点击、输入和快捷键控制Windows桌面应用"
metadata: {"openclawcn":{"emoji":"🖥️","os":["win32"],"always":true}}
---

# Desktop Control Skill (Windows)

Use the built-in `desktop_control` tool to interact with any Windows desktop application.
This tool works via screenshot-based visual understanding + coordinate-based input, so it supports ALL apps including custom-rendered ones where standard UI Automation fails.

## Quick Start

See the screen:
```
desktop_control({action: "screenshot"})
```

Click a button:
```
desktop_control({action: "click", x: 400, y: 300})
```

Type text (supports Chinese):
```
desktop_control({action: "type", text: "Hello 你好"})
```

Send keyboard shortcut:
```
desktop_control({action: "key", keys: "ctrl+s"})
```

List visible windows:
```
desktop_control({action: "list_windows"})
```

Focus a window:
```
desktop_control({action: "focus", window: "ToDesk"})
```

## Typical Workflow

```
1. open_app({name: "ToDesk"})                           -- launch the app
2. desktop_control({action: "screenshot"})               -- see the screen
3. (AI analyzes the screenshot, identifies UI elements)
4. desktop_control({action: "click", x: 400, y: 300})   -- click input field
5. desktop_control({action: "type", text: "123321111"})  -- type device code
6. desktop_control({action: "key", keys: "tab"})         -- move to next field
7. desktop_control({action: "type", text: "password"})   -- type password
8. desktop_control({action: "click", x: 500, y: 400})   -- click connect
9. desktop_control({action: "screenshot"})               -- verify result
```

## Actions Reference

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `screenshot` | (none) | `window` | Capture primary screen or specific window |
| `click` | `x`, `y` | `button`, `double` | Click at screen coordinates |
| `type` | `text` | (none) | Type text via clipboard paste (Unicode/CJK safe) |
| `key` | `keys` | (none) | Send keyboard shortcut |
| `scroll` | `x`, `y` | `amount` | Scroll mouse wheel at coordinates |
| `list_windows` | (none) | (none) | List visible windows with positions |
| `focus` | `window` | (none) | Bring window to foreground by title match |

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | One of: screenshot, click, type, key, scroll, list_windows, focus |
| `x` | number | Screen X coordinate (physical pixels) |
| `y` | number | Screen Y coordinate (physical pixels) |
| `button` | string | Mouse button: "left" (default), "right", "middle" |
| `double` | boolean | Double-click if true |
| `text` | string | Text to type (full Unicode support) |
| `keys` | string | Keyboard combo: "ctrl+c", "alt+f4", "enter", "tab", etc. |
| `window` | string | Window title substring for targeting |
| `amount` | number | Scroll notches: positive=up, negative=down (default: -3) |

## Supported Keyboard Shortcuts

| Input | SendKeys | Notes |
|-------|----------|-------|
| `ctrl+c` | ^c | Copy |
| `ctrl+v` | ^v | Paste |
| `ctrl+a` | ^a | Select all |
| `ctrl+s` | ^s | Save |
| `ctrl+shift+s` | ^+s | Save as |
| `alt+f4` | %{F4} | Close window |
| `enter` | {ENTER} | Press Enter |
| `tab` | {TAB} | Press Tab |
| `escape` / `esc` | {ESC} | Press Escape |
| `f1`-`f12` | {F1}-{F12} | Function keys |
| `up`/`down`/`left`/`right` | Arrow keys | Navigation |

## How It Works (Internal)

1. **Screenshot**: `System.Drawing.Graphics.CopyFromScreen()` captures screen as PNG
2. **Click**: `user32.dll SetCursorPos + mouse_event` moves cursor and clicks
3. **Type**: `SendInput` with `KEYEVENTF_UNICODE` per character (CJK safe)
4. **Key**: `System.Windows.Forms.SendKeys.SendWait()` sends keyboard shortcuts
5. **Scroll**: `user32.dll mouse_event` with `MOUSEEVENTF_WHEEL` at cursor position
6. **List Windows**: `user32.dll EnumWindows` enumerates visible windows
7. **Focus**: `user32.dll SetForegroundWindow + ShowWindow` activates window

All APIs are built into Windows .NET Framework — zero external dependencies.

## Tips

- Always take a screenshot before clicking to verify current UI state
- After clicking/typing, take another screenshot to verify the result
- Use `list_windows` to find exact window titles for `focus`
- For Chinese input, use `type` action (clipboard paste handles CJK perfectly)
- Coordinates in screenshots are physical pixels matching click coordinates
- The tool calls `SetProcessDPIAware()` for correct high-DPI coordinate handling
- This tool is Windows-only; on macOS, use `Peekaboo` for similar functionality
- For WeChat (微信): use the `wechat-desktop` skill for reliable contact switching via search instead of sidebar clicking
