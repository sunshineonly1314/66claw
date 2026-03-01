---
name: browser-ladder
name_zh: 浏览器梯子
version: 1.0.0
description: 攀登浏览器阶梯——从免费起步，仅在必要时升级。L1（fetch）→ L2（本地 Playwright）→ L3（BrowserCat）→ L4（Browserless.io，用于 CAPTCHA/机器人绕过）。
description_zh: 攀登浏览器阶梯——从免费起步，仅在必要时升级。L1（fetch）→ L2（本地 Playwright）→ L3（BrowserCat）→ L4（Browserless.io，用于 CAPTCHA/机器人绕过）。
metadata:
  clawdbot:
    emoji: "🪜"
    requires:
      bins:
        - node
        - docker
    env:
      - name: BROWSERCAT_API_KEY
        description: BrowserCat API 密钥（免费版）——获取地址：https://browsercat.com
        required: false
      - name: BROWSERLESS_TOKEN
        description: Browserless.io 令牌（$10/月）——获取地址：https://browserless.io
        required: false
---
# 浏览器阶梯 🪜

仅在需要时，才从免费方案升级至付费方案。

## 快速设置

安装后运行初始化脚本：
```bash
./skills/browser-ladder/scripts/setup.sh
```

或手动添加到您的 `.env`：
```bash
# Optional - only needed for Rungs 3-4
BROWSERCAT_API_KEY=your-key    # Free: https://browsercat.com
BROWSERLESS_TOKEN=your-token   # Paid: https://browserless.io
```

## 阶梯层级

```
┌─────────────────────────────────────────────┐
│  🪜 Rung 4: Browserless.io (Cloud Paid)     │
│  • CAPTCHA solving, bot detection bypass    │
│  • Cost: $10+/mo                            │
│  • Requires: BROWSERLESS_TOKEN              │
├─────────────────────────────────────────────┤
│  🪜 Rung 3: BrowserCat (Cloud Free)         │
│  • When local Docker fails                  │
│  • Cost: FREE (limited)                     │
│  • Requires: BROWSERCAT_API_KEY             │
├─────────────────────────────────────────────┤
│  🪜 Rung 2: Playwright Docker (Local)       │
│  • JavaScript rendering, screenshots        │
│  • Cost: FREE (CPU only)                    │
│  • Requires: Docker installed               │
├─────────────────────────────────────────────┤
│  🪜 Rung 1: web_fetch (No browser)          │
│  • Static pages, APIs, simple HTML          │
│  • Cost: FREE                               │
│  • Requires: Nothing                        │
└─────────────────────────────────────────────┘

Start at the bottom. Climb only when needed.
```

## 何时升级？

| 场景 | 阶层 | 原因 |
|------|------|------|
| 静态 HTML、API | 1 | 无需 JavaScript |
| React/Vue/单页应用（SPA） | 2 | 需要 JavaScript 渲染 |
| Docker 不可用 | 3 | 云服务备用方案 |
| CAPTCHA / Cloudflare 防护 | 4 | 需绕过机器人检测 |
| OAuth / 多因素认证（MFA）流程 | 4 | 认证逻辑复杂 |

## 决策流程

```
Need to access a URL
         │
         ▼
    Static content? ──YES──▶ Rung 1 (web_fetch)
         │ NO
         ▼
    JS rendering only? ──YES──▶ Rung 2 (Playwright Docker)
         │ NO                        │
         │                     Success? ──NO──▶ Rung 3
         ▼                           │ YES
    CAPTCHA/bot detection? ────────────────────▶ DONE
         │ YES
         ▼
    Rung 4 (Browserless.io) ──▶ DONE
```

## 使用示例

### 第 1 层：静态内容
```javascript
// Built into Clawdbot
const content = await web_fetch("https://example.com");
```

### 第 2 层：JavaScript 渲染页面
```bash
docker run --rm -v /tmp:/output mcr.microsoft.com/playwright:v1.58.0-jammy \
  npx playwright screenshot https://spa-app.com /output/shot.png
```

### 第 3 层：云浏览器（BrowserCat）
```javascript
const { chromium } = require('playwright');
const browser = await chromium.connect('wss://api.browsercat.com/connect', {
  headers: { 'Api-Key': process.env.BROWSERCAT_API_KEY }
});
```

### 第 4 层：CAPTCHA 绕过（Browserless）
```javascript
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP(
  `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`
);
// CAPTCHA handled automatically
```

## 成本优化策略

1. **从低层起步** — 始终优先尝试第 1 层  
2. **缓存结果** — 避免不必要的重复抓取  
3. **批量请求** — 单个浏览器会话中加载多个页面  
4. **验证成功率** — 仅当较低层级失败时再升级  

## 获取您的密钥

| 服务 | 费用 | 注册地址 |
|------|------|----------|
| BrowserCat | 免费版可用 | https://browsercat.com |
| Browserless.io | $10+/月 | https://browserless.io |

二者均为可选 — 第 1–2 层无需任何 API 密钥即可运行。