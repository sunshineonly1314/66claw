---
name: anti-detect-browser
description: "Stealth browser automation that bypasses bot detection and anti-scraping mechanisms. Uses techniques like fingerprint randomization, human-like behavior simulation, and request throttling. Use when the user encounters CAPTCHAs, Cloudflare challenges, anti-bot blocks, or needs to scrape sites with aggressive bot detection."
nameZh: "反爬虫浏览器"
descriptionZh: "使用操作系统级别的输入来控制一个能够躲避机器人检测的隐蔽浏览器"
metadata: {"openclawcn":{"emoji":"🕵️"}}
---

# 反爬虫浏览器 (Anti-Detect Browser)

使用操作系统级别的输入控制来规避网站机器人检测。结合 `browser` 工具和 `desktop_control` 工具，模拟真实用户行为。

## 触发场景

- "这个网站有反爬，帮我绕过"
- "被 Cloudflare 拦截了"
- "遇到验证码了"
- "用真实浏览器帮我操作"

## 策略层级

### Level 1: browser 工具 + 宿主浏览器（推荐）

使用 `target: "host"` 复用用户已有浏览器，利用已有的 cookies、登录态和浏览器指纹:

```
browser({action: "start", target: "host"})
browser({action: "navigate", targetUrl: "https://target-site.com"})
browser({action: "act", request: {kind: "wait", timeMs: 3000}})
browser({action: "screenshot"})  -- 检查是否被拦截
```

### Level 2: 模拟人类行为

如果被检测，切换为模拟人类操作模式:

**随机延迟**（不要用固定间隔）:
```
browser({action: "act", request: {kind: "wait", timeMs: 1500}})  -- 1-3秒随机
```

**逐字输入**（不要一次性粘贴）:
```
-- 不要这样:
browser({action: "act", request: {kind: "type", text: "完整长文本", ref: "inputRef"}})

-- 应该分段输入，中间加短暂停顿
browser({action: "act", request: {kind: "type", text: "关键", ref: "inputRef"}})
browser({action: "act", request: {kind: "wait", timeMs: 200}})
browser({action: "act", request: {kind: "type", text: "词搜索", ref: "inputRef"}})
```

**自然滚动**（不要瞬移到底部）:
```
browser({action: "act", request: {kind: "evaluate", fn: "window.scrollBy(0, 300)"}})
browser({action: "act", request: {kind: "wait", timeMs: 800}})
browser({action: "act", request: {kind: "evaluate", fn: "window.scrollBy(0, 250)"}})
browser({action: "act", request: {kind: "wait", timeMs: 600}})
```

**鼠标轨迹模拟**（通过 desktop_control）:
```
desktop_control({action: "click", x: 500, y: 300})
-- 然后缓慢移动到目标位置
desktop_control({action: "click", x: 520, y: 310})
desktop_control({action: "click", x: 550, y: 340})
desktop_control({action: "click", x: 600, y: 400})  -- 最终目标
```

### Level 3: desktop_control 全接管

当 browser 工具完全被检测时，降级为 desktop_control 直接操控桌面浏览器:

```
-- 1. 打开系统浏览器
open_app({name: "Chrome"})

-- 2. 等待浏览器启动
desktop_control({action: "screenshot"})

-- 3. 在地址栏输入 URL
desktop_control({action: "key", keys: "ctrl+l"})
desktop_control({action: "type", text: "https://target-site.com"})
desktop_control({action: "key", keys: "enter"})

-- 4. 等待页面加载
desktop_control({action: "screenshot"})

-- 5. 通过视觉识别+坐标点击操作页面
desktop_control({action: "click", x: 400, y: 500})
```

## 验证码处理

### 自动可解决的

**简单点击验证**（"我不是机器人"）:
```
browser({action: "snapshot"})  -- 找到 checkbox
browser({action: "act", request: {kind: "click", ref: "checkboxRef"}})
browser({action: "act", request: {kind: "wait", timeMs: 3000}})
browser({action: "screenshot"})  -- 验证是否通过
```

### 需要用户介入的

**图形验证码 / 滑块验证**:
```
提示用户: "检测到验证码，请在浏览器窗口中手动完成验证，完成后告诉我。"
-- 等待用户确认
browser({action: "screenshot"})  -- 验证已通过
```

## Cloudflare 挑战处理

1. 检测到 Cloudflare 等待页面（"Checking your browser..."）:
```
browser({action: "act", request: {kind: "wait", timeMs: 8000}})  -- 等待 JS challenge 完成
browser({action: "screenshot"})  -- 检查是否通过
```

2. 如果还是被拦截:
```
-- 切换到 desktop_control 模式
-- 或提示用户手动在浏览器中访问，然后接管已通过验证的页面
```

## 请求节流

避免触发频率限制:

| 操作类型 | 最小间隔 |
|----------|----------|
| 页面导航 | 3-5 秒 |
| 页面内点击 | 1-2 秒 |
| 滚动操作 | 0.5-1 秒 |
| 表单输入 | 0.2-0.5 秒/字段 |
| API 请求 | 2-3 秒 |

## 注意事项

- **合法使用**: 仅用于用户授权的数据获取，遵守目标网站 robots.txt 和 ToS
- **隐私保护**: 不保存或泄露用户的浏览器 cookies 和登录信息
- **降级策略**: browser → desktop_control → 提示用户手动操作
- **失败处理**: 如所有策略都失败，建议用户直接在浏览器中手动操作并复制内容
