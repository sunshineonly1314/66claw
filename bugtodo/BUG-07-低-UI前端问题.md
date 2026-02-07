# BUG-07: UI 前端问题 [低]

## Bug 7.1: localStorage 操作无错误处理

**位置**: `ui/src/ui/app.ts:926` (及多处)  
**严重度**: 低  
**类型**: 错误处理  

**问题描述**:
多处 `localStorage` 读写操作没有 try-catch 保护。在隐私模式或存储空间满时会抛出异常。

**修复建议**:
```typescript
// 创建安全的 localStorage 包装
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Failed to save to localStorage: ${key}`, err);
  }
}
```

---

## Bug 7.2: Clipboard API 无错误处理

**位置**: `ui/src/ui/views/overview.ts:836-840`  
**严重度**: 低  
**类型**: 错误处理  

**问题描述**:
使用 `navigator.clipboard.writeText()` 时没有 try-catch。在非安全上下文（HTTP，非 HTTPS）或用户拒绝权限时会失败。

**修复建议**:
```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 回退到旧方法
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      console.warn('Failed to copy to clipboard');
      return false;
    }
  }
}
```

---

## Bug 7.3: URL 参数中的会话密钥安全风险

**位置**: `ui/src/ui/app-settings.ts:64-116`  
**严重度**: 低  
**类型**: 安全风险  

**问题描述**:
会话密钥（session key）通过 URL 参数传递。URL 参数会出现在：
- 浏览器历史记录
- 服务器访问日志
- Referrer 头

**修复建议**:
```typescript
// 使用 URL fragment (#) 代替查询参数 (?)
// Fragment 不会发送到服务器
function getSessionKeyFromUrl(): string | null {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.substring(1));
  return params.get('session');
}

// 或使用 sessionStorage
function storeSessionKey(key: string): void {
  sessionStorage.setItem('clawdbot_session', key);
}
```

---

## Bug 7.4: 用户代理嗅探不可靠

**位置**: `ui/src/ui/views/skills.ts:14-19`  
**严重度**: 低  
**类型**: 可靠性  

**问题描述**:
使用 `navigator.userAgent` 检测平台兼容性，但 User-Agent 可以被修改或伪造。

**修复建议**:
```typescript
// 使用 navigator.platform 和 navigator.userAgentData（如可用）
function detectPlatform(): "windows" | "macos" | "linux" | "unknown" {
  // 优先使用新 API
  if ('userAgentData' in navigator) {
    const platform = (navigator as any).userAgentData.platform;
    if (platform === 'Windows') return 'windows';
    if (platform === 'macOS') return 'macos';
    if (platform === 'Linux') return 'linux';
  }
  
  // 回退到 navigator.platform
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  
  return 'unknown';
}
```

---

## Bug 7.5: 配置编辑器 JSON 解析无保护

**位置**: `ui/src/ui/views/config.ts:185`  
**严重度**: 低  
**类型**: 错误处理  

**问题描述**:
用户在原始 JSON 编辑模式下输入无效 JSON 时，`JSON.parse` 可能抛出异常。

**修复建议**:
```typescript
function parseConfigJson(jsonStr: string): { config: object | null; error: string | null } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== 'object' || parsed === null) {
      return { config: null, error: "配置必须是 JSON 对象" };
    }
    return { config: parsed, error: null };
  } catch (err) {
    const message = err instanceof SyntaxError ? err.message : "JSON 格式错误";
    return { config: null, error: message };
  }
}

// 在保存时使用
const { config, error } = parseConfigJson(rawJsonValue);
if (error) {
  showError(`配置 JSON 格式错误: ${error}`);
  return;
}
```

---

## Bug 7.6: Markdown 缓存大小可能过大

**位置**: `ui/src/ui/markdown.ts:83-86`  
**严重度**: 低  
**类型**: 性能  

**问题描述**:
Markdown 渲染缓存有大小限制，但对于长聊天会话，缓存可能存储大量 HTML 内容。

**修复建议**:
```typescript
// 使用基于内存大小的缓存限制
class MarkdownCache {
  private cache = new Map<string, string>();
  private totalSize = 0;
  private readonly maxSize = 5 * 1024 * 1024; // 5MB
  private readonly maxEntries = 500;

  set(key: string, value: string): void {
    // 超过限制时清理
    while (this.totalSize + value.length > this.maxSize || this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      const oldValue = this.cache.get(firstKey)!;
      this.totalSize -= oldValue.length;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
    this.totalSize += value.length;
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }
}
```

---

## Bug 7.7: 组件状态过多导致维护困难

**位置**: `ui/src/ui/app.ts`  
**严重度**: 低  
**类型**: 架构  

**问题描述**:
主应用组件 `app.ts` 包含 50+ 响应式状态属性，违反单一职责原则。

**修复建议**:
```typescript
// 将状态拆分为多个状态管理器
class ChatState { ... }
class ConfigState { ... }
class LicenseState { ... }
class NavigationState { ... }

// 使用 Lit Context 注入
@provide({ context: chatContext })
chatState = new ChatState();

@provide({ context: configContext })
configState = new ConfigState();
```
