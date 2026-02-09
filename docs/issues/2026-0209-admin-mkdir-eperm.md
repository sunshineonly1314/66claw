# 问题归档：管理员安装报错 EPERM mkdir 'C:\'

> 归档日期：2026-02
> 严重等级：P2（管理员运行场景下的阻断性错误）
> 状态：已修复

---

## 1. 客诉原文

用户使用管理员身份安装或运行时，弹出错误：

```
⚠️ 处理消息时发生错误，请重试。
错误详情: EPERM: operation not permitted, mkdir 'C:\'
```

## 2. 问题分析

### 2.1 根因

| 排查项 | 结论 |
|--------|------|
| `os.homedir()` 返回值 | 管理员/SYSTEM 运行时，`HOME` 和 `USERPROFILE` 环境变量可能缺失，Node.js 的 `os.homedir()` 回退返回盘符根目录 `C:\` |
| 实际 mkdir 路径 | `C:\.clawdbot\agents\main\sessions` —— 在 `C:\` 根目录下创建文件夹 |
| 失败原因 | Windows 对盘符根目录有额外保护，即使管理员也可能触发 `EPERM` |

### 2.2 调用链

```
resolveStateDir()                     ← src/config/paths.ts:23
  → homedir() 返回 "C:\"
  → path.join("C:\", ".clawdbot")     ← 得到 "C:\.clawdbot"
    → fs.mkdirSync(parentDir)         ← src/gateway/server-methods/chat.ts:85
      → EPERM!
```

### 2.3 触发条件

- 以"管理员身份运行"终端/Obsidian
- 以 Windows 服务 (SYSTEM 账户) 运行
- 某些企业域控环境下用户配置文件路径异常

## 3. 修复方案

**修改文件**：`src/config/paths.ts`

在 `resolveStateDir()` 和 `resolveUserPath()` 中增加防御逻辑：

1. 检测 `homedir()` 返回值是否为盘符根目录（如 `C:\`）
2. 若是，依次尝试回退到 `LOCALAPPDATA` → `APPDATA` → `USERPROFILE`
3. 全部缺失时抛出明确错误提示，引导用户设置 `CLAWDBOT_STATE_DIR`

回退优先级：

```
LOCALAPPDATA   (通常为 C:\Users\xxx\AppData\Local)
  ↓ 缺失
APPDATA        (通常为 C:\Users\xxx\AppData\Roaming)
  ↓ 缺失
USERPROFILE    (通常为 C:\Users\xxx)
  ↓ 缺失
抛出错误，提示用户手动设置 CLAWDBOT_STATE_DIR
```

## 4. 用户临时解决方案

如果用户暂时无法更新版本，可通过以下任一方式解决：

### 方案 A：以普通用户运行（推荐）

不要右键"以管理员身份运行"，直接正常打开即可。

### 方案 B：设置环境变量

在管理员 PowerShell 中运行后重启程序：

```powershell
# 临时生效（当前终端）
$env:CLAWDBOT_STATE_DIR = "$env:LOCALAPPDATA\.clawdbot"

# 永久生效（写入用户环境变量）
[Environment]::SetEnvironmentVariable("CLAWDBOT_STATE_DIR", "$env:LOCALAPPDATA\.clawdbot", "User")
```

### 方案 C：在配置中指定路径

编辑 `clawdbot.json`，手动指定 session store 路径：

```json
{
  "session": {
    "store": "C:\\Users\\你的用户名\\.clawdbot\\agents\\{agentId}\\sessions\\sessions.json"
  }
}
```

## 5. 验证方法

修复后可用以下方式验证：

```powershell
# 以管理员打开 PowerShell，清除 HOME 模拟异常环境
$env:HOME = ""
$env:USERPROFILE = ""

# 启动程序，应不再报 EPERM，而是回退到 LOCALAPPDATA
```

## 6. 关联代码

| 文件 | 说明 |
|------|------|
| `src/config/paths.ts` | 主路径解析（已修复） |
| `src/config/sessions/paths.ts` | 会话路径，依赖 `resolveStateDir()` |
| `src/daemon/paths.ts` | 守护进程路径，已有防御（会抛 "Missing HOME"） |
| `src/gateway/server-methods/chat.ts` | transcript 文件创建，已有 `isFsRoot()` 保护 |
