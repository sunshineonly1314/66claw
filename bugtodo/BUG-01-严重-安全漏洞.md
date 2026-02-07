# BUG-01: 安全漏洞汇总 [严重]

## Bug 1.1: Setup Wizard 路径遍历风险

**位置**: `src/gateway/setup-wizard.ts:720-806`  
**严重度**: 高  
**类型**: 安全漏洞  

**问题描述**:
`handleBrowseDirectory` 函数允许浏览文件系统目录。虽然有路径验证，但缺少严格的白名单机制，可能允许访问敏感系统目录。

**影响**:
- 信息泄露：用户可浏览系统敏感目录结构
- 文件枚举：可枚举系统中存在的文件和目录

**修复建议**:
```typescript
// 添加严格的目录白名单
const ALLOWED_BASE_DIRS = [
  os.homedir(),
  os.tmpdir(),
  '/workspace',
];

function isAllowedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return ALLOWED_BASE_DIRS.some(base => 
    resolved.startsWith(path.resolve(base))
  );
}

// 在 handleBrowseDirectory 开始处添加检查
if (!isAllowedPath(requestedPath)) {
  return sendJson(res, { ok: false, error: "访问被拒绝" });
}
```

---

## Bug 1.2: 已弃用的 Query Parameter Token 仍可用

**位置**: `src/gateway/server-http.ts:87-93`  
**严重度**: 中  
**类型**: 安全风险  

**问题描述**:
已标记为弃用的 URL 查询参数 Token 认证方式仍然可以使用。Token 出现在 URL 中会被记录在访问日志、浏览器历史和 Referrer 头中。

**影响**:
- Token 泄露风险
- 日志中的敏感信息

**修复建议**:
```typescript
// 选项1：完全移除 query parameter 支持
// 选项2：添加弃用警告并设置移除日期
if (tokenFromQuery) {
  log.warn("Query parameter token authentication is deprecated and will be removed in v2026.4.0. Use Bearer token in Authorization header instead.");
  // 可选：设置 Deprecation header
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2026-04-01');
}
```

---

## Bug 1.3: 授权码格式验证缺失

**位置**: `src/config/zod-schema.ts:42-59`  
**严重度**: 中  
**类型**: 验证不足  

**问题描述**:
License key 在 Zod Schema 中仅验证为 `z.string().optional()`，没有格式验证。任意字符串都能通过验证。

**影响**:
- 无效的 key 可能被存储到配置
- 增加服务端验证负担

**修复建议**:
```typescript
// 添加格式验证
key: z.string()
  .min(16, "授权码至少16位")
  .max(128, "授权码最多128位")
  .regex(/^[A-Za-z0-9_-]+$/, "授权码格式不正确")
  .optional()
```

---

## Bug 1.4: DNS IPv4 强制全局影响

**位置**: `src/license/verify.ts:35`  
**严重度**: 低  
**类型**: 副作用  

**问题描述**:
```typescript
dns.setDefaultResultOrder("ipv4first");
```
这个调用在模块加载时全局设置 DNS 解析优先级，影响整个 Node.js 进程中所有的 DNS 解析，不仅限于授权验证模块。

**影响**:
- 可能影响其他需要 IPv6 的模块
- 全局副作用难以追踪

**修复建议**:
```typescript
// 仅在需要时设置，或使用 per-request 方式
async function sendRequest<T>(...) {
  const agent = new http.Agent({
    family: 4, // 仅此请求使用 IPv4
  });
  // ...
}
```

---

## Bug 1.5: 头像路径验证 Windows 边界情况

**位置**: `src/config/validation.ts:51-56`  
**严重度**: 低  
**类型**: 验证不完整  

**问题描述**:
Windows 绝对路径检测使用正则 `WINDOWS_ABS_RE`，但可能无法覆盖所有 Windows 路径格式（如 UNC 路径 `\\server\share`）。

**修复建议**:
```typescript
const WINDOWS_ABS_RE = /^[A-Za-z]:\\/;
const UNC_PATH_RE = /^\\\\/;

function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p) || WINDOWS_ABS_RE.test(p) || UNC_PATH_RE.test(p);
}
```
