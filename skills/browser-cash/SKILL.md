---
name: browser-cash
name_zh: 浏览器现金
description: 通过 Browser.cash 启动不受拦截的浏览器会话，用于网页自动化。这些会话可绕过反爬虫防护机制（如 Cloudflare、DataDome 等），因此非常适合网络数据抓取与自动化任务。
description_zh: 通过 Browser.cash 启动不受拦截的浏览器会话，用于网页自动化。这些会话可绕过反爬虫防护机制（如 Cloudflare、DataDome 等），因此非常适合网络数据抓取与自动化任务。
homepage: https://browser.cash
metadata: {"clawdbot":{"emoji":"🌐","requires":{"bins":["curl","jq"]}}}
---
# browser-cash

通过 Browser.cash 启动不受拦截的浏览器会话，用于网页自动化。这些会话可绕过常见的反机器人防护机制（如 Cloudflare、DataDome 等），使其成为抓取、测试及自动化任务的理想选择——而此类任务在常规方式下通常会被拦截。

**适用场景：** 所有浏览器自动化任务，包括网页抓取、表单填写、功能测试、截图等。Browser.cash 会话表现为真实浏览器，并自动应对各类机器人检测机制。

## 配置

**API 密钥** 存储于 clawdbot 配置中，路径为 `⟦skills`.entries.browser-cash.apiKey⟧。

若尚未配置，请向用户提示：
> Get your API key from https://dash.browser.cash and run:
> ```bash
> clawdbot config set skills.entries.browser-cash.apiKey "your_key_here"
> ```

**读取密钥方法：**
```bash
BROWSER_CASH_KEY=$(clawdbot config get skills.entries.browser-cash.apiKey)
```

**首次使用前**，请检查并按需安装 Playwright：
```bash
if [ ! -d ~/clawd/node_modules/playwright ]; then
  cd ~/clawd && npm install playwright puppeteer-core
fi
```

## API 基础知识

```bash
curl -X POST "https://api.browser.cash/v1/..." \
  -H "Authorization: Bearer $BROWSER_CASH_KEY" \
  -H "Content-Type: application/json"
```

## 创建浏览器会话

**基础会话：**
```bash
curl -X POST "https://api.browser.cash/v1/browser/session" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**响应示例：**
```json
{
  "sessionId": "abc123...",
  "status": "active",
  "servedBy": "node-id",
  "createdAt": "2025-01-20T01:51:25.000Z",
  "stoppedAt": null,
  "cdpUrl": "wss://gcp-usc1-1.browser.cash/v1/consumer/abc123.../devtools/browser/uuid"
}
```

**带选项的会话：**
```bash
curl -X POST "https://api.browser.cash/v1/browser/session" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "windowSize": "1920x1080",
    "profile": {
      "name": "my-profile",
      "persist": true
    }
  }'
```

### 会话选项

| 选项 | 类型 | 描述 |
|------|------|------|
| `country` | 字符串 | 两位 ISO 国家代码（例如："US"、"DE"、"GB"） |
| `windowSize` | 字符串 | 浏览器窗口尺寸，例如 "1920x1080" |
| `proxyUrl` | 字符串 | SOCKS5 代理 URL（可选） |
| `profile.name` | 字符串 | 命名的浏览器配置文件，用于实现会话状态持久化 |
| `profile.persist` | 布尔值 | 会话结束后是否保存 Cookie 和存储数据 |

## 在 Clawdbot 中使用 Browser.cash

Browser.cash 返回一个 WebSocket CDP 地址（`wss://...`）。请采用以下任一方式接入：

### 方式 1：通过 exec 直接使用 CDP（推荐）

**重要提示：** 运行 Playwright/Puppeteer 脚本前，请确保已安装相关依赖：
```bash
[ -d ~/clawd/node_modules/playwright ] || (cd ~/clawd && npm install playwright puppeteer-core)
```

在 exec 代码块中使用 Playwright 或 Puppeteer，直接连接至该 CDP 地址：

```bash
# 1. Create session
BROWSER_CASH_KEY=$(clawdbot config get skills.entries.browser-cash.apiKey)
SESSION=$(curl -s -X POST "https://api.browser.cash/v1/browser/session" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY" \
  -H "Content-Type: application/json" \
  -d '{"country": "US", "windowSize": "1920x1080"}')

SESSION_ID=$(echo $SESSION | jq -r '.sessionId')
CDP_URL=$(echo $SESSION | jq -r '.cdpUrl')

# 2. Use via Node.js exec (Playwright)
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('$CDP_URL');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://example.com');
  console.log('Title:', await page.title());
  await browser.close();
})();
"

# 3. Stop session when done
curl -X DELETE "https://api.browser.cash/v1/browser/session?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

### 方式 2：基于 curl 的自动化

对于简单任务，可使用 curl 发送 CDP 命令与页面交互：

```bash
# Navigate and extract content using the CDP URL
# (See CDP protocol docs for available methods)
```

### 关于 Clawdbot 浏览器工具的说明

Clawdbot's native `browser` tool expects HTTP control server URLs, not raw WebSocket CDP. The `gateway config.patch` approach works when Clawdbot's browser control server proxies the connection. For direct Browser.cash CDP, use the exec approach above.

## 获取会话状态

```bash
curl "https://api.browser.cash/v1/browser/session?sessionId=YOUR_SESSION_ID" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

可能的状态值：`starting`、`active`、`completed`、`error`

## 终止会话

```bash
curl -X DELETE "https://api.browser.cash/v1/browser/session?sessionId=YOUR_SESSION_ID" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

## 列出所有会话

```bash
curl "https://api.browser.cash/v1/browser/sessions?page=1&pageSize=20" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

## 浏览器配置文件

配置文件可在多次会话间持久化保存 Cookie、localStorage 及会话数据，适用于保持登录态或维持应用状态。

**列出所有配置文件：**
```bash
curl "https://api.browser.cash/v1/browser/profiles" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

**删除指定配置文件：**
```bash
curl -X DELETE "https://api.browser.cash/v1/browser/profile?profileName=my-profile" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

## 通过 CDP 连接

`cdpUrl` 是 Chrome DevTools Protocol（CDP）的 WebSocket 终端地址。可配合任意兼容 CDP 的库使用。

**Playwright：**
```javascript
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const page = context.pages()[0] || await context.newPage();
await page.goto('https://example.com');
```

**Puppeteer：**
```javascript
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.connect({ browserWSEndpoint: cdpUrl });
const pages = await browser.pages();
const page = pages[0] || await browser.newPage();
await page.goto('https://example.com');
```

## 完整工作流示例

```bash
# 0. Ensure Playwright is installed
[ -d ~/clawd/node_modules/playwright ] || (cd ~/clawd && npm install playwright puppeteer-core)

# 1. Create session
BROWSER_CASH_KEY=$(clawdbot config get skills.entries.browser-cash.apiKey)
SESSION=$(curl -s -X POST "https://api.browser.cash/v1/browser/session" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY" \
  -H "Content-Type: application/json" \
  -d '{"country": "US", "windowSize": "1920x1080"}')

SESSION_ID=$(echo $SESSION | jq -r '.sessionId')
CDP_URL=$(echo $SESSION | jq -r '.cdpUrl')

# 2. Connect with Playwright/Puppeteer using $CDP_URL...

# 3. Stop session when done
curl -X DELETE "https://api.browser.cash/v1/browser/session?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $BROWSER_CASH_KEY"
```

## 抓取技巧

当从含懒加载或无限滚动的页面提取数据时：

```javascript
// Scroll to load all products
async function scrollToBottom(page) {
  let previousHeight = 0;
  while (true) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500); // Wait for content to load
  }
}

// Wait for specific elements
await page.waitForSelector('.product-card', { timeout: 10000 });

// Handle "Load More" buttons
const loadMore = await page.$('button.load-more');
if (loadMore) {
  await loadMore.click();
  await page.waitForTimeout(2000);
}
```

**常见实践：**
- 始终执行滚动操作以触发懒加载内容
- 等待网络空闲：`await page.waitForLoadState('networkidle')`
- 提取元素前调用 `page.waitForSelector()`
- 在操作之间添加延迟，避免触发频率限制

## 为何选用 Browser.cash 进行自动化

- **免拦截：** 会话可绕过 Cloudflare、DataDome、PerimeterX 等各类机器人防护机制
- **真实浏览器指纹：** 表现为真实的 Chrome 浏览器，而非无头模式
- **原生支持 CDP：** 提供直接 WebSocket 连接，兼容 Playwright、Puppeteer 或原始 CDP 调用
- **地理定位支持：** 可在指定国家/地区启动会话
- **配置文件持久化：** 跨会话维持登录状态

## 注意事项

- 会话将在长时间无操作后自动终止
- 使用完毕后务必手动停止会话，以避免产生不必要的资源消耗
- 如需维持登录态，请使用配置文件
- 当前仅支持 SOCKS5 类型代理
- Clawdbot 从 `~/clawd/` 目录运行脚本，请在此目录下安装 npm 依赖
- 对于整页抓取，请始终执行滚动操作以触发懒加载内容