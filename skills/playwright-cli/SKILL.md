---
name: playwright-cli
name_zh: Playwright CLI
description: 通过 Playwright CLI 实现浏览器自动化。打开网页、与页面元素交互、截取屏幕截图等。适用于 coding agents 和自动化测试工作流。
description_zh: 通过 Playwright CLI 实现浏览器自动化。打开网页、与页面元素交互、截取屏幕截图等。适用于 coding agents 和自动化测试工作流。
metadata: {"clawdbot":{"emoji":"🎭","requires":{"bins":["playwright-cli"]},"install":[{"id":"node","kind":"node","package":"@playwright/mcp","bins":["playwright-cli"],"label":"Install Playwright CLI (npm)"}]}}
---
# Playwright CLI

基于 Playwright 的浏览器自动化工具。面向 coding agents 设计的轻量级命令行接口。

## 安装

```bash
npm install -g @playwright/mcp@latest
playwright-cli --help
```

## 核心命令

| 命令 | 描述 |
|------|------|
| `playwright-cli open <url>` | 在浏览器中打开指定 URL |
| `playwright-cli close` | 关闭当前页面 |
| `playwright-cli type <text>` | 向可编辑元素中输入文本 |
| `playwright-cli click <ref> [button]` | 单击某元素 |
| `playwright-cli dblclick <ref> [button]` | 双击某元素 |
| `playwright-cli fill <ref> <text>` | 向表单字段中填充文本 |
| `playwright-cli drag <startRef> <endRef>` | 拖放操作 |
| `playwright-cli hover <ref>` | 鼠标悬停于某元素上方 |
| `playwright-cli check <ref>` | 勾选复选框或单选按钮 |
| `playwright-cli uncheck <ref>` | 取消勾选复选框 |
| `playwright-cli select <ref> <val>` | 选择下拉菜单中的选项 |
| `playwright-cli snapshot` | 捕获页面快照，供后续引用 |

## 导航

```bash
playwright-cli go-back           # Go back
playwright-cli go-forward        # Go forward
playwright-cli reload            # Reload page
```

## 键盘与鼠标操作

```bash
playwright-cli press <key>       # Press key (a, arrowleft, enter...)
playwright-cli keydown <key>     # Key down
playwright-cli keyup <key>       # Key up
playwright-cli mousemove <x> <y> # Move mouse
playwright-cli mousedown [button] # Mouse down
playwright-cli mouseup [button]   # Mouse up
playwright-cli mousewheel <dx> <dy> # Scroll
```

## 保存与导出

```bash
playwright-cli screenshot [ref]  # Screenshot page or element
playwright-cli pdf               # Save as PDF
```

## 标签页（Tabs）

```bash
playwright-cli tab-list          # List all tabs
playwright-cli tab-new [url]     # Open new tab
playwright-cli tab-close [index] # Close tab
playwright-cli tab-select <index> # Switch tab
```

## 开发者工具（DevTools）

```bash
playwright-cli console [min-level]  # View console messages
playwright-cli network              # View network requests
playwright-cli run-code <code>      # Run JS snippet
playwright-cli tracing-start        # Start trace
playwright-cli tracing-stop         # Stop trace
```

## 会话（Sessions）

```bash
playwright-cli session-list         # List sessions
playwright-cli session-stop [name]  # Stop session
playwright-cli session-stop-all     # Stop all
playwright-cli session-delete [name] # Delete session data
```

## 图形界面模式（Headed Mode）

```bash
playwright-cli open https://example.com --headed
```

## 示例

```bash
# Open and interact
playwright-cli open https://example.com
playwright-cli type "search query"
playwright-cli press Enter
playwright-cli screenshot

# Use sessions
playwright-cli open https://site1.com
playwright-cli --session=project-a open https://site2.com
```

## 环境变量

| 变量 | 描述 |
|------|------|
| `PLAYWRIGHT_MCP_BROWSER` | 浏览器类型：chrome、firefox、webkit、msedge |
| `PLAYWRIGHT_MCP_HEADLESS` | 是否以无头模式运行（默认为图形界面模式） |
| `PLAYWRIGHT_MCP_ALLOWED_HOSTS` | 允许访问的主机列表（逗号分隔） |
| `PLAYWRIGHT_MCP_CONFIG` | 配置文件路径 |

## 配置

创建 `playwright-cli.json` 文件以持久化配置项：

```json
{
  "browser": {
    "browserName": "chromium",
    "headless": false
  },
  "outputDir": "./playwright-output",
  "console": {
    "level": "info"
  }
}
```

## 注意事项

- **跨平台支持** — 需要 Node.js 18+（支持 Linux、macOS、Windows）
- 会话默认持久化 cookies / storage
- 使用 `--session` 标志可启用隔离的浏览器实例
- 快照命令返回元素引用（refs），供后续命令调用

## 源码

https://github.com/microsoft/playwright-cli