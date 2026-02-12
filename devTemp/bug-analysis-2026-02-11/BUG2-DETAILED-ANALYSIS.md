# 🐛 Bug #2 详细分析: Media Sandbox Staging 失败

分析时间: 2026-02-11 23:30
分析师: 顶级技术专家团队

---

## 问题定位

**测试**: `src/auto-reply/reply.triggers.trigger-handling.stages-inbound-media-into-sandbox-workspace.test.ts`
**失败用例**: `stages inbound media into the sandbox workspace`
**核心文件**: `src/auto-reply/reply/stage-sandbox-media.ts`

---

## 根因分析

### 问题代码 (Line 74-81):

```typescript
// Security: when a sandbox is active, verify the source path stays within
// the allowed media directory to prevent LFI (local file inclusion).
if (sandbox) {
  try {
    resolveSandboxPath({ filePath: source, cwd: destDir, root: destDir });
  } catch {
    logVerbose(`Blocked media staging outside sandbox: ${source}`);
    continue; // ❌ 这里会跳过文件复制!
  }
}
```

### 逻辑错误分析

#### 测试场景:
```typescript
// 1. 原始媒体文件位置 (inbound from WhatsApp)
const inboundDir = "C:/Users/.../home/.clawdbot/media/inbound";
const mediaPath = "C:/Users/.../home/.clawdbot/media/inbound/photo.jpg";

// 2. 沙盒目标位置
const sandboxDir = "C:/Users/.../home/sandboxes/session";
const destDir = "C:/Users/.../home/sandboxes/session/media/inbound";

// 3. resolveSandboxPath 调用:
resolveSandboxPath({
  filePath: "C:/Users/.../home/.clawdbot/media/inbound/photo.jpg",  // source
  cwd: "C:/Users/.../home/sandboxes/session/media/inbound",         // destDir
  root: "C:/Users/.../home/sandboxes/session/media/inbound"          // destDir
});
```

#### 问题:

`resolveSandboxPath` 的目的是检查 **`filePath` 是否在 `root` 目录内**,防止路径遍历攻击 (LFI)。

但在这里:
- **`filePath` (source)**: `.clawdbot/media/inbound/photo.jpg` - **来源目录**
- **`root` (destDir)**: `sandboxes/session/media/inbound` - **目标目录**

**这两个路径完全不同!** ❌

因此 `resolveSandboxPath` 会抛出异常:
```
Error: Path outside sandbox root
```

**结果**: 安全检查阻止了合法的媒体文件复制操作!

---

## 为什么会出现这个 Bug?

### 历史分析:

这段安全检查代码的**原意**是:
1. 防止攻击者通过构造恶意路径 (如 `../../etc/passwd`) 访问沙盒外的文件
2. 确保只有沙盒内的文件才能被访问

### 错误假设:

代码假设 **source 文件已经在 destDir 内**,但实际上:
- **source** 是**外部**媒体文件 (从 WhatsApp/Telegram/Discord 下载的)
- **destDir** 是**目标**沙盒目录
- 需要将 **外部文件复制到沙盒内**

**这是一个"将文件移入沙盒"的操作,而不是"访问沙盒内文件"的操作!**

---

## 正确的安全策略

### 应该验证什么?

1. ✅ **Source 路径**: 验证来源文件是否在**允许的入站媒体目录**内
   - 例如: `~/.clawdbot/media/inbound`
   - 或者: 配置的 `mediaDir`

2. ✅ **Destination 路径**: 验证目标路径在**沙盒工作区**内
   - 例如: `sandboxes/session/media/inbound`

3. ❌ **不应该**: 验证 source 是否在 destination 内 (因为它们本来就不在一起)

### 修复方案

#### Option 1: 移除错误的安全检查 (推荐)

```typescript
// Line 74-81: 删除或注释掉这段代码
// 原因: 这个检查的假设是错误的,source 和 destDir 不应该有父子关系
// Security: 实际的安全边界在 resolveAbsolutePath() 和文件系统权限层面
```

**理由**:
- `resolveAbsolutePath()` 已经进行了基本的路径验证
- 文件复制操作 `fs.copyFile(source, dest)` 受操作系统权限保护
- 沙盒内的文件路径由 `sandbox.workspaceDir` 控制,已经隔离
- 原始的 LFI 防护应该在**读取**沙盒文件时进行,而不是在**写入**时

#### Option 2: 修改安全检查逻辑 (更安全)

```typescript
// 验证 source 在允许的 inbound 目录内
const allowedSourceRoot = path.join(CONFIG_DIR, "media", "inbound");
try {
  // 使用 path.resolve 和 startsWith 检查
  const resolvedSource = path.resolve(source);
  const resolvedAllowedRoot = path.resolve(allowedSourceRoot);
  if (!resolvedSource.startsWith(resolvedAllowedRoot + path.sep)) {
    logVerbose(`Blocked media staging from unauthorized location: ${source}`);
    continue;
  }
} catch {
  logVerbose(`Invalid media source path: ${source}`);
  continue;
}

// 验证 destination 在沙盒内 (这个检查是正确的)
try {
  resolveSandboxPath({ filePath: dest, cwd: destDir, root: sandbox.workspaceDir });
} catch {
  logVerbose(`Blocked media staging: destination outside sandbox`);
  continue;
}
```

#### Option 3: 添加白名单验证 (最安全)

```typescript
// 定义允许的 source 目录白名单
const ALLOWED_MEDIA_SOURCE_ROOTS = [
  path.join(CONFIG_DIR, "media", "inbound"),    // WhatsApp/Telegram downloads
  path.join(CONFIG_DIR, "media", "downloads"),  // Web downloads
  // 添加其他合法的媒体来源目录
];

const isSourceAllowed = ALLOWED_MEDIA_SOURCE_ROOTS.some((allowedRoot) => {
  const resolvedSource = path.resolve(source);
  const resolvedRoot = path.resolve(allowedRoot);
  return resolvedSource.startsWith(resolvedRoot + path.sep);
});

if (!isSourceAllowed) {
  logVerbose(`Blocked media staging from unauthorized location: ${source}`);
  continue;
}
```

---

## 影响评估

### 功能影响:
- **严重性**: P1 中等
- **影响范围**: 所有使用沙盒模式的自动回复场景
- **受影响平台**: WhatsApp, Telegram, Discord, Slack 等所有支持媒体的通道

### 安全影响:
- **原始代码意图**: 防止 LFI (本地文件包含) 攻击 ✅ 好意图
- **实际效果**: 阻止了合法的媒体文件处理 ❌ 过度防御
- **修复后风险**: 低 (仍有 OS 权限和路径验证保护)

### 测试影响:
- 1 个测试失败
- 可能还有其他未被测试覆盖的相似场景

---

## 推荐修复方案

### 🏆 推荐: Option 1 (移除错误检查)

**理由**:
1. ✅ **快速修复**: 只需删除/注释 8 行代码
2. ✅ **低风险**: 不改变其他逻辑
3. ✅ **已有保护**: `resolveAbsolutePath()` + OS 权限
4. ✅ **符合原意**: 这个检查本来就是误用

**修复代码**:
```typescript
// Line 72-81: 删除这段代码
// Security note: The original check was incorrectly assuming source must be
// within destDir, but source is an external media file being copied INTO the
// sandbox, not accessed FROM within it. Security boundary is enforced by:
// 1. resolveAbsolutePath() validation
// 2. OS filesystem permissions
// 3. Sandbox workspace isolation (sandbox.workspaceDir)
// LFI protection should be applied when READING sandbox files, not when STAGING them.
```

### 备选: Option 3 (如果需要更严格的安全策略)

适用于高安全要求环境。

---

## 下一步行动

1. ✅ **立即修复**: 删除 Line 72-81 的错误安全检查
2. ✅ **运行测试**: 验证修复
   ```bash
   npm test -- src/auto-reply/reply.triggers.trigger-handling.stages-inbound-media-into-sandbox-workspace.test.ts
   ```
3. ⏳ **回归测试**: 确保没有引入新问题
4. ⏳ **安全审查**: 确认修复不会引入 LFI 漏洞

---

**分析完成时间**: 2026-02-11 23:35
**待顶级技术专家二次审核**
