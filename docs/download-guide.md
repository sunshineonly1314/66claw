# Clawdbot 下载与安装指南

> 让 AI 助手成为你的得力助手，一份完整的安装配置指南

---

## 一、支持平台

Clawdbot 支持主流桌面操作系统，提供 **Lite（轻量版）** 和 **Pro（专业版）** 两种版本满足不同安全需求。

### 平台支持矩阵

| 平台 | 版本 | 架构支持 | 沙盒类型 | 安全等级 |
|------|------|---------|---------|---------|
| **Windows** | Lite | x64 | 轻量沙盒（目录隔离 + 命令过滤） | ⭐⭐⭐ |
| **Windows** | Pro | x64 | Docker 容器沙盒 | ⭐⭐⭐⭐⭐ |
| **macOS** | Lite | arm64 / x64 / Universal | 软沙盒（目录隔离） | ⭐⭐⭐ |
| **Linux** | Lite | x64 / arm64 | 轻量沙盒（chroot + 用户隔离） | ⭐⭐⭐ |
| **Linux** | Pro | x64 / arm64 | Docker 容器沙盒 | ⭐⭐⭐⭐⭐ |

### 版本对比

| 特性 | Lite 轻量版 | Pro 专业版 |
|------|------------|-----------|
| 安装体积 | **~25 MB** (EXE安装包) | ~25 MB + Docker |
| 首次运行 | 自动下载依赖（~2分钟） | 自动下载依赖 + Docker镜像 |
| 沙盒隔离 | 目录隔离 + 命令过滤 | 完整容器级隔离 |
| 安全等级 | 基础保护，适合日常使用 | 最高保护，适合敏感场景 |
| 系统依赖 | 无额外依赖 | 需要 Docker Desktop |
| 推荐用户 | 个人用户、快速上手 | 企业用户、高安全需求 |

### 系统要求

- **Node.js**: >= 22.12.0（使用一键脚本会自动安装）
- **操作系统**:
  - Windows 10/11 (64位)
  - macOS 11 Big Sur 及以上（Apple Silicon 或 Intel）
  - Linux（Ubuntu 20.04+、Debian 11+、RHEL 8+、Fedora 34+ 等主流发行版）

---

## 二、下载安装

### 方式一：EXE 安装包（Windows 推荐 ⭐）

最简单的方式，双击安装即可使用。

| 版本 | 下载链接 | 大小 | 说明 |
|------|---------|------|------|
| **Lite 轻量版** | [Clawdbot-Lite-Setup.exe](https://github.com/clawdbot/clawdbot/releases/latest) | ~25 MB | 推荐大多数用户 |
| **Pro 专业版** | [Clawdbot-Pro-Setup.exe](https://github.com/clawdbot/clawdbot/releases/latest) | ~25 MB | 需要 Docker Desktop |

**安装步骤：**
1. 下载 EXE 安装包
2. 双击运行，按向导安装
3. 安装完成后自动打开浏览器进入配置页面
4. 首次运行会自动下载依赖（约2-3分钟，使用国内镜像加速）

> 💡 EXE 安装包会创建桌面快捷方式、开始菜单项，支持开机自启。

---

### 方式二：一键安装脚本

自动完成环境检测和依赖安装。

**macOS / Linux**

```bash
curl -fsSL https://clawd.bot/install.sh | bash
```

**Windows（以管理员身份打开 PowerShell）**

```powershell
iwr -useb https://clawd.bot/install.ps1 | iex
```

### 方式二：npm 全局安装

适合已有 Node.js 环境的开发者。

```bash
# 使用 npm
npm install -g clawdbot@latest

# 或使用 pnpm
pnpm add -g clawdbot@latest
```

### 方式三：下载安装包

从发布页面下载对应平台的安装包：

| 平台 | 文件名 | 说明 |
|------|--------|------|
| **Windows Lite** | `Clawdbot-Lite-vX.X.X.zip` | 便携版，解压即用 |
| **Windows Lite** | `Clawdbot-Lite-Setup-vX.X.X.exe` | 安装程序版 |
| **Windows Pro** | `Clawdbot-Pro-Full-vX.X.X.exe` | 完整安装（含 Docker 环境） |
| **macOS (Apple Silicon)** | `ClawbotCN-macOS-vX.X.X-arm64.zip` | M1/M2/M3 芯片 |
| **macOS (Intel)** | `ClawbotCN-macOS-vX.X.X-x64.zip` | Intel 芯片 |
| **macOS (通用)** | `ClawbotCN-macOS-vX.X.X-universal.zip` | 兼容所有 Mac |
| **Linux (x64)** | `clawdbot-lite-vX.X.X-linux-x64.tar.gz` | 通用压缩包 |
| **Linux (DEB)** | `clawdbot-lite_X.X.X_amd64.deb` | Debian/Ubuntu |
| **Linux (RPM)** | `clawdbot-lite-X.X.X-1.x86_64.rpm` | RHEL/CentOS/Fedora |

---

## 三、安装向导

首次启动 Clawdbot 后，会自动打开 Web 配置向导（`http://localhost:端口/setup`），引导你完成全部配置。整个过程分为 **6 个步骤**：

```
Step 1        Step 2        Step 3        Step 4        Step 5        Step 6
AI服务    →   安全设置   →   工作目录   →   指挥渠道   →   产品验证   →   完成重启
选择配置      选择模式      设置目录      选择渠道      许可证验证     配置摘要
```

---

### Step 1：选择 AI 服务

配置你要使用的 AI 大模型平台。

#### 支持的 AI 平台

| 平台名称 | 特点 | 备注 |
|---------|------|------|
| **阿里云百炼** | 阿里云官方 AI 平台，支持通义系列模型 | 🔥 推荐，新用户送 100 万 Token |
| **硅基流动** | 国产 AI 聚合平台，支持多种模型 | 模型选择丰富 |
| **DeepSeek** | DeepSeek 官方 API | 高性价比 |
| **智谱 AI** | 智谱清言，支持 GLM 系列模型 | 中文理解能力强 |
| **火山引擎** | 字节跳动云平台，支持豆包模型 | 大厂稳定 |
| **腾讯混元** | 腾讯云 AI 平台 | 生态完善 |
| **MiniMax** | MiniMax 官方 API | 专注对话场景 |

#### 配置步骤

1. 选择你要使用的 AI 平台
2. 前往对应平台的控制台获取 API Key
3. 将 API Key 填入输入框
4. 点击「下一步」

> 💡 **新手推荐**：选择「阿里云百炼」，注册即送免费额度，快速体验。

---

### Step 2：安全设置

选择 AI 助手的权限级别，这是保护你数据安全的关键一步。

#### 什么是「沙盒」？

> 简单说：沙盒就像给 AI 画了个「活动范围」，它只能在这个范围里干活。超出范围的文件和操作，AI 碰不到，也改不了。

#### 三种安全模式

| 模式 | 图标 | 描述 | 适合场景 |
|------|------|------|---------|
| **完全保护** | 🛡️ | AI 的所有操作都在沙盒中进行，无法访问沙盒外的文件 | 电脑上有重要文件、多人共用设备 |
| **智能保护** | 🔒 | 直接对话时 AI 有正常权限，后台任务自动受沙盒限制 | ⭐ **推荐** · 日常工作电脑 |
| **关闭保护** | ⚡ | AI 拥有完整系统权限，解锁全部能力 | 独立设备、已备份、技术用户 |

#### 快速决策指引

- 这是我的**主力工作电脑** → 选「智能保护」
- 电脑上有**公司/客户数据** → 选「完全保护」
- **独立设备** + 我懂技术 → 可选「关闭保护」解锁全部能力

> ⚠️ **安全提示**：AI 助手存在「提示词注入」风险，恶意网页或文档可能诱导 AI 执行危险操作。强烈建议使用独立设备部署，或至少选择「智能保护」模式。

---

### Step 3：设置工作目录

指定 Clawdbot 可以操控的文件夹范围。

#### 主工作目录

这是 AI 助手的主要工作区域，AI 可以在此目录内自由读写文件。

| 平台 | 默认路径 |
|------|---------|
| Windows | `C:\Clawdbot\workspace` |
| macOS | `~/.clawbotcn/workspace` |
| Linux | `/opt/clawdbot/workspace` |

#### 额外信任目录（可选）

如果你需要 AI 访问其他文件夹，可以添加「额外信任目录」。

> ⚠️ **注意**：不要将「桌面」「文档」「下载」等系统目录设为工作目录，建议创建专用文件夹。

---

### Step 4：配置指挥渠道

选择你想要连接的聊天应用，让 AI 助手可以通过这些渠道接收指令。

#### 支持的渠道

| 渠道 | 状态 | 说明 |
|------|------|------|
| **钉钉** | ✅ 可用 | 通过钉钉机器人与 AI 助手对话 |
| **飞书** | ✅ 可用 | 通过飞书机器人与 AI 助手对话 |
| **企业微信** | 🔜 即将支持 | 通过企业微信自建应用对话 |

#### 配置说明

- 此步骤为**可选**，可以跳过稍后配置
- 选择渠道后，完成向导后需要前往「渠道」页面完成详细配置（填写 Webhook、AppID 等）

---

### Step 5：产品验证

激活你的 Clawdbot 许可证。

#### 获取许可证

前往闲鱼搜索「ClawbotCN」购买许可证 Token。

#### 验证步骤

1. 将购买获得的 Token 填入输入框
2. 点击「验证许可证」
3. 验证成功后自动进入下一步

#### 验证状态说明

| 状态 | 说明 |
|------|------|
| ⏳ 验证中 | 正在与服务器通信 |
| ✅ 验证成功 | 显示有效期，自动跳转下一步 |
| ❌ 验证失败 | 检查 Token 是否正确，或联系客服 |

---

### Step 6：完成重启

配置全部完成！

#### 配置摘要

向导会显示你的所有配置项：

- ✅ AI 服务：阿里云百炼
- ✅ 运行环境：Windows Lite（轻量沙盒）
- ✅ 安全模式：智能保护
- ✅ 工作目录：D:\clawdbot-workspace
- ✅ 额外信任目录：2 个目录
- ✅ 指挥渠道：钉钉、飞书
- ✅ 许可证：已激活（有效期至 2026年12月31日）

#### 重启并开始使用

点击「完成并重启」按钮，系统会保存配置并重启服务。重启成功后自动跳转到主页面，开始使用你的 AI 助手！

---

## 四、平台特定说明

### macOS 用户

- 如遇「无法验证开发者」提示，在终端执行：
  ```bash
  xattr -cr /Applications/ClawbotCN.app
  ```
- 工作目录默认位于：`~/.clawbotcn/workspace`

### Windows 用户

- **Lite 版**：通过开始菜单或桌面快捷方式启动
- **Pro 版**：请确保 Docker Desktop 正在运行，首次启动需拉取沙盒镜像（约 80MB）

### Linux 用户

```bash
# 启动服务
sudo systemctl start clawdbot

# 设置开机自启
sudo systemctl enable clawdbot

# 查看运行日志
journalctl -u clawdbot -f
```

---

## 五、常见问题

### Q: Lite 版和 Pro 版怎么选？

- **日常使用**：选 Lite 版，安装简单，资源占用少
- **高安全需求**：选 Pro 版，提供完整容器级隔离

### Q: 安全模式怎么选？

- 不确定就选**智能保护**，兼顾体验和安全
- 处理敏感数据选**完全保护**
- 技术用户在独立设备上可选**关闭保护**

### Q: 可以同时连接多个 AI 平台吗？

安装向导中只能配置一个主要平台，完成后可在设置中添加更多。

### Q: 指挥渠道必须配置吗？

不是必须的，可以跳过。你也可以直接通过 Web 界面与 AI 对话。

---

## 六、获取帮助

- Skills 仓库：`gitee.com/tecbinai/skills`
- 遇到问题？运行 `clawdbot doctor` 进行自检

---

*文档版本：1.0.0 | 更新日期：2026-01-29*
