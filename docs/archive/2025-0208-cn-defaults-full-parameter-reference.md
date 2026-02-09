# CN 区域默认配置 — 全参数默认值清单（归档）

> 归档日期：2025-02-08
> 来源：`docs/cn-defaults-requirements.md` 第八章
> 代码验证：所有值均已与 `src/config/defaults.ts:applyCnDefaults()` L400-562、
> `src/config/region-cn.ts:CN_DEFAULT_SECURITY_CONFIG` L984-1041、
> `src/config/agent-limits.ts:DEFAULT_AGENT_MAX_CONCURRENT/DEFAULT_SUBAGENT_MAX_CONCURRENT` 交叉验证

---

## 一、工具安全类（`tools.exec.*`）

| # | 配置路径 | 类型 | Windows CN | macOS CN | Linux CN | 非 CN 全局默认 | 设置原因 |
|---|---------|------|:----------:|:--------:|:--------:|:-------------:|---------|
| 1 | `tools.exec.security` | `"deny" \| "allowlist" \| "full"` | `"allowlist"` | `"allowlist"` | `"allowlist"` | `"deny"` | 白名单模式：只有 `safeBins` 中的命令允许执行。与 `setup-wizard.ts` 标准模式一致。全局默认 `"deny"` 禁止一切命令，CN 用户首次启动后 AI 完全无法操作 |
| 2 | `tools.exec.ask` | `"off" \| "on-miss" \| "always"` | `"on-miss"` | `"on-miss"` | `"on-miss"` | `"on-miss"` | 白名单外的未知命令不直接拒绝，而是弹窗询问用户是否允许。与 `setup-wizard.ts` 标准模式一致。平衡安全与易用性 |
| 3 | `tools.exec.safeBins` | `string[]` | 30 个命令 | 30 个命令 | 30 个命令 | `undefined` | 预置 CN 开发者常用命令白名单，来源：`CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist`。无此列表时 `allowlist` 模式等于禁止一切命令 |

### `safeBins` 完整命令清单（三平台相同，共 30 个）

| 分类 | 命令 | 数量 | 说明 |
|------|------|:----:|------|
| Windows 常用 | `notepad`, `explorer`, `calc`, `mspaint`, `code`, `cmd`, `powershell` | 7 | Windows 系统/编辑器工具（macOS/Linux 下不影响，因为这些命令不存在时不会被调用） |
| Python | `python`, `python3`, `pip`, `pip3` | 4 | Python 开发 |
| Node.js | `node`, `npm`, `pnpm`, `yarn`, `bun` | 5 | 前端/Node 开发 |
| 版本控制 | `git` | 1 | 代码管理 |
| Java | `java`, `javac`, `mvn`, `gradle` | 4 | Java 生态 |
| 其他语言 | `go`, `cargo`, `dotnet` | 3 | Go / Rust / .NET |
| 压缩工具 | `tar`, `zip`, `unzip` | 3 | 文件压缩解压 |
| 网络工具 | `curl`, `wget` | 2 | HTTP 请求（只读安全） |
| 办公软件 | `wps` | 1 | 国产办公软件（CN 用户高频使用） |
| **合计** | | **30** | |

---

## 二、沙箱隔离类（`agents.defaults.sandbox.*`）

| # | 配置路径 | 类型 | Windows CN | macOS CN | Linux CN | 非 CN 全局默认 | 设置原因 |
|---|---------|------|:----------:|:--------:|:--------:|:-------------:|---------|
| 4 | `agents.defaults.sandbox.mode` | `string` | `"non-main"` | `"non-main"` | `"non-main"` | `undefined` | 非主代理在沙箱中运行，主代理直接在宿主执行。来源：`CN_DEFAULT_SECURITY_CONFIG.sandbox.mode`。与 `setup-wizard.ts` 标准模式一致 |
| 5 | `agents.defaults.sandbox.scope` | `string` | `"session"` | `"session"` | `"session"` | `undefined` | 会话级沙箱隔离——每个会话独立沙箱，会话结束后清理。来源：`CN_DEFAULT_SECURITY_CONFIG.sandbox.scope` |
| 6 | `agents.defaults.sandbox.workspaceAccess` | `string` | `"rw"` | `"rw"` | `"rw"` | `undefined` | 沙箱对工作目录可读写。来源：`CN_DEFAULT_SECURITY_CONFIG.sandbox.workspaceAccess`。AI 需要读写项目文件才能完成编码任务 |

---

## 三、代理性能类（`agents.defaults.*`）

| # | 配置路径 | 类型 | Windows CN | macOS CN | Linux CN | 非 CN 全局默认 | 设置原因 |
|---|---------|------|:----------:|:--------:|:--------:|:-------------:|---------|
| 7 | `agents.defaults.maxConcurrent` | `number` | **3** | 4 | 4 | 4 (`DEFAULT_AGENT_MAX_CONCURRENT`) | 主代理最大并发数。Windows 更低（3），原因：Windows 进程创建开销高于 Unix fork，且多数 CN Windows 用户为桌面机，同时运行大量其他应用（微信、浏览器、WPS 等） |
| 8 | `agents.defaults.subagents.maxConcurrent` | `number` | **6** | 8 | 8 | 8 (`DEFAULT_SUBAGENT_MAX_CONCURRENT`) | 子代理最大并发数。Windows 更低（6），原因同上。子代理并发通常是主代理的 2 倍，因子代理任务更轻量 |
| 9 | `agents.defaults.timeoutSeconds` | `number` | 900 | 900 | 900 | `undefined` | 15 分钟超时。CN 用户网络环境不稳定（API 延迟更高），合理超时避免长时间挂起浪费资源，同时 15 分钟足以完成绝大多数 AI 任务 |

---

## 四、汇总对照表

| # | 配置路径 | Win CN | Mac CN | Linux CN | 非CN默认 | 三平台是否一致 | 数据来源 |
|---|---------|:------:|:------:|:--------:|:--------:|:-----------:|---------|
| 1 | `tools.exec.security` | `allowlist` | `allowlist` | `allowlist` | `deny` | 一致 | `CN_DEFAULT_SECURITY_CONFIG` + `setup-wizard` |
| 2 | `tools.exec.ask` | `on-miss` | `on-miss` | `on-miss` | `on-miss` | 一致 | `setup-wizard` 标准模式 |
| 3 | `tools.exec.safeBins` | 30 cmd | 30 cmd | 30 cmd | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist` |
| 4 | `sandbox.mode` | `non-main` | `non-main` | `non-main` | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.sandbox.mode` |
| 5 | `sandbox.scope` | `session` | `session` | `session` | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.sandbox.scope` |
| 6 | `sandbox.workspaceAccess` | `rw` | `rw` | `rw` | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.sandbox.workspaceAccess` |
| 7 | `maxConcurrent` | **3** | 4 | 4 | 4 | **Win 不同** | `applyCnDefaults` 独有（平台感知） |
| 8 | `subagents.maxConcurrent` | **6** | 8 | 8 | 8 | **Win 不同** | `applyCnDefaults` 独有（平台感知） |
| 9 | `timeoutSeconds` | 900 | 900 | 900 | ∅ | 一致 | `applyCnDefaults` 独有 |

---

## 五、关键机制说明

| 项目 | 说明 |
|------|------|
| **只填空不覆盖** | 仅当字段值 `=== undefined` 时写入，用户任何手动设置（包括 `"deny"`、`"off"` 等限制性值）都不会被覆盖 |
| **运行时生效，不持久化** | 默认值不写入 `clawdbot.json`，仅存在于内存。迁移到非 CN 区域后自动失效 |
| **链顺序** | `applySessionDefaults` → **`applyCnDefaults`** → `applyAgentDefaults`。CN 先写入 Win:3，`applyAgentDefaults` 发现已有值跳过，不会覆盖为全局默认 4 |
| **平台检测** | `os.platform() === "win32"` 区分 Windows；macOS (`darwin`) 和 Linux (`linux`) 使用相同值 |
| **区域检测** | `detectChinaRegion()`: 环境变量 `CLAWDBOT_REGION` > 时区 `Asia/Shanghai` > `LANG=zh_CN` |
| **Gateway 热更新** | `tools.*` 和 `agents.*` 属于免重启类别，用户通过 UI/CLI 修改后立即生效（Chokidar 文件监听 + 300ms 防抖） |
| **代码来源对齐** | 所有安全相关值与 `setup-wizard.ts` L1042-1074 和 `CN_DEFAULT_SECURITY_CONFIG` L984-1041 完全一致 |

---

## 六、相关文件索引

| 文件 | 职责 | 关键行号 |
|------|------|---------|
| `src/config/defaults.ts` | `applyCnDefaults()` 核心实现 | L400-562 |
| `src/config/io.ts` | 3 处默认值链注入 | L258, L312, L436 |
| `src/config/region-cn.ts` | `detectChinaRegion()` + `CN_DEFAULT_SECURITY_CONFIG` | L984-1041 |
| `src/config/agent-limits.ts` | `DEFAULT_AGENT_MAX_CONCURRENT=4`, `DEFAULT_SUBAGENT_MAX_CONCURRENT=8` | L3-4 |
| `src/config/types.tools.ts` | `ExecToolConfig` 类型定义 | L161-194 |
| `src/gateway/setup-wizard.ts` | Setup Wizard 标准模式安全配置 | L1042-1074 |
| `src/gateway/server-methods/security.ts` | 安全模式切换 API | L137-159 |
| `src/gateway/config-reload.ts` | 文件监听 + 热更新机制 | — |
| `src/config/defaults-cn.test.ts` | 23 个单元测试 | — |
| `docs/cn-defaults-requirements.md` | 完整需求规格书（本文来源） | — |
| `docs/archive/2025-0208-cn-defaults-and-bugfixes.md` | 功能实现归档 | — |
