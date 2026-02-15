# TODO-06: 前端 UI 改进

**优先级**: P2  
**预估工时**: 2-3天  
**影响**: 前端健壮性、用户体验

## 问题清单

### 6.1 localStorage 操作添加错误保护

**位置**: `ui/src/ui/app.ts` 及多处  
**现状**: 多处直接调用 `localStorage.getItem/setItem`，无 try-catch。  
**风险**: 隐私模式、存储满、Safari 私密浏览下抛异常。  
**建议**: 创建统一的安全包装函数。

```typescript
// ui/src/ui/storage-safe.ts
export function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
export function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
```

---

### 6.2 Clipboard API 兼容性处理

**位置**: `ui/src/ui/views/overview.ts:836-840`  
**现状**: 直接使用 `navigator.clipboard.writeText()` 无 fallback。  
**风险**: HTTP 环境、旧浏览器、用户拒绝权限时失败。  
**建议**: 添加 `document.execCommand('copy')` 回退。

---

### 6.3 URL 中会话密钥安全

**位置**: `ui/src/ui/app-settings.ts:64-116`  
**现状**: 会话密钥通过 URL 查询参数传递。  
**风险**: 会出现在浏览器历史、服务器日志、Referrer 头中。  
**建议**:
- 使用 URL fragment (#) 替代查询参数
- 或使用 sessionStorage 存储

---

### 6.4 配置编辑器 JSON 解析保护

**位置**: `ui/src/ui/views/config.ts:185`  
**现状**: 用户在 Raw JSON 模式下输入无效 JSON 时可能报错。  
**建议**: 添加实时 JSON 验证，保存前校验并显示行号错误提示。

---

### 6.5 消息历史截断提示

**位置**: `ui/src/ui/views/chat.ts:473`  
**现状**: 聊天界面限制 80 条消息，超出直接截断。  
**建议**: 在列表顶部添加 "已显示最近 80 条消息" 提示。

---

### 6.6 平台检测改用现代 API

**位置**: `ui/src/ui/views/skills.ts:14-19`  
**现状**: 使用 `navigator.userAgent` 检测平台。  
**建议**: 优先使用 `navigator.userAgentData.platform`（如可用），回退到 `navigator.platform`。

---

### 6.7 主应用状态管理重构

**位置**: `ui/src/ui/app.ts`  
**现状**: 50+ 响应式属性集中在一个组件。  
**建议**: 长期目标，拆分为多个状态管理器（ChatState, ConfigState 等），使用 Lit Context 注入。

## 验收标准

- [ ] localStorage 操作有统一的安全包装
- [ ] Clipboard API 有 fallback
- [ ] JSON 编辑器保存前有校验
- [ ] 消息截断有用户提示
