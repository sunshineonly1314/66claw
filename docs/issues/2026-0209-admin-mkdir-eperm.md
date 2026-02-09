# 问题归档：管理员安装报错 EPERM mkdir 'C:\'

> 归档日期：2026-02-09
> 严重等级：P1（管理员运行场景下的阻断性错误，影响所有 Windows 管理员用户）
> 状态：已修复（含架构改进：Windows 便携数据目录）

---

## 1. 客诉原文

用户使用管理员身份安装或运行时，弹出错误：

```
处理消息时发生错误，请重试。
错误详情: EPERM: operation not permitted, mkdir 'C:\'
```

完整错误栈：

```
[ERR] [getReplyFromConfig] Unhandled error in reply pipeline: EPERM: operation not permitted, mkdir 'C:\'
[ERR] Stack: Error: EPERM: operation not permitted, mkdir 'C:\'
    at Object.mkdir (node:internal/fs/promises:857:10)
    at ensureAgentWorkspace (file:///D:/ClawdbotCN/dist/agents/workspace.js:95:5)
    at getReplyFromConfig (file:///D:/ClawdbotCN/dist/auto-reply/reply/get-reply.js:94:27)
    at dispatchReplyFromConfig (file:///D:/ClawdbotCN/dist/auto-reply/reply/dispatch-from-config.js:226:29)
    at dispatchInboundMessage (file:///D:/ClawdbotCN/dist/auto-reply/dispatch.js:26:12)
```

## 2. 问题分析

### 2.1 根因

| 排查项 | 结论 |
|--------|------|
| `os.homedir()` 返回值 | 管理员/SYSTEM 运行时，`HOME` 和 `USERPROFILE` 环境变量可能缺失，Node.js 的 `os.homedir()` 回退返回盘符根目录 `C:\` |
| 实际 mkdir 路径 | `C:\` —— 直接在盘符根目录创建文件夹 |
| 失败原因 | Windows 对盘符根目录有额外保护，即使管理员也触发 `EPERM` |
| 设计缺陷 | 上游开源项目沿用 Unix 惯例（`~/.clawdbot`），所有数据默认存 C 盘用户主目录，不适配 Windows 便携部署场景 |

### 2.2 调用链

```
getReplyFromConfig()                          ← src/auto-reply/reply/get-reply.ts:94
  → resolveAgentWorkspaceDir(cfg, agentId)    ← src/agents/agent-scope.ts:148
    → os.homedir() 返回 "C:\"
    → path.join("C:\", "clawd")               ← 或更糟：直接返回 "C:\"
  → ensureAgentWorkspace({ dir })             ← src/agents/workspace.ts:132
    → resolveUserPath(rawDir)                 ← 得到 "C:\" 或 "C:\clawd"
    → fs.mkdir(dir, { recursive: true })      ← EPERM!
```

### 2.3 触发条件

- 以"管理员身份运行"终端/Obsidian
- 以 Windows 服务 (SYSTEM 账户) 运行
- 某些企业域控环境下用户配置文件路径异常

### 2.4 影响范围

代码中多处直接使用 `os.homedir()` 而无安全回退：

| 文件 | 位置 | 风险 |
|------|------|------|
| `src/agents/agent-scope.ts:158` | `path.join(os.homedir(), ...)` | 非默认 agent workspace |
| `src/config/sessions/paths.ts:67,71` | `os.homedir()` tilde 展开 | session store 路径 |
| `src/hooks/bundled/session-memory/handler.ts:74` | `path.join(os.homedir(), "clawd")` | 记忆钩子 fallback |
| `src/gateway/session-utils.fs.ts:50` | `path.join(os.homedir(), ".clawdbot", ...)` | session 文件查找 |
| `src/cron/store.ts:15` | `os.homedir()` tilde 展开 | cron store 路径 |

## 3. 修复方案

### 3.1 架构改进：Windows 便携数据目录（核心）

**设计决策**：Windows 上数据不再依赖 C 盘用户主目录，改为跟随应用安装目录。

```
修复前：                                 修复后：
C:\Users\xxx\.clawdbot\  (状态)         D:\ClawdbotCN\data\         (状态)
C:\Users\xxx\clawd\      (workspace)    D:\ClawdbotCN\data\clawd\   (workspace)
```

路径解析优先级：

```
1. CLAWDBOT_STATE_DIR 环境变量         （显式覆盖，最高优先级）
2. <安装目录>/data/                     （Windows 便携模式，新增）
3. ~/.clawdbot                          （macOS/Linux 或 Windows 回退）
```

实现方式：通过 `import.meta.url` 自动检测应用安装目录，在 Windows 上返回 `<appRoot>/data/`。

### 3.2 安全防御：safeHomedir + rejectFsRoot

- 导出 `safeHomedir()`（`src/utils.ts`），所有路径解析统一使用
- `safeHomedir()` 回退链：`os.homedir()` → `LOCALAPPDATA` → `APPDATA` → `USERPROFILE`
- `rejectFsRoot()` 在 agent-scope 中拦截盘符根目录路径
- `ensureAgentWorkspace()` 中增加 guard：`dir === parsed.root` 时抛出明确错误

### 3.3 卸载保留用户数据

InnoSetup 安装脚本 `[UninstallDelete]` 不再删除 `{app}\data`，卸载后保留用户数据便于重装恢复。

## 4. 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/config/paths.ts` | 新增 `resolveAppRootDir()`、`resolvePortableDataDir()`；`resolveStateDir()` Windows 优先使用便携目录 |
| `src/agents/workspace.ts` | `resolveDefaultAgentWorkspaceDir()` Windows 优先使用 `<appRoot>/data/clawd/`；移除重复的 `safeHomedir`，改为从 utils 导入 |
| `src/agents/agent-scope.ts` | 非默认 agent 路径改用 `safeHomedir()` + `rejectFsRoot()` |
| `src/utils.ts` | 导出 `safeHomedir()` 供其他模块使用 |
| `src/config/sessions/paths.ts` | `resolveStorePath()` tilde 展开改用 `safeHomedir()` |
| `src/hooks/bundled/session-memory/handler.ts` | fallback workspace 和日志路径改用 `safeHomedir()` |
| `src/gateway/session-utils.fs.ts` | session 文件查找路径改用 `safeHomedir()` |
| `src/cron/store.ts` | tilde 展开改用 `safeHomedir()` |
| `scripts/windows/setup.iss` | `[UninstallDelete]` 移除 `{app}\data`，卸载保留用户数据 |

## 5. 用户临时解决方案

如果用户暂时无法更新版本，可通过以下任一方式解决：

### 方案 A：以普通用户运行（推荐）

不要右键"以管理员身份运行"，直接正常打开即可。

### 方案 B：设置环境变量

在管理员 PowerShell 中运行后重启程序：

```powershell
# 永久生效（写入用户环境变量）
[Environment]::SetEnvironmentVariable("CLAWDBOT_STATE_DIR", "$env:LOCALAPPDATA\.clawdbot", "User")
```

## 6. 验证方法

修复后验证：

```powershell
# 1. 确认路径不再指向 C 盘
node -e "import('./dist/config/paths.js').then(m => console.log('stateDir:', m.resolveStateDir()))"
# 预期输出：stateDir: D:\ClawdbotCN\data  (或其他安装盘符)

# 2. 以管理员身份运行，确认不再报 EPERM
# 直接发送消息给 bot，应正常回复

# 3. 确认便携目录结构
dir D:\ClawdbotCN\data\
# 预期看到：clawd\, agents\, credentials\ 等子目录
```
