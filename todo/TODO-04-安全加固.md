# TODO-04: 安全加固

**优先级**: P2  
**预估工时**: 2天  
**影响**: 安全性

## 问题清单

### 4.1 Setup Wizard 目录浏览路径限制

**位置**: `src/gateway/setup-wizard.ts` `handleBrowseDirectory` 函数  
**现状**: 允许浏览文件系统目录，虽有基本验证但缺少严格白名单。  
**实际风险**: 低。向导仅在首次配置时使用，本地运行，攻击面极小。  
**建议**:
- 限制浏览范围为用户主目录及其子目录
- 添加敏感目录黑名单（`/etc`, `C:\Windows` 等）

```typescript
const BLOCKED_PATHS = [
  '/etc', '/var', '/root', '/proc', '/sys',
  'C:\\Windows', 'C:\\Program Files',
];

function isPathAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  const home = os.homedir();
  // 必须在用户主目录下，或临时目录下
  if (!resolved.startsWith(home) && !resolved.startsWith(os.tmpdir())) {
    return false;
  }
  return !BLOCKED_PATHS.some(blocked =>
    resolved.toLowerCase().startsWith(blocked.toLowerCase())
  );
}
```

---

### 4.2 Query Parameter Token 弃用清理

**位置**: `src/gateway/server-http.ts:87-93`  
**现状**: Hook 端点仍支持 `?token=xxx` 方式传递 Token，已有弃用警告。  
**建议**:
- 在下个大版本中移除 query parameter 支持
- 当前版本：添加 `Deprecation` 和 `Sunset` 响应头

```typescript
if (fromQuery) {
  logHooks.warn("...");
  // 可选：添加标准弃用头
  // res.setHeader('Deprecation', 'true');
  // res.setHeader('Sunset', 'Wed, 01 Jul 2026 00:00:00 GMT');
}
```

---

### 4.3 License Key 格式校验

**位置**: `src/config/zod-schema.ts` license key 字段  
**现状**: 仅 `z.string().optional()`，无格式限制。  
**建议**:
- 添加最小长度（16位）
- 添加字符白名单

```typescript
key: z.string()
  .min(16, "授权码至少16位")
  .max(128, "授权码最多128位")
  .regex(/^[A-Za-z0-9_-]+$/, "授权码包含非法字符")
  .optional()
```

**注意**: 修改前需确认所有现有 key 格式都符合新规则。

---

### 4.4 头像路径验证 Windows 边界

**位置**: `src/config/validation.ts:51-56`  
**现状**: Windows 绝对路径检测可能遗漏 UNC 路径 (`\\server\share`)。  
**建议**: 使用 `path.isAbsolute()` 替代自定义正则。

## 验收标准

- [ ] 目录浏览限制在安全范围内
- [ ] License key 有格式校验
- [ ] 头像路径覆盖 UNC 路径
- [ ] 所有修改有对应测试用例
