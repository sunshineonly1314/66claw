# ClawdBot CN 用户数据备份与迁移指南

> 适用版本：ClawdBot CN 所有版本
> 更新日期：2026-02-21

---

## 一、用户数据存储在哪里？

### Windows

| 数据类型 | 路径 |
|---------|------|
| **主数据目录**（最重要） | `C:\Users\<用户名>\.openclawcn\` |
| 配置文件 | `C:\Users\<用户名>\.openclawcn\openclawcn.json` |
| API 密钥 / 凭据 | `C:\Users\<用户名>\.openclawcn\credentials\` |
| OAuth 登录令牌 | `C:\Users\<用户名>\.openclawcn\credentials\oauth.json` |
| 智能体 / 对话记录 | `C:\Users\<用户名>\.openclawcn\agents\` |
| 技能数据库 | `C:\Users\<用户名>\AppData\Roaming\openclawcn\data\` |
| 桌面应用 Tauri 数据 | `C:\Users\<用户名>\AppData\Local\com.clawdbot.cn.desktop\` |
| 桌面应用日志 | `C:\Users\<用户名>\AppData\Local\com.clawdbot.cn.desktop\logs\` |
| 浏览器配置文件 | `C:\Users\<用户名>\.openclawcn\browser\` |

> **旧版本遗留目录**（升级后可能仍存在，程序会自动迁移）：
> - `C:\Users\<用户名>\.clawdbot\`
> - `C:\Users\<用户名>\.moldbot\`
> - `C:\Users\<用户名>\.moltbot\`

### macOS

| 数据类型 | 路径 |
|---------|------|
| **主数据目录**（最重要） | `~/.openclawcn/` |
| 配置文件 | `~/.openclawcn/openclawcn.json` |
| API 密钥 / 凭据 | `~/.openclawcn/credentials/` |
| OAuth 登录令牌 | `~/.openclawcn/credentials/oauth.json` |
| 智能体 / 对话记录 | `~/.openclawcn/agents/` |
| 技能数据库 | `~/.openclawcn/data/` |
| 桌面应用 Tauri 数据 | `~/Library/Application Support/com.clawdbot.cn.desktop/` |
| 桌面应用日志 | `~/Library/Logs/ClawdbotCN/` |
| 浏览器配置文件 | `~/.openclawcn/browser/` |

---

## 二、哪些数据最重要？

按优先级排序，以下内容**必须备份**：

| 优先级 | 内容 | 说明 |
|--------|------|------|
| ⭐⭐⭐ | `credentials/` | API 密钥、登录令牌，丢失后需重新配置所有服务 |
| ⭐⭐⭐ | `openclawcn.json` | 所有个性化设置和模型配置 |
| ⭐⭐ | `agents/` | 智能体配置、对话历史记录 |
| ⭐⭐ | `identity/` | 设备身份信息（影响授权） |
| ⭐ | `exec-approvals.json` | 已授权的命令执行记录 |
| ⭐ | `browser/` | 浏览器配置文件 |

---

## 三、如何备份？

### 方法一：手动备份（推荐，最可靠）

**Windows** — 在 PowerShell 中执行：

```powershell
# 备份主数据目录
$src = "$env:USERPROFILE\.openclawcn"
$dst = "$env:USERPROFILE\Desktop\clawdbot-backup-$(Get-Date -Format 'yyyyMMdd')"
Copy-Item -Recurse $src $dst

# 同时备份 AppData 中的技能数据
Copy-Item -Recurse "$env:APPDATA\openclawcn" "$dst\appdata-roaming"
Write-Host "备份完成，保存至：$dst"
```

**macOS** — 在终端中执行：

```bash
BACKUP_DIR="$HOME/Desktop/clawdbot-backup-$(date +%Y%m%d)"
cp -r ~/.openclawcn "$BACKUP_DIR"
echo "备份完成，保存至：$BACKUP_DIR"
```

### 方法二：使用内置备份功能

程序在卸载前会自动触发备份，将以下内容打包保存到桌面：

- `credentials/`
- `openclawcn.json`
- `identity/`
- `agents/`
- `exec-approvals.json`
- `oauth.json`

备份目录名格式：`openclawcn-backup-<时间戳>/`（桌面）

> 注意：此功能仅在**卸载流程**中触发，平时使用请用手动备份。

### 方法三：只备份关键文件（最小备份）

如果存储空间有限，只备份以下内容即可恢复大部分配置：

**Windows：**
```powershell
$dst = "$env:USERPROFILE\Desktop\clawdbot-minimal-backup"
New-Item -ItemType Directory -Force $dst
Copy-Item -Recurse "$env:USERPROFILE\.openclawcn\credentials" "$dst\"
Copy-Item "$env:USERPROFILE\.openclawcn\openclawcn.json" "$dst\"
Copy-Item -Recurse "$env:USERPROFILE\.openclawcn\agents" "$dst\"
```

**macOS：**
```bash
BACKUP_DIR="$HOME/Desktop/clawdbot-minimal-backup"
mkdir -p "$BACKUP_DIR"
cp -r ~/.openclawcn/credentials "$BACKUP_DIR/"
cp ~/.openclawcn/openclawcn.json "$BACKUP_DIR/"
cp -r ~/.openclawcn/agents "$BACKUP_DIR/"
```

---

## 四、如何恢复数据？

将备份目录的内容复制回原路径即可：

**Windows：**
```powershell
# 将备份内容还原到主数据目录
Copy-Item -Recurse "$env:USERPROFILE\Desktop\clawdbot-backup-*\*" "$env:USERPROFILE\.openclawcn\"
```

**macOS：**
```bash
cp -r ~/Desktop/clawdbot-backup-*/* ~/.openclawcn/
```

> 恢复后重新启动 ClawdBot CN 即可生效。

---

## 五、迁移到新电脑

1. 在旧电脑上完整备份主数据目录（见第三节方法一）
2. 在新电脑上安装 ClawdBot CN
3. 将备份文件夹复制到新电脑对应路径：
   - Windows：`C:\Users\<新用户名>\.openclawcn\`
   - macOS：`~/.openclawcn/`
4. 启动程序，配置和数据自动加载

> **跨平台迁移（Windows ↔ macOS）**：路径不同但数据结构相同，直接复制目录内容即可，无需额外转换。

---

## 六、常见问题

**Q：旧版本的 `.clawdbot` 目录还有用吗？**
A：程序启动时会自动检测并迁移到 `.openclawcn`，迁移后旧目录会保留为符号链接（Windows 为 NTFS junction），可以手动删除。

**Q：备份后能在不同账号下使用吗？**
A：`credentials/` 中的 API 密钥与账号绑定，迁移到不同账号需重新配置密钥。对话记录（`agents/`）可直接迁移。

**Q：`AppData\Local\com.clawdbot.cn.desktop\` 需要备份吗？**
A：该目录主要是 Tauri 框架的缓存和窗口状态，不包含用户核心数据，通常不需要备份。

**Q：如何确认备份是否完整？**
A：备份后检查以下文件是否存在：
- `openclawcn.json`（配置文件）
- `credentials/` 目录（非空）
- `agents/` 目录（如果有对话记录）

---

## 附录：完整数据路径速查

### Windows 完整路径表

```
%USERPROFILE%\.openclawcn\
├── openclawcn.json          # 主配置文件
├── credentials\             # API 密钥和登录凭据
│   └── oauth.json           # OAuth 令牌
├── agents\                  # 智能体数据
│   └── <agent-id>\
│       └── sessions\        # 对话历史
├── identity\                # 设备身份
├── exec-approvals.json      # 命令执行授权记录
├── browser\                 # 浏览器配置文件
└── desktop-debug.log        # 调试日志

%APPDATA%\openclawcn\
└── data\                    # 技能数据库

%LOCALAPPDATA%\com.clawdbot.cn.desktop\
├── logs\                    # 桌面应用日志
└── ...                      # Tauri 框架缓存
```

### macOS 完整路径表

```
~/.openclawcn/
├── openclawcn.json          # 主配置文件
├── credentials/             # API 密钥和登录凭据
│   └── oauth.json           # OAuth 令牌
├── agents/                  # 智能体数据
│   └── <agent-id>/
│       └── sessions/        # 对话历史
├── identity/                # 设备身份
├── exec-approvals.json      # 命令执行授权记录
├── browser/                 # 浏览器配置文件
├── data/                    # 技能数据库
└── desktop-debug.log        # 调试日志

~/Library/Application Support/com.clawdbot.cn.desktop/
└── ...                      # Tauri 框架缓存

~/Library/Logs/ClawdbotCN/
└── sidecar.log              # 桌面应用日志
```
