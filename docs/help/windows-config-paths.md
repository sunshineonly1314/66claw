# Windows 配置文件位置指南

> 适用于 OpenClawCN Windows 版本用户。如果你找不到配置文件，请参考本文档。

---

## 快速查找

打开命令行（PowerShell 或 CMD），运行以下命令即可查看当前使用的配置路径：

```bash
openclawcn config get
```

或者查看健康检查输出中的配置路径：

```bash
openclawcn health --verbose
```

---

## 配置文件位置

OpenClawCN 在 Windows 上有两种安装方式，配置文件位置不同：

### 方式一：命令行安装（npm / git clone）

| 项目 | 路径 |
|------|------|
| 配置目录 | `C:\Users\<你的用户名>\.openclawcn\` |
| 配置文件 | `C:\Users\<你的用户名>\.openclawcn\openclawcn.json` |

即 `%USERPROFILE%\.openclawcn\openclawcn.json`。

### 方式二：Windows 安装包（Setup.exe / 服务模式）

| 项目 | 路径 |
|------|------|
| 配置目录 | `C:\Users\<你的用户名>\AppData\Roaming\ClawdbotCN\` |
| 配置文件 | `C:\Users\<你的用户名>\AppData\Roaming\ClawdbotCN\openclawcn.json` |

即 `%APPDATA%\ClawdbotCN\openclawcn.json`。

> **提示**：在文件资源管理器地址栏中直接输入 `%APPDATA%\ClawdbotCN` 即可快速打开。

---

## 从旧版本升级？

如果你之前使用的是旧版本（品牌名为 Clawdbot），目录名和文件名可能是旧的：

| 新路径 | 旧路径 |
|--------|--------|
| `~\.openclawcn\` | `~\.clawdbot\` |
| `openclawcn.json` | `clawdbot.json` |
| 环境变量 `OPENCLAWCN_STATE_DIR` | 环境变量 `CLAWDBOT_STATE_DIR` |

**OpenClawCN 会自动兼容旧路径**——如果 `.openclawcn` 目录不存在但 `.clawdbot` 目录存在，程序会继续使用旧目录。查找优先级：

1. 环境变量 `OPENCLAWCN_STATE_DIR` / `CLAWDBOT_STATE_DIR`（如果设置了）
2. `~\.openclawcn\openclawcn.json`
3. `~\.openclawcn\clawdbot.json`（旧文件名在新目录）
4. `~\.clawdbot\openclawcn.json`（新文件名在旧目录）
5. `~\.clawdbot\clawdbot.json`（完全旧路径）

所以**无需手动迁移**，程序会自动找到你的配置文件。

---

## 手动指定配置路径

如果你希望将配置文件放在自定义位置，可以设置环境变量：

```powershell
# 指定配置文件完整路径
set OPENCLAWCN_CONFIG_PATH=D:\my-config\openclawcn.json

# 或者只指定状态目录（配置文件名仍为 openclawcn.json）
set OPENCLAWCN_STATE_DIR=D:\my-config
```

---

## 其他相关文件

除了主配置文件，以下文件也在同一目录下：

| 文件 | 用途 |
|------|------|
| `openclawcn.json` | 主配置文件（JSON5 格式，支持注释） |
| `.device_id` | 设备唯一标识 |
| `credentials/oauth.json` | OAuth 凭据（如果使用了 OAuth 认证） |
| `sessions/` | 会话历史记录 |
| `workspace/` | 默认工作区 |

---

## 常见问题

### Q: 配置文件不存在怎么办？

首次运行 `openclawcn setup` 会自动创建配置文件。如果要手动创建，新建一个空的 JSON5 文件即可：

```json5
{
  // OpenClawCN 配置
}
```

### Q: 修改配置后需要重启吗？

大部分配置支持热重载，修改后自动生效。少数配置（如 `gateway.port`、`gateway.bind`）需要重启服务。

### Q: 我同时安装了命令行版和安装包版，配置文件冲突吗？

不会冲突。两种安装方式使用不同目录。但如果你希望共享配置，可以通过环境变量 `OPENCLAWCN_CONFIG_PATH` 指向同一个文件。
