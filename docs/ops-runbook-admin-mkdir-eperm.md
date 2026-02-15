# 运维手册：Windows 管理员运行报错 EPERM mkdir 'C:\'

> **事件**：用户以管理员身份运行时报 `EPERM: operation not permitted, mkdir 'C:\'`
> **影响**：管理员账户、SYSTEM 账户、部分企业域控环境下发消息必崩
> **根因**：双重问题 —— (1) 用户 config 中 workspace 配置异常（如 `"/"`）在 Windows 上 resolve 为 `C:\`；(2) `os.homedir()` 在无 HOME/USERPROFILE 时也返回盘符根目录
> **代码修复**：已在 4 个文件加入防御

---

## 一、紧急止血（1 分钟内可完成）

### 1.1 最简方案：检查用户 config

让用户打开 `openclawcn.json`，检查 `workspace` 相关配置：

```json
// 错误示例 ——  "/" 在 Windows 上会变成 "C:\"
{
  "agents": {
    "defaults": { "workspace": "/" }
  }
}

// 正确示例
{
  "agents": {
    "defaults": { "workspace": "~/clawd" }
  }
}
```

**如果有 `workspace: "/"`，改成 `"~/clawd"` 即可解决。**

### 1.2 不改 config 的临时方案

**PowerShell（管理员）：**

```powershell
# 永久生效（写入用户环境变量，设一次就行）
[Environment]::SetEnvironmentVariable("OPENCLAWCN_STATE_DIR", "$env:LOCALAPPDATA\.openclawcn", "User")
```

设置后重启程序即可。

### 1.3 最简方案：不用管理员运行

直接双击正常打开程序，不要右键"以管理员身份运行"。

---

## 二、排查确认

### 2.1 从日志确认

日志中如果同时出现以下两条，即可确诊：

```
[ERR] [capability-detect] Skipping dangerous directory: C:\
[ERR] [getReplyFromConfig] Unhandled error in reply pipeline: EPERM: operation not permitted, mkdir 'C:\'
```

堆栈一定指向：
```
at ensureAgentWorkspace (file:///.../dist/agents/workspace.js:95:5)
at getReplyFromConfig (file:///.../dist/auto-reply/reply/get-reply.js:94:27)
```

### 2.2 根因判断

| 线索 | 含义 |
|------|------|
| canvas 路径正常（如 `C:\Users\Administrator\clawd\canvas`） | `os.homedir()` 本身正常，问题不是 homedir |
| capability-detect 报 `Skipping dangerous directory: C:\` | `resolveAgentWorkspaceDir(cfg, agentId)` 返回了 `C:\` |
| 说明 config 中有 workspace 配置被 `path.resolve()` 解析为 `C:\` | 最常见的值：`"/"` 或 `"\"` 或空 |

### 2.3 常见触发场景

| 场景 | 原因 | 解决 |
|------|------|------|
| config 中 `workspace: "/"` | `path.resolve("/")` 在 Windows = `C:\` | 改为 `"~/clawd"` |
| config 中 `workspace: "\"` | 同上 | 改为 `"~/clawd"` |
| 管理员 + 无 HOME/USERPROFILE | `os.homedir()` 回退到盘符根目录 | 设 `OPENCLAWCN_STATE_DIR` |
| Windows 服务（SYSTEM 账户） | SYSTEM 没有用户 profile | 在服务配置中添加环境变量 |

---

## 三、代码修复说明

### 3.1 修改文件

| 文件 | 修复内容 |
|------|----------|
| `src/agents/workspace.ts` | `ensureAgentWorkspace()` mkdir 前加 `isFsRoot` 检查 + `resolveDefaultAgentWorkspaceDir()` homedir 加回退 |
| `src/agents/agent-scope.ts` | `resolveAgentWorkspaceDir()` 对 config 返回的路径加 `rejectFsRoot` 防御 |
| `src/utils.ts` | `resolveUserPath()` 的 `~` 展开用 `safeHomedir()`（drive root 回退） + `resolveConfigDir()` 同步修复 |
| `src/config/paths.ts` | `resolveStateDir()` + `resolveUserPath()` 加 homedir drive root 回退 |

### 3.2 防御策略

**层 1 — 路径解析时**：`resolveAgentWorkspaceDir` 检测 `resolveUserPath` 结果是否为盘符根目录，是则抛出明确错误。

**层 2 — mkdir 前**：`ensureAgentWorkspace` 在实际 `fs.mkdir` 前再次检查 dir 是否为根目录。

**层 3 — homedir 回退**：所有用到 `os.homedir()` 的地方加 `safeHomedir()` 逻辑，drive root 时依次回退到 `LOCALAPPDATA` → `APPDATA` → `USERPROFILE`。

### 3.3 错误信息改善

修复前：
```
EPERM: operation not permitted, mkdir 'C:\'
```

修复后（config 异常）：
```
agent "main" workspace resolved to filesystem root "C:\". Fix the workspace path in openclawcn.json (e.g. use ~/clawd instead of /).
```

修复后（homedir 异常）：
```
Cannot resolve home directory: HOME / USERPROFILE are not set and os.homedir() returned drive root "C:\". Set OPENCLAWCN_STATE_DIR or run as a normal user.
```

---

## 四、验证

### 4.1 验证清单

- [ ] 正常用户运行：路径为 `C:\Users\xxx\clawd`，无变化
- [ ] config 中 `workspace: "/"` → 抛出明确错误而非 EPERM
- [ ] 管理员运行 + HOME 缺失 → 自动降级到 `LOCALAPPDATA`
- [ ] 所有环境变量缺失 → 抛出明确错误提示
- [ ] `OPENCLAWCN_STATE_DIR` 已设置 → 优先使用用户指定路径

### 4.2 客户回复话术

> 您好，这个报错是配置文件中 workspace 路径设置的问题。
> 请打开您的 openclawcn.json，找到 workspace 配置，把 `"/"` 改成 `"~/clawd"` 即可。
> 如果找不到 config，可以在 PowerShell 里执行一行命令：
> `[Environment]::SetEnvironmentVariable("OPENCLAWCN_STATE_DIR", "$env:LOCALAPPDATA\.openclawcn", "User")`
> 设置一次永久生效。

---

## 五、关联文件

| 文件 | 说明 |
|------|------|
| `src/agents/workspace.ts` | agent 工作区创建（崩溃点，已修复） |
| `src/agents/agent-scope.ts` | workspace 路径解析（已加防御） |
| `src/utils.ts` | 通用路径解析工具（已加 safeHomedir） |
| `src/config/paths.ts` | state/config 路径解析（已加回退） |
| `src/config/sessions/paths.ts` | 会话路径，依赖 `resolveStateDir()` |
| `src/gateway/server-methods/chat.ts` | transcript 创建，已有 `isFsRoot()` 保护 |
| `src/infra/capability-detect.ts` | 能力检测，已有 dangerous dir 保护 |
| `docs/issues/2026-0209-admin-mkdir-eperm.md` | 问题归档（技术细节） |
