---
name: wechat-desktop
description: "WeChat desktop automation for Windows. Send messages via wechat_send, check for new messages via wechat_check, read conversations, and auto-reply. Login handling and manual fallback via desktop_control."
nameZh: "微信桌面操作"
descriptionZh: "Windows微信自动化：发消息用wechat_send，查看新消息用wechat_check，读取对话和自动回复"
metadata: {"openclawcn":{"emoji":"💬","os":["win32"],"always":true}}
---

# WeChat Desktop Automation (Windows)

## 发送消息 — Sending Messages

**Always use the `wechat_send` tool:**
```
wechat_send({contact: "小李", message: "你好"})
```
This tool handles the entire flow automatically: search contact → click result → type message → send → return screenshot.

**To send to multiple contacts**, call `wechat_send` once per person:
```
wechat_send({contact: "张三", message: "Hello"})
wechat_send({contact: "李四", message: "Meeting at 3pm"})
```

If `wechat_send` fails, see the "Manual Fallback" section below.

## 查看新消息 — Checking for New Messages

**Use the `wechat_check` tool to scan for unread messages:**
```
wechat_check({})                          -- screenshot current sidebar
wechat_check({scroll_pages: 3})           -- scroll down 3 pages, screenshot each
wechat_check({contact: "小李"})           -- open 小李's chat and screenshot it
```

### How unread indicators look in WeChat:
- **Red badge with number**: contact has N unread messages (e.g., red circle with "5")
- **Red dot (no number)**: contact has unread messages (muted conversation)
- **Bold contact name**: recently received message
- **Top of list position**: recent activity (WeChat sorts by last message time)

The tool returns screenshots. Analyze them to identify:
1. Which contacts have red badges/dots
2. The badge numbers (how many unread)
3. The last message preview text shown under each contact name

## 读取消息 — Reading Messages

After identifying a contact with unread messages:
```
1. wechat_check({contact: "小李"})                          -- open chat, screenshot
2. desktop_control({action: "key", keys: "pageup"})         -- scroll up for older
3. desktop_control({action: "screenshot"})                   -- read older messages
4. (repeat 2-3 as needed)
```

Or use scroll for finer control over chat history:
```
desktop_control({action: "scroll", x: <chat_center_x>, y: <chat_center_y>, amount: 3})
desktop_control({action: "screenshot"})
```

## 自动回复 — Auto-Reply Workflow

Complete auto-reply flow:
```
1. wechat_check({scroll_pages: 2})          -- scan sidebar for unread badges
2. (analyze screenshots to find contacts with unread messages)
3. For each contact with unread:
   a. wechat_check({contact: "联系人名"})   -- open chat, read messages
   b. (analyze the message content from screenshot)
   c. wechat_send({contact: "联系人名", message: "回复内容"})
   d. (verify send success from returned screenshot)
```

### Auto-reply tips:
- Process contacts one at a time to avoid confusion
- Always read the full visible conversation before replying
- If the chat has many messages, scroll up to understand context
- After sending, the returned screenshot lets you verify the reply was sent

## 滚动联系人列表 — Scrolling the Contact List

WeChat contact list is in the left sidebar (~70-320px from left edge).
To scroll it:
```
desktop_control({action: "scroll", x: <sidebar_center_x>, y: <sidebar_center_y>, amount: -3})
```
- `amount: -3` = scroll down 3 notches (~5 contacts)
- `amount: 3` = scroll up 3 notches
- After scrolling, always take a screenshot to see the new contacts

Or use `wechat_check({scroll_pages: N})` which automates scroll + screenshot.

## 登录处理 — Login Screen Detection

After launching WeChat, take a screenshot and check:

**Screen A — Green "进入微信" button + round avatar photo:**
WeChat is already logged in. Click the green button.
```
desktop_control({action: "click", x: <button_x>, y: <button_y>})
```
**There is NO QR code on this screen. Do NOT say "扫码" or "二维码".**

**Screen B — Black-and-white QR code square:**
Tell user: "请用手机微信扫一扫屏幕上的二维码来登录。"

**Screen C — "已扫描，请在手机上确认":**
Tell user: "请在手机上点击确认登录。"

## 启动微信 — Launching WeChat

```
open_app({name: "微信"})
-- wait 2-3 seconds, then screenshot to check login state
desktop_control({action: "screenshot"})
```

## Manual Fallback (仅当 wechat_send/wechat_check 失败时)

If the composite tools are unavailable or return an error, use `desktop_control` manually:

1. `focus` WeChat window
2. `key` Ctrl+F to open search
3. `screenshot` to verify search bar
4. `type` the contact name
5. `screenshot` to see search results
6. `click` the matching result in the dropdown (NOT the search bar)
7. `key` Escape to close search
8. `screenshot` to verify chat header shows the contact
9. `click` the input box at the bottom of the chat
10. `type` the message
11. `key` Enter to send
12. `screenshot` to verify

**Critical**: Step 6 (click search result) must NOT be skipped. Typing a message in the search bar does nothing.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+F` | Open search |
| `Enter` | Send (default) |
| `Ctrl+Enter` | Send (alternative config) |
| `Escape` | Close search/dialog |
| `Ctrl+V` | Paste image/file |
| `PageUp` | Scroll chat history up |
| `PageDown` | Scroll chat history down |
