---
name: agent-browser-clawdbot
name_zh: Clawd浏览器
description: 面向 AI agents 优化的无头浏览器自动化 CLI，支持可访问性树快照（accessibility tree snapshots）与基于引用（ref-based）的元素选择
description_zh: 面向 AI agents 优化的无头浏览器自动化 CLI，支持可访问性树快照（accessibility tree snapshots）与基于引用（ref-based）的元素选择
metadata: {"clawdbot":{"emoji":"🌐","requires":{"commands":["agent-browser"]},"homepage":"https://github.com/vercel-labs/agent-browser"}}
---
# Agent 浏览器技能（Browser Skill）

利用可访问性树快照（accessibility tree snapshots）与引用（refs）实现快速、确定性的浏览器自动化。

## 为何选用此工具而非内置浏览器工具？

**请在以下场景中选用 agent-browser：**  
- 自动化多步骤工作流  
- 需要确定性的元素选择能力  
- 性能至关重要  
- 处理复杂的单页应用（SPAs）  
- 需要会话隔离（session isolation）  

**请在以下场景中选用内置浏览器工具：**  
- 需要截图或 PDF 用于分析  
- 需要视觉检查（visual inspection）  
- 需要集成浏览器扩展（browser extension）  

## 核心工作流

```bash
# 1. Navigate and snapshot
agent-browser open https://example.com
agent-browser snapshot -i --json

# 2. Parse refs from JSON, then interact
agent-browser click @e2
agent-browser fill @e3 "text"

# 3. Re-snapshot after page changes
agent-browser snapshot -i --json
```

## 关键命令

### 导航
```bash
agent-browser open <url>
agent-browser back | forward | reload | close
```

### 快照（务必使用 -i --json 参数）
```bash
agent-browser snapshot -i --json          # Interactive elements, JSON output
agent-browser snapshot -i -c -d 5 --json  # + compact, depth limit
agent-browser snapshot -s "#main" -i      # Scope to selector
```

### 交互操作（基于引用 ref）
```bash
agent-browser click @e2
agent-browser fill @e3 "text"
agent-browser type @e3 "text"
agent-browser hover @e4
agent-browser check @e5 | uncheck @e5
agent-browser select @e6 "value"
agent-browser press "Enter"
agent-browser scroll down 500
agent-browser drag @e7 @e8
```

### 获取信息
```bash
agent-browser get text @e1 --json
agent-browser get html @e2 --json
agent-browser get value @e3 --json
agent-browser get attr @e4 "href" --json
agent-browser get title --json
agent-browser get url --json
agent-browser get count ".item" --json
```

### 检查状态
```bash
agent-browser is visible @e2 --json
agent-browser is enabled @e3 --json
agent-browser is checked @e4 --json
```

### 等待
```bash
agent-browser wait @e2                    # Wait for element
agent-browser wait 1000                   # Wait ms
agent-browser wait --text "Welcome"       # Wait for text
agent-browser wait --url "**/dashboard"   # Wait for URL
agent-browser wait --load networkidle     # Wait for network
agent-browser wait --fn "window.ready === true"
```

### 会话（隔离式浏览器）
```bash
agent-browser --session admin open site.com
agent-browser --session user open site.com
agent-browser session list
# Or via env: AGENT_BROWSER_SESSION=admin agent-browser ...
```

### 状态持久化
```bash
agent-browser state save auth.json        # Save cookies/storage
agent-browser state load auth.json        # Load (skip login)
```

### 截图与 PDF
```bash
agent-browser screenshot page.png
agent-browser screenshot --full page.png
agent-browser pdf page.pdf
```

### 网络控制
```bash
agent-browser network route "**/ads/*" --abort           # Block
agent-browser network route "**/api/*" --body '{"x":1}'  # Mock
agent-browser network requests --filter api              # View
```

### Cookies 与 Storage
```bash
agent-browser cookies                     # Get all
agent-browser cookies set name value
agent-browser storage local key           # Get localStorage
agent-browser storage local set key val
```

### 标签页与框架（Tabs & Frames）
```bash
agent-browser tab new https://example.com
agent-browser tab 2                       # Switch to tab
agent-browser frame @e5                   # Switch to iframe
agent-browser frame main                  # Back to main
```

## 快照输出格式

```json
{
  "success": true,
  "data": {
    "snapshot": "...",
    "refs": {
      "e1": {"role": "heading", "name": "Example Domain"},
      "e2": {"role": "button", "name": "Submit"},
      "e3": {"role": "textbox", "name": "Email"}
    }
  }
}
```

## 最佳实践

1. **始终使用 `-i` 标志** —— 仅聚焦于可交互元素  
2. **始终使用 `--json`** —— 更易于解析  
3. **等待页面稳定** —— `agent-browser wait --load networkidle`  
4. **保存身份验证状态** —— 使用 `state save/load` 跳过登录流程  
5. **使用会话（Sessions）** —— 隔离不同的浏览器上下文  
6. **使用 `--headed` 进行调试** —— 直观查看当前运行状态  

## 示例：搜索与信息提取

```bash
agent-browser open https://www.google.com
agent-browser snapshot -i --json
# AI identifies search box @e1
agent-browser fill @e1 "AI agents"
agent-browser press Enter
agent-browser wait --load networkidle
agent-browser snapshot -i --json
# AI identifies result refs
agent-browser get text @e3 --json
agent-browser get attr @e4 "href" --json
```

## 示例：多会话测试

```bash
# Admin session
agent-browser --session admin open app.com
agent-browser --session admin state load admin-auth.json
agent-browser --session admin snapshot -i --json

# User session (simultaneous)
agent-browser --session user open app.com
agent-browser --session user state load user-auth.json
agent-browser --session user snapshot -i --json
```

## 安装

```bash
npm install -g agent-browser
agent-browser install                     # Download Chromium
agent-browser install --with-deps         # Linux: + system deps
```

## 致谢

本技能由 Yossi Elkrief（[@MaTriXy](https://github.com/MaTriXy)）开发  

agent-browser CLI 由 [Vercel Labs](https://github.com/vercel-labs/agent-browser) 提供  