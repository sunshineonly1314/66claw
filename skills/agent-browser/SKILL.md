---
name: Agent 浏览器
name_zh: 智能浏览器
description: 一款基于 Rust 的快速无头浏览器自动化 CLI 工具，附带 Node.js 回退方案，支持 AI agents 通过结构化命令执行网页导航、点击、输入及页面快照。
description_zh: 一款基于 Rust 的快速无头浏览器自动化 CLI 工具，附带 Node.js 回退方案，支持 AI agents 通过结构化命令执行网页导航、点击、输入及页面快照。
read_when:
  - 自动化网页交互
  - 从网页中提取结构化数据
  - 以编程方式填写表单
  - 测试网页 UI
metadata: {"clawdbot":{"emoji":"🌐","requires":{"bins":["node","npm"]}}}
allowed-tools: Bash(agent-browser:*)
---
# 使用 agent-browser 实现浏览器自动化

## 安装

### 推荐使用 npm

```bash
npm install -g agent-browser
agent-browser install
agent-browser install --with-deps
```

### 源码编译安装

```bash
git clone https://github.com/vercel-labs/agent-browser
cd agent-browser
pnpm install
pnpm build
agent-browser install
```

## 快速上手

```bash
agent-browser open <url>        # Navigate to page
agent-browser snapshot -i       # Get interactive elements with refs
agent-browser click @e1         # Click element by ref
agent-browser fill @e2 "text"   # Fill input by ref
agent-browser close             # Close browser
```

## 核心工作流

1. 导航：`agent-browser open <url>`  
2. 快照：`agent-browser snapshot -i`（返回含引用标识符（refs）的元素，例如 `@e1`、`@e2`）  
3. 利用快照所得 refs 进行交互  
4. 导航完成或 DOM 发生显著变更后，重新执行快照

## 命令列表

### 导航

```bash
agent-browser open <url>      # Navigate to URL
agent-browser back            # Go back
agent-browser forward         # Go forward
agent-browser reload          # Reload page
agent-browser close           # Close browser
```

### 快照（页面分析）

```bash
agent-browser snapshot            # Full accessibility tree
agent-browser snapshot -i         # Interactive elements only (recommended)
agent-browser snapshot -c         # Compact output
agent-browser snapshot -d 3       # Limit depth to 3
agent-browser snapshot -s "#main" # Scope to CSS selector
```

### 交互（使用快照生成的 @refs）

```bash
agent-browser click @e1           # Click
agent-browser dblclick @e1        # Double-click
agent-browser focus @e1           # Focus element
agent-browser fill @e2 "text"     # Clear and type
agent-browser type @e2 "text"     # Type without clearing
agent-browser press Enter         # Press key
agent-browser press Control+a     # Key combination
agent-browser keydown Shift       # Hold key down
agent-browser keyup Shift         # Release key
agent-browser hover @e1           # Hover
agent-browser check @e1           # Check checkbox
agent-browser uncheck @e1         # Uncheck checkbox
agent-browser select @e1 "value"  # Select dropdown
agent-browser scroll down 500     # Scroll page
agent-browser scrollintoview @e1  # Scroll element into view
agent-browser drag @e1 @e2        # Drag and drop
agent-browser upload @e1 file.pdf # Upload files
```

### 获取信息

```bash
agent-browser get text @e1        # Get element text
agent-browser get html @e1        # Get innerHTML
agent-browser get value @e1       # Get input value
agent-browser get attr @e1 href   # Get attribute
agent-browser get title           # Get page title
agent-browser get url             # Get current URL
agent-browser get count ".item"   # Count matching elements
agent-browser get box @e1         # Get bounding box
```

### 检查状态

```bash
agent-browser is visible @e1      # Check if visible
agent-browser is enabled @e1      # Check if enabled
agent-browser is checked @e1      # Check if checked
```

### 截图与 PDF 导出

```bash
agent-browser screenshot          # Screenshot to stdout
agent-browser screenshot path.png # Save to file
agent-browser screenshot --full   # Full page
agent-browser pdf output.pdf      # Save as PDF
```

### 视频录制

```bash
agent-browser record start ./demo.webm    # Start recording (uses current URL + state)
agent-browser click @e1                   # Perform actions
agent-browser record stop                 # Stop and save video
agent-browser record restart ./take2.webm # Stop current + start new recording
```

录制会创建全新上下文，但保留当前会话中的 cookies 和 storage。若未指定 URL，录制将自动返回至当前页面。为保障演示流畅，建议先探索页面，再启动录制。

### 等待

```bash
agent-browser wait @e1                     # Wait for element
agent-browser wait 2000                    # Wait milliseconds
agent-browser wait --text "Success"        # Wait for text
agent-browser wait --url "/dashboard"    # Wait for URL pattern
agent-browser wait --load networkidle      # Wait for network idle
agent-browser wait --fn "window.ready"     # Wait for JS condition
```

### 鼠标控制

```bash
agent-browser mouse move 100 200      # Move mouse
agent-browser mouse down left         # Press button
agent-browser mouse up left           # Release button
agent-browser mouse wheel 100         # Scroll wheel
```

### 语义定位器（ref 的替代方案）

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find first ".item" click
agent-browser find nth 2 "a" text
```

### 浏览器设置

```bash
agent-browser set viewport 1920 1080      # Set viewport size
agent-browser set device "iPhone 14"      # Emulate device
agent-browser set geo 37.7749 -122.4194   # Set geolocation
agent-browser set offline on              # Toggle offline mode
agent-browser set headers '{"X-Key":"v"}' # Extra HTTP headers
agent-browser set credentials user pass   # HTTP basic auth
agent-browser set media dark              # Emulate color scheme
```

### Cookies 与 Storage

```bash
agent-browser cookies                     # Get all cookies
agent-browser cookies set name value      # Set cookie
agent-browser cookies clear               # Clear cookies
agent-browser storage local               # Get all localStorage
agent-browser storage local key           # Get specific key
agent-browser storage local set k v       # Set value
agent-browser storage local clear         # Clear all
```

### 网络

```bash
agent-browser network route <url>              # Intercept requests
agent-browser network route <url> --abort      # Block requests
agent-browser network route <url> --body '{}'  # Mock response
agent-browser network unroute [url]            # Remove routes
agent-browser network requests                 # View tracked requests
agent-browser network requests --filter api    # Filter requests
```

### 标签页与窗口

```bash
agent-browser tab                 # List tabs
agent-browser tab new [url]       # New tab
agent-browser tab 2               # Switch to tab
agent-browser tab close           # Close tab
agent-browser window new          # New window
```

### 框架（Frames）

```bash
agent-browser frame "#iframe"     # Switch to iframe
agent-browser frame main          # Back to main frame
```

### 对话框（Dialogs）

```bash
agent-browser dialog accept [text]  # Accept dialog
agent-browser dialog dismiss        # Dismiss dialog
```

### JavaScript 执行

```bash
agent-browser eval "document.title"   # Run JavaScript
```

### 状态管理

```bash
agent-browser state save auth.json    # Save session state
agent-browser state load auth.json    # Load saved state
```

## 示例：表单提交

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output shows: textbox "Email" [ref=e1], textbox "Password" [ref=e2], button "Submit" [ref=e3]

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## 示例：使用已保存状态进行身份验证

```bash
# Login once
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "username"
agent-browser fill @e2 "password"
agent-browser click @e3
agent-browser wait --url "/dashboard"
agent-browser state save auth.json

# Later sessions: load saved state
agent-browser state load auth.json
agent-browser open https://app.example.com/dashboard
```

## 会话（并行浏览器实例）

```bash
agent-browser --session test1 open site-a.com
agent-browser --session test2 open site-b.com
agent-browser session list
```

## JSON 输出（便于程序解析）

添加 `--json` 参数以获取机器可读输出：

```bash
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```

## 调试

```bash
agent-browser open example.com --headed              # Show browser window
agent-browser console                                # View console messages
agent-browser console --clear                        # Clear console
agent-browser errors                                 # View page errors
agent-browser errors --clear                         # Clear errors
agent-browser highlight @e1                          # Highlight element
agent-browser trace start                            # Start recording trace
agent-browser trace stop trace.zip                   # Stop and save trace
agent-browser record start ./debug.webm              # Record from current page
agent-browser record stop                            # Save recording
agent-browser --cdp 9222 snapshot                    # Connect via CDP
```

## 故障排除

- 若在 Linux ARM64 系统上提示命令未找到，请使用 bin 目录下的完整路径；
- 若找不到某个元素，请使用 snapshot 命令查找正确 ref；
- 若页面尚未加载完成，请在导航命令后添加 wait 命令；
- 可使用 --headed 参数显示浏览器窗口，用于调试。

## 可选参数

- --session <name> uses an isolated session.
- --json provides JSON output.
- --full takes a full page screenshot.
- --headed shows the browser window.
- --timeout sets the command timeout in milliseconds.
- --cdp <port> connects via Chrome DevTools Protocol.

## 注意事项

- ref 在单次页面加载期间稳定，但页面跳转后会变化；
- 页面跳转后务必重新执行 snapshot，以获取新 ref；
- 对输入框请优先使用 fill 命令而非 type，以确保清除原有文本。

## 问题反馈

- skill 相关问题：请在 https://github.com/TheSethRose/Agent-Browser-CLI 提交 issue；  
- agent-browser CLI 相关问题：请在 https://github.com/vercel-labs/agent-browser 提交 issue。