---
name: verify-on-browser
description: 通过 Chrome DevTools 协议 (CDP) 控制浏览器——完全的 CDP 访问能力
description_zh: 通过 Chrome DevTools 协议 (CDP) 控制浏览器——完全的 CDP 访问能力
name_zh: 浏览器验证
---
# 浏览器控制 skill

使用 `browser` MCP 服务器，以完全的 CDP 访问能力控制浏览器。核心 `cdp_send` 工具可调用任意 Chrome DevTools 协议方法。

## 可用工具

### `cdp_send` — 原始 CDP 访问
直接调用任意 CDP 方法：
```
cdp_send(method: "Domain.method", params: {...})
```

### `screenshot` — 捕获页面
```
screenshot(format: "png"|"jpeg", fullPage: true|false)
```

### `get_url` — 当前 URL
```
get_url()
```

### `close_browser` — 关闭浏览器
```
close_browser()
```

## 常见 CDP 操作

### 导航
```javascript
// Navigate to URL
cdp_send(method: "Page.navigate", params: { url: "https://example.com" })

// Reload
cdp_send(method: "Page.reload")

// Go back/forward
cdp_send(method: "Page.navigateToHistoryEntry", params: { entryId: 1 })
```

### DOM 操作
```javascript
// Get document root
cdp_send(method: "DOM.getDocument")

// Query selector (needs nodeId from getDocument)
cdp_send(method: "DOM.querySelector", params: { nodeId: 1, selector: "h1" })

// Get outer HTML
cdp_send(method: "DOM.getOuterHTML", params: { nodeId: 5 })

// Set attribute
cdp_send(method: "DOM.setAttributeValue", params: { nodeId: 5, name: "class", value: "new-class" })
```

### JavaScript 执行
```javascript
// Evaluate expression
cdp_send(method: "Runtime.evaluate", params: { expression: "document.title" })

// Evaluate with return value
cdp_send(method: "Runtime.evaluate", params: {
  expression: "document.querySelectorAll('a').length",
  returnByValue: true
})

// Call function on object
cdp_send(method: "Runtime.callFunctionOn", params: {
  objectId: "...",
  functionDeclaration: "function() { return this.innerText; }"
})
```

### 网络
```javascript
// Enable network tracking (required first)
cdp_send(method: "Network.enable")

// Set cookies
cdp_send(method: "Network.setCookie", params: {
  name: "session",
  value: "abc123",
  domain: ".example.com"
})

// Get cookies
cdp_send(method: "Network.getCookies")

// Clear cache
cdp_send(method: "Network.clearBrowserCache")

// Set extra headers
cdp_send(method: "Network.setExtraHTTPHeaders", params: {
  headers: { "X-Custom": "value" }
})

// Block URLs
cdp_send(method: "Network.setBlockedURLs", params: { urls: ["*.ads.com"] })
```

### 输入模拟
```javascript
// Click (dispatch mouse event)
cdp_send(method: "Input.dispatchMouseEvent", params: {
  type: "mousePressed",
  x: 100,
  y: 200,
  button: "left",
  clickCount: 1
})

// Type text
cdp_send(method: "Input.insertText", params: { text: "Hello world" })

// Key press
cdp_send(method: "Input.dispatchKeyEvent", params: {
  type: "keyDown",
  key: "Enter"
})
```

### 模拟
```javascript
// Set viewport
cdp_send(method: "Emulation.setDeviceMetricsOverride", params: {
  width: 375,
  height: 812,
  deviceScaleFactor: 3,
  mobile: true
})

// Set geolocation
cdp_send(method: "Emulation.setGeolocationOverride", params: {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 100
})

// Set timezone
cdp_send(method: "Emulation.setTimezoneOverride", params: { timezoneId: "America/New_York" })
```

### 性能与调试
```javascript
// Enable performance metrics
cdp_send(method: "Performance.enable")

// Get metrics
cdp_send(method: "Performance.getMetrics")

// Start profiler
cdp_send(method: "Profiler.start")

// Stop and get profile
cdp_send(method: "Profiler.stop")

// Enable debugger
cdp_send(method: "Debugger.enable")

// Set breakpoint
cdp_send(method: "Debugger.setBreakpointByUrl", params: {
  lineNumber: 10,
  url: "https://example.com/script.js"
})
```

### 存储
```javascript
// Get local storage
cdp_send(method: "DOMStorage.getDOMStorageItems", params: {
  storageId: { securityOrigin: "https://example.com", isLocalStorage: true }
})

// Clear storage
cdp_send(method: "Storage.clearDataForOrigin", params: {
  origin: "https://example.com",
  storageTypes: "all"
})
```

## CDP 协议参考

获取所有域（domains）和方法的完整列表，请访问：
https://chromedevtools.github.io/devtools-protocol/

常用域（domains）：
- **Page** — 导航、生命周期管理、PDF 生成
- **DOM** — 文档结构操作
- **CSS** — 样式表操作
- **Runtime** — JavaScript 执行
- **Network** — 请求/响应拦截
- **Input** — 键盘/鼠标模拟
- **Emulation** — 设备/视口模拟
- **Debugger** — JavaScript 调试
- **Performance** — 性能指标
- **Storage** — localStorage、IndexedDB、cookies