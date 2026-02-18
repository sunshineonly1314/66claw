# OpenClawCN 问题追踪清单

**生成时间**: 2026-02-17
**基于审查**: 2026-02-16代码审查
**总问题数**: 119个 (18 Critical, 36 High, 50 Medium, 15 Low)

---

## 使用说明

本清单可以直接用于创建GitHub Issues。建议按以下步骤操作:

1. **立即创建所有Critical Issues** (18个) - 标记为P0
2. **本周创建所有High Issues** (36个) - 标记为P1
3. **逐步创建Medium Issues** (50个) - 标记为P2
4. **按需创建Low Issues** (15个) - 标记为P3

每个Issue建议添加标签:
- 严重程度: `P0-critical`, `P1-high`, `P2-medium`, `P3-low`
- 类型: `security`, `bug`, `performance`, `tech-debt`
- 模块: `core`, `extensions`, `macos`, `ios`, `build`

---

## 🔴 Critical Issues (P0 - 立即修复)

### 核心模块 Critical (8个)

#### [ ] Issue #1: 命令执行 PATH 劫持安全漏洞
**标签**: `P0-critical`, `security`, `core`
**文件**: `src/agents/bash-tools.exec.ts:314-330`

**描述**:
允许通过配置文件注入恶意 PATH 路径,可导致二进制劫持攻击。虽然代码调用了 `validateHostEnv`,但 `defaultPathPrepend` 来自配置,可以绕过验证直接修改 PATH。

**影响**:
- 攻击者可通过配置文件注入恶意 PATH 路径
- 可能导致二进制劫持攻击(binary hijacking)
- 影响 gateway 和 sandbox 模式的命令执行安全
- CVSSv3: 8.1 (High)

**修复建议**:
```typescript
// 在 gateway 模式下禁止 pathPrepend
if (host === "gateway" && defaultPathPrepend.length > 0) {
  throw new Error(
    "Security Violation: tools.exec.pathPrepend is forbidden for host=gateway"
  );
}
```

**测试要求**:
- [ ] 添加单元测试验证gateway模式拒绝pathPrepend
- [ ] 添加集成测试验证沙箱隔离
- [ ] 手动安全测试验证修复有效性

**预计工时**: 2天
**责任人**: @security-team

---

#### [ ] Issue #2: 会话存储并发写入竞态条件
**标签**: `P0-critical`, `bug`, `core`, `concurrency`
**文件**: `src/config/sessions/store.ts:649-718`

**描述**:
`drainSessionStoreLockQueue` 函数中,检查 `queue.running` 和设置为 `true` 之间不是原子操作,在高并发场景下可能导致多个协程同时进入临界区。

**影响**:
- 会话数据可能被并发写入覆盖
- 可能导致会话状态不一致
- 高并发场景下数据损坏风险
- 生产环境中已观察到偶发性会话丢失

**修复建议**:
```typescript
// 使用 compare-and-swap 模式
async function drainSessionStoreLockQueue(storePath: string): Promise<void> {
  const queue = LOCK_QUEUES.get(storePath);
  if (!queue) return;

  // 原子性检查并设置
  if (queue.running) return;
  const wasRunning = queue.running;
  queue.running = true;
  if (wasRunning) {
    queue.running = false;
    return;
  }
  // ...
}
```

**测试要求**:
- [ ] 添加并发压力测试(100+并发请求)
- [ ] 验证数据一致性
- [ ] 长时间运行测试(24小时+)

**预计工时**: 2天
**责任人**: @core-team

---

#### [ ] Issue #3: 进程句柄资源泄漏
**标签**: `P0-critical`, `bug`, `core`, `resource-leak`
**文件**: `src/agents/bash-process-registry.ts:161-213`

**描述**:
`moveToFinished` 函数中,对于 PTY 进程,仅调用 `stdin.end()` 不会释放文件描述符,长时间运行会导致 FD 耗尽。

**影响**:
- 文件描述符泄漏
- 长时间运行后系统资源耗尽
- 可能导致无法创建新进程
- 需要重启应用恢复

**修复建议**:
```typescript
// 强制销毁并添加错误处理
if (session.stdin) {
  try {
    if (typeof session.stdin.destroy === "function") {
      session.stdin.destroy();
    } else if (typeof session.stdin.end === "function") {
      session.stdin.end();
    }
    // 强制等待释放
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (err) {
    logWarn("Failed to destroy stdin", { sessionId: session.id, err });
  }
}
```

**测试要求**:
- [ ] 创建1000+进程并监控FD使用
- [ ] 验证所有FD被正确释放
- [ ] 添加资源泄漏检测工具

**预计工时**: 2天
**责任人**: @core-team

---

#### [ ] Issue #4: 补丁应用索引未验证导致未定义行为
**标签**: `P0-critical`, `bug`, `core`, `security`
**文件**: `src/agents/apply-patch-update.ts:94-104`

**描述**:
`applyReplacements` 函数中,`startIndex` 可能为负数或 NaN,`splice` 会产生未定义行为,可能破坏文件内容。

**影响**:
- 补丁应用可能破坏文件内容
- 数据损坏风险
- 可能导致代码注入
- 影响所有使用补丁系统的功能

**修复建议**:
```typescript
for (const [startIndex, oldLen, newLines] of [...replacements].toReversed()) {
  // 验证索引有效性
  if (!Number.isFinite(startIndex) || startIndex < 0 || startIndex > result.length) {
    throw new Error(`Invalid replacement index: ${startIndex}`);
  }
  if (!Number.isFinite(oldLen) || oldLen < 0) {
    throw new Error(`Invalid replacement length: ${oldLen}`);
  }
  // ...
}
```

**测试要求**:
- [ ] 添加边界条件测试(负数、NaN、超出范围)
- [ ] 验证错误被正确抛出
- [ ] 模糊测试随机输入

**预计工时**: 1天
**责任人**: @core-team

---

#### [ ] Issue #5: 认证数据明文存储安全漏洞
**标签**: `P0-critical`, `security`, `core`, `compliance`
**文件**: `src/agents/auth-profiles/store.ts:343-356`

**描述**:
OAuth tokens、API keys 等敏感凭证以明文形式存储,注释说需要"显式调用迁移工具"才加密,但默认行为不安全。

**影响**:
- 凭证明文泄漏风险
- 违反安全最佳实践
- 可能违反GDPR、等保等合规要求
- 磁盘访问即可获取所有凭证

**修复建议**:
```typescript
// 默认使用加密存储
export function saveAuthProfileStore(store: AuthProfileStore, agentDir?: string): void {
  const authPath = resolveAuthStorePath(agentDir);

  // 检查是否已加密
  if (isAuthStoreEncrypted(authPath)) {
    await saveEncryptedAuthStore(store, agentDir);
  } else {
    // 首次保存时自动启用加密
    logInfo("Enabling encryption for auth store");
    await saveEncryptedAuthStore(store, agentDir);
  }
}
```

**测试要求**:
- [ ] 验证新数据自动加密
- [ ] 提供迁移工具加密现有数据
- [ ] 审计所有存储路径确保加密

**预计工时**: 1天 + 1天迁移
**责任人**: @security-team

---

#### [ ] Issue #6: 正则表达式注入导致 ReDoS 攻击
**标签**: `P0-critical`, `security`, `core`, `dos`
**文件**: `src/infra/exec-approvals-analysis.ts:142-168`

**描述**:
`globToRegExp` 函数转义逻辑不完整,某些特殊字符(如 `]`)未被转义,可能导致 ReDoS(正则表达式拒绝服务)攻击。

**影响**:
- CPU 资源耗尽(ReDoS)
- 服务拒绝
- 允许列表绕过
- CVSSv3: 7.5 (High)

**修复建议**:
```typescript
function globToRegExp(pattern: string): RegExp {
  // 使用更完整的转义列表
  const escapeRegex = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      // ...
    } else {
      regex += escapeRegex(ch);
    }
    i += 1;
  }
  regex += "$";
  return new RegExp(regex, "i");
}
```

**测试要求**:
- [ ] 添加ReDoS攻击测试
- [ ] 验证所有特殊字符被转义
- [ ] 性能测试确保不超时

**预计工时**: 1天
**责任人**: @security-team

---

#### [ ] Issue #7: 整数溢出导致会话永不过期
**标签**: `P0-critical`, `bug`, `core`, `resource-leak`
**文件**: `src/config/sessions/store.ts:286-294`

**描述**:
`resolvePruneAfterMs` 函数解析的时间可能超过 `Number.MAX_SAFE_INTEGER`,导致计算错误,会话可能永不过期。

**影响**:
- 会话永不过期
- 内存泄漏
- 磁盘空间耗尽
- 长期运行的服务受影响严重

**修复建议**:
```typescript
const MAX_PRUNE_AFTER_MS = 365 * 24 * 60 * 60 * 1000; // 1年

function resolvePruneAfterMs(maintenance?: SessionMaintenanceConfig): number {
  const raw = maintenance?.pruneAfter ?? maintenance?.pruneDays;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_SESSION_PRUNE_AFTER_MS;
  }
  try {
    const parsed = parseDurationMs(String(raw).trim(), { defaultUnit: "d" });
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PRUNE_AFTER_MS) {
      logWarn("Invalid prune duration, using default", { parsed });
      return DEFAULT_SESSION_PRUNE_AFTER_MS;
    }
    return parsed;
  } catch {
    return DEFAULT_SESSION_PRUNE_AFTER_MS;
  }
}
```

**测试要求**:
- [ ] 测试超大值被限制
- [ ] 测试NaN和Infinity被拒绝
- [ ] 长期运行验证会话正确清理

**预计工时**: 1天
**责任人**: @core-team

---

#### [ ] Issue #8: 类型检查缺失导致空指针解引用
**标签**: `P0-critical`, `bug`, `core`, `type-safety`
**文件**: `src/agents/bash-tools.exec.ts:233-234`

**描述**:
虽然检查了 `last` 存在,但没有验证类型,如果 buffer 被污染包含非字符串元素会崩溃。

**影响**:
- 进程意外终止
- 命令执行失败
- 用户体验受损

**修复建议**:
```typescript
const last = buffer.at(-1);
if (last && typeof last === "string" && last.length >= cap) {
  buffer.length = 0;
  buffer.push(last.slice(last.length - cap));
  return cap;
}
```

**测试要求**:
- [ ] 测试buffer包含非字符串元素
- [ ] 验证类型检查生效
- [ ] 添加运行时类型验证

**预计工时**: 1天
**责任人**: @core-team

---

### 插件系统 Critical (4个)

#### [ ] Issue #9: DingTalk Token 刷新无并发保护
**标签**: `P0-critical`, `bug`, `extensions`, `concurrency`
**文件**: `extensions/dingtalk/src/channel.ts`

**描述**:
多个请求同时触发 token 刷新时,没有并发保护机制,可能导致 token 失效或多次刷新。

**影响**:
- Token可能被覆盖失效
- 服务中断
- 消息发送失败
- 高并发场景下频繁出现

**修复建议**:
```typescript
private refreshPromise: Promise<string> | null = null;

async getAccessToken(): Promise<string> {
  if (this.refreshPromise) {
    return this.refreshPromise;
  }

  this.refreshPromise = this.doRefresh();
  try {
    return await this.refreshPromise;
  } finally {
    this.refreshPromise = null;
  }
}
```

**测试要求**:
- [ ] 并发100+请求测试
- [ ] 验证只刷新一次
- [ ] 压力测试验证稳定性

**预计工时**: 1天
**责任人**: @extensions-team

---

#### [ ] Issue #10: Feishu 文件上传缺少大小验证
**标签**: `P0-critical`, `bug`, `extensions`, `security`
**文件**: `extensions/feishu/src/media.ts`

**描述**:
文件上传前未检查文件大小,可能导致上传超大文件造成OOM。

**影响**:
- 内存耗尽
- 服务崩溃
- 影响所有用户
- 可被恶意利用

**修复建议**:
```typescript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

async function uploadFile(file: Buffer): Promise<string> {
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${file.length} bytes (max ${MAX_FILE_SIZE})`);
  }
  // ...
}
```

**测试要求**:
- [ ] 测试超大文件被拒绝
- [ ] 监控内存使用
- [ ] 添加配置项控制限制

**预计工时**: 0.5天
**责任人**: @extensions-team

---

#### [ ] Issue #11: BlueBubbles 私有 API 依赖风险
**标签**: `P0-critical`, `risk`, `extensions`, `compatibility`
**文件**: `extensions/bluebubbles/src/send.ts`

**描述**:
依赖未文档化的私有 API,可能随时失效,且错误提示要求用户启用私有API。

**影响**:
- 功能完全失效
- 用户体验严重受损
- 无法预测的兼容性问题
- 可能违反平台政策

**修复建议**:
1. 添加降级方案使用公开API
2. 清晰文档化私有API依赖
3. 提供替代方案
4. 监控API变化

**测试要求**:
- [ ] 测试私有API不可用时的降级
- [ ] 文档化所有API依赖
- [ ] 定期检查API可用性

**预计工时**: 2天
**责任人**: @extensions-team

---

#### [ ] Issue #12: Discord 会话状态无并发保护
**标签**: `P0-critical`, `bug`, `extensions`, `concurrency`
**文件**: `extensions/discord/src/channel.ts`

**描述**:
`activeMessages` Map 的并发读写没有保护,可能导致消息丢失或状态不一致。

**影响**:
- 消息丢失
- 状态不一致
- 用户体验受损

**修复建议**:
```typescript
private readonly lock = new AsyncLock();

async updateMessage(id: string, content: string): Promise<void> {
  await this.lock.acquire('activeMessages', async () => {
    const msg = this.activeMessages.get(id);
    // 操作...
  });
}
```

**测试要求**:
- [ ] 并发消息测试
- [ ] 验证消息不丢失
- [ ] 压力测试

**预计工时**: 1天
**责任人**: @extensions-team

---

### 构建系统 Critical (3个)

#### [ ] Issue #13: package-mac-offline.sh 缺少错误处理
**标签**: `P0-critical`, `bug`, `build`
**文件**: `scripts/package-mac-offline.sh`

**描述**:
下载失败后没有清理临时文件,重试时可能使用损坏的缓存文件。

**影响**:
- 构建失败
- 重试失败
- CI/CD不稳定

**修复建议**:
```bash
cleanup() {
  rm -f "$node_file"
  rm -rf "$node_dir"
}
trap cleanup EXIT ERR

curl -fSL "$node_url" -o "$node_file" || exit 1
tar -xzf "$node_file" -C "$node_dir" --strip-components=1 || exit 1
```

**测试要求**:
- [ ] 模拟网络失败
- [ ] 验证清理执行
- [ ] CI测试

**预计工时**: 0.5天
**责任人**: @devops-team

---

#### [ ] Issue #14: 依赖包签名验证缺失
**标签**: `P0-critical`, `security`, `build`, `supply-chain`
**文件**: `scripts/package-mac-offline.sh`

**描述**:
下载的 Node.js 二进制文件未验证签名,存在供应链攻击风险。

**影响**:
- 供应链攻击风险
- 可能下载恶意二进制文件
- 严重安全隐患
- CVSSv3: 9.0 (Critical)

**修复建议**:
```bash
# 下载签名文件
curl -fSL "${node_url}.sha256" -o "${node_file}.sha256"

# 验证签名
echo "$(cat ${node_file}.sha256)  ${node_file}" | shasum -a 256 -c -

if [ $? -ne 0 ]; then
  echo "ERROR: Signature verification failed"
  exit 1
fi
```

**测试要求**:
- [ ] 测试签名验证
- [ ] 模拟签名不匹配
- [ ] 集成到CI

**预计工时**: 1天
**责任人**: @devops-team + @security-team

---

#### [ ] Issue #15: Windows 构建脚本路径转义问题
**标签**: `P0-critical`, `bug`, `build`, `windows`
**文件**: `scripts/*.ps1`

**描述**:
PowerShell 脚本中空格路径未正确转义,可能导致构建失败或路径注入。

**影响**:
- Windows构建失败
- 路径注入风险
- CI不稳定

**修复建议**:
```powershell
$nodePath = "`"$env:PROGRAMFILES\nodejs\node.exe`""
& $nodePath --version
```

**测试要求**:
- [ ] 测试空格路径
- [ ] Windows CI验证
- [ ] 特殊字符测试

**预计工时**: 1天
**责任人**: @devops-team

---

### macOS应用 Critical (2个)

#### [ ] Issue #16: AppState 强引用循环风险
**标签**: `P0-critical`, `bug`, `macos`, `memory-leak`
**文件**: `apps/macos/Sources/Clawdbot/AppState.swift`

**描述**:
`healthStore`、`channelsStore` 等存储对象可能回调 AppState 导致循环引用和内存泄漏。

**影响**:
- 内存泄漏
- 应用性能下降
- 长时间运行后内存耗尽

**修复建议**:
```swift
channelsStore.onChange = { [weak self] in
  guard let self = self else { return }
  self.handleChannelsChange()
}
```

**测试要求**:
- [ ] 内存泄漏检测工具
- [ ] 长时间运行测试
- [ ] 审查所有回调

**预计工时**: 2天
**责任人**: @macos-team

---

#### [ ] Issue #17: GatewayConnection 无限重连风险
**标签**: `P0-critical`, `bug`, `macos`, `performance`
**文件**: `apps/macos/Sources/Clawdbot/GatewayConnection.swift`

**描述**:
网络闪断可能触发无限重连循环,没有指数退避机制。

**影响**:
- CPU占用高
- 电池耗尽
- 网络流量浪费
- 用户体验差

**修复建议**:
```swift
private func reconnect() async {
  retryCount += 1
  let delay = min(pow(2.0, Double(retryCount)), 60.0)
  try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
  await connect()
}
```

**测试要求**:
- [ ] 网络闪断测试
- [ ] 监控CPU使用
- [ ] 验证指数退避

**预计工时**: 1天
**责任人**: @macos-team

---

### iOS应用 Critical (1个)

#### [ ] Issue #18: 后台状态处理保守性不足
**标签**: `P0-critical`, `bug`, `ios`, `compliance`
**文件**: `apps/ios/Sources/ClawdbotApp.swift`

**描述**:
`@unknown default` 分支将未知状态视为非后台,可能绕过后台功能限制,违反App Store规则。

**影响**:
- 后台功能限制被绕过
- 可能违反App Store审核规则
- 电池耗尽
- 可能导致应用被拒

**修复建议**:
```swift
func setScenePhase(_ phase: ScenePhase) {
    switch phase {
    case .background:
        self.isBackgrounded = true
    case .active, .inactive:
        self.isBackgrounded = false
    @unknown default:
        // 保守处理,限制后台功能
        self.isBackgrounded = true
    }
}
```

**测试要求**:
- [ ] 测试所有场景阶段
- [ ] 验证后台限制生效
- [ ] 提交前审查

**预计工时**: 0.5天
**责任人**: @ios-team

---

## ⚠️ High Priority Issues (P1 - 2周内修复)

*(由于篇幅限制,以下仅列出标题和关键信息)*

### 核心模块 High (14个)

- [ ] #19: 异步错误吞没 - `bash-tools.exec.ts:461-550`
- [ ] #20: 数组越界访问 - `apply-patch.ts:24-27`
- [ ] #21: Promise 未正确处理 - `bash-tools.exec.ts:645-791`
- [ ] #22: 类型转换不安全 - `exec-approvals.ts:543-548`
- [ ] #23: Socket 资源泄漏 - `exec-approvals.ts:503-555`
- [ ] #24: 死锁风险 - `sessions/store.ts:720-775`
- [ ] #25: TOCTOU 时间窗口攻击 - `exec-approvals-analysis.ts:28-41`
- [ ] #26: 缓冲区溢出保护不足 - `bash-process-registry.ts:104-132`
- [ ] #27: 路径遍历漏洞 - `apply-patch.ts:254-285`
- [ ] #28: Shell 命令注入风险 - `bash-tools.exec.ts:373-374`
- [ ] #29: 缓存失效竞态 - `auth-profiles/store.ts:224-252`
- [ ] #30: 哈希碰撞风险 - `session-key.ts:189-233`
- [ ] #31: 并发写入丢失 - `exec-approvals.ts:431-456`
- [ ] #32: Interval 未正确 unref - `bash-process-registry.ts:295-301`

### 插件系统 High (8个)

- [ ] #33: DingTalk 消息重试无指数退避
- [ ] #34: Feishu 会话存储无过期机制
- [ ] #35: BlueBubbles 认证 token 明文传输
- [ ] #36: Discord 错误处理不完整
- [ ] #37: 插件配置验证不一致
- [ ] #38: 媒体文件未检查类型
- [ ] #39: API 限流未实施
- [ ] #40: 敏感数据日志泄露

### 构建系统 High (6个)

- [ ] #41: CI缓存未验证完整性
- [ ] #42: 测试隔离不足
- [ ] #43: 环境变量未加密
- [ ] #44: Docker镜像未最小化
- [ ] #45: 依赖版本未锁定
- [ ] #46: 构建产物未签名

### macOS/iOS High (8个)

- [ ] #47: SwiftUI 状态更新非主线程
- [ ] #48: 相机权限检查时机不当
- [ ] #49: WebView 内存泄漏
- [ ] #50: 网络请求未设置超时
- [ ] #51: Keychain 存储未加密
- [ ] #52: 推送通知未处理错误
- [ ] #53: 后台任务未正确注册
- [ ] #54: 文件操作未检查权限

---

## 📊 Medium Priority Issues (P2 - 1-2个月修复)

*(由于数量较多(50个),仅列出分类统计)*

### 按类型分类

- **边界条件问题**: 15个
- **配置验证问题**: 8个
- **错误处理改进**: 10个
- **代码质量问题**: 12个
- **性能优化**: 5个

### 按模块分类

- **核心模块**: 15个
- **插件系统**: 12个
- **构建系统**: 9个
- **macOS应用**: 8个
- **iOS应用**: 6个

**建议**: 按模块分批处理,每周修复5-8个Medium问题

---

## 🔵 Low Priority Issues (P3 - 持续改进)

*(由于优先级较低,仅列出主要类别)*

### 代码质量改进 (10个)

- 清理空 catch 块 (28处)
- 清理 TODO/FIXME 标记 (47个)
- 改进函数命名
- 添加类型注解
- 重构复杂函数

### 文档改进 (5个)

- 补充API文档
- 更新README
- 添加架构图
- 完善故障排查指南
- 翻译英文文档

---

## 📋 创建 Issues 的模板

### GitHub Issue 模板

```markdown
## 问题描述
[从清单中复制描述]

## 影响
[从清单中复制影响]

## 修复建议
[从清单中复制修复建议]

## 测试要求
[从清单中复制测试要求]

## 预计工时
[从清单中复制工时]

## 相关文件
- [ ] [文件路径]

## 检查清单
- [ ] 代码修复完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 代码审查通过
- [ ] 文档更新完成
```

---

## 🎯 优先级矩阵

| 优先级 | 数量 | 开始时间 | 完成目标 | 责任团队 |
|--------|------|----------|----------|----------|
| **P0** | 18 | 立即 | 2周内 | 全员 |
| **P1** | 36 | 1周后 | 1个月内 | 核心团队 |
| **P2** | 50 | 2周后 | 2个月内 | 按模块 |
| **P3** | 15 | 按需 | 持续 | 维护团队 |

---

## 📈 进度追踪

### 完成率目标

- **Week 1**: P0 完成 50% (9/18)
- **Week 2**: P0 完成 100% (18/18)
- **Week 4**: P1 完成 50% (18/36)
- **Week 8**: P1 完成 100% (36/36)
- **Month 3**: P2 完成 80% (40/50)

### 每周报告

建议每周五更新进度:
- 本周完成的Issue数量
- 本周发现的新问题
- 遇到的困难和阻塞
- 下周计划

---

**本清单基于**: [ALL_AGENTS_COMPREHENSIVE_SUMMARY.md](ALL_AGENTS_COMPREHENSIVE_SUMMARY.md)
**详细报告**: 见各模块审查报告 (report_*.md)
**更新日期**: 2026-02-17
