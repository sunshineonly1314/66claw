# Clawdbot Windows WSL 统一打包方案

## 概述

本文档描述 Clawdbot Windows 版本的统一打包方案，基于 WSL2 (Windows Subsystem for Linux) 技术实现。

### 设计理念

1. **一键安装**：用户只需点击"下一步"，无需了解任何技术细节
2. **透明运行**：WSL、Linux、镜像等概念对用户完全隐藏
3. **国内优化**：所有下载使用国内镜像，确保速度
4. **安全可控**：内置三种安全模式，满足不同用户需求

## 文件结构

```
build/
├── installer/
│   ├── clawdbot-windows-unified.iss    # Inno Setup 安装脚本
│   ├── ChineseSimplified.isl           # 中文语言文件
│   ├── icons/
│   │   ├── logo.ico                    # 应用图标
│   │   ├── wizard-image.bmp            # 安装向导大图
│   │   └── wizard-small.bmp            # 安装向导小图
│   └── scripts/
│       ├── setup-environment.ps1       # 环境配置脚本（核心）
│       └── uninstall.ps1               # 卸载脚本
├── scripts/windows/
│   ├── build-wsl-unified.ps1           # 打包脚本（生成 EXE）
│   ├── build-wsl-image.ps1             # WSL 镜像构建脚本
│   └── test-install.ps1                # 安装测试脚本
└── output/
    └── windows/
        └── ClawdbotCN-Setup-v{version}.exe
```

## 安装流程

### 用户视角

```
1. 下载安装程序 (~15MB)
   ↓
2. 双击运行，点击"下一步"
   ↓
3. 等待安装完成 (2-5分钟)
   - 显示进度条
   - 自动配置所有组件
   ↓
4. 点击"完成"，自动打开配置向导
   ↓
5. 在浏览器中完成配置
```

### 技术流程

```
[安装程序启动]
    ↓
[系统检查]
    - Windows 版本 ≥ 10 2004
    - 磁盘空间 ≥ 500MB
    - 虚拟化支持
    ↓
[WSL 检测与安装]
    - 检查 WSL 是否已安装
    - 未安装则自动启用 WSL 功能
    - 安装 WSL2 更新包
    ↓
[下载 Clawdbot WSL 镜像]
    - 从国内镜像下载 (~150MB)
    - 支持断点续传 (BITS)
    - 多镜像源自动切换
    ↓
[导入 WSL 发行版]
    wsl --import Clawdbot "C:\Clawdbot\wsl" image.tar.gz
    ↓
[配置国内镜像]
    - 写入 ~/.clawdbot/config.yaml
    - Skills: ClawdSkillsProxy (阿里云)
    - npm: npmmirror
    - pip: 清华镜像
    ↓
[创建启动脚本]
    - 启动Clawdbot.bat
    - 配置向导.bat
    - 状态检查.bat
    ↓
[完成]
```

## 国内镜像配置

### 镜像源列表

| 资源 | 镜像地址 | 备注 |
|-----|---------|------|
| WSL 镜像 | `https://oss.clawdbot.cn/wsl/` | 阿里云 OSS |
| WSL 备用 | `https://mirrors.aliyun.com/clawdbot/wsl/` | 阿里云公共镜像 |
| Skills | `http://121.43.61.90/api` | ClawdSkillsProxy |
| Node.js | `https://npmmirror.com/mirrors/node` | 淘宝镜像 |
| npm | `https://registry.npmmirror.com` | 淘宝镜像 |
| pip | `https://pypi.tuna.tsinghua.edu.cn/simple` | 清华镜像 |

### 配置文件

安装完成后，自动生成配置文件 `~/.clawdbot/config.yaml`：

```yaml
# Clawdbot 配置文件

# Skills 配置 - 使用国内 ClawdSkillsProxy 服务
skills:
  provider: clawdskillsproxy
  proxyUrl: http://121.43.61.90/api

# NPM 镜像 - 使用淘宝镜像
npm:
  registry: https://registry.npmmirror.com

# Python pip 镜像 - 使用清华镜像
pip:
  indexUrl: https://pypi.tuna.tsinghua.edu.cn/simple
  trustedHost: pypi.tuna.tsinghua.edu.cn

# 安全模式配置
securityMode: standard

# 工具配置
tools:
  exec:
    security: allowlist
    ask: on-miss
    safeBins:
      - notepad
      - explorer
      - code
      - python
      - node
      - npm
      - git
```

## 安全模式

### 三种模式

| 模式 | 名称 | 适用场景 | 安全级别 |
|-----|------|---------|---------|
| `full` | 完全保护 | 敏感数据电脑 | 🔒🔒🔒 |
| `standard` | 智能保护 | 日常工作电脑 | 🔒🔒 |
| `trust` | 关闭保护 | 开发者/极客 | 🔒 |

### 配置差异

#### 完全保护 (`full`)

```yaml
tools:
  exec:
    security: deny        # 拒绝所有命令执行
    host: sandbox         # 只在 WSL 内执行
wsl:
  mounts: []              # 不挂载 Windows 目录
```

#### 智能保护 (`standard`) - 默认

```yaml
tools:
  exec:
    security: allowlist   # 白名单模式
    ask: on-miss          # 未知命令询问用户
    safeBins: [...]       # 预置常用命令
wsl:
  mounts:
    - /mnt/c/Users/{user}/Documents:/home/clawdbot/documents:rw
```

#### 关闭保护 (`trust`)

```yaml
tools:
  exec:
    security: full        # 允许所有命令
    ask: off              # 不询问
wsl:
  mounts:
    - /mnt/c:/c:rw        # 完整挂载 C 盘
```

## 构建指南

### 前置条件

1. Windows 10/11
2. PowerShell 5.1+
3. Inno Setup 6 (自动安装)
4. Docker Desktop (仅构建 WSL 镜像时需要)

### 构建安装程序

```powershell
# 1. 构建 Clawdbot
cd d:\codeknowledge\clawdbot-main\clawdbot-main
pnpm install
pnpm build

# 2. 打包 EXE
.\build\scripts\windows\build-wsl-unified.ps1 -Version "2026.1.30"

# 输出: build\output\windows\ClawdbotCN-Setup-v2026.1.30.exe
```

### 构建 WSL 镜像

```powershell
# 需要 Docker Desktop
.\build\scripts\windows\build-wsl-image.ps1 -Version "2026.1.30"

# 输出: build\output\wsl\clawdbot-wsl-2026.1.30.tar.gz
```

### 上传到镜像服务器

```bash
# 上传 WSL 镜像到阿里云 OSS
aliyunoss cp clawdbot-wsl-2026.1.30.tar.gz oss://clawdbot-cn/wsl/

# 验证
curl -I https://oss.clawdbot.cn/wsl/clawdbot-wsl-2026.1.30.tar.gz
```

## 故障排除

### 常见问题

#### 1. 安装失败：WSL 功能无法启用

**原因**：BIOS 中未启用虚拟化

**解决**：
1. 重启电脑，进入 BIOS
2. 找到 Virtualization Technology / Intel VT-x / AMD-V
3. 设置为 Enabled
4. 保存并重启

#### 2. 下载失败：网络超时

**原因**：镜像服务器不可用

**解决**：
1. 检查网络连接
2. 手动下载镜像：`https://oss.clawdbot.cn/wsl/clawdbot-wsl-latest.tar.gz`
3. 放到 `%TEMP%` 目录，重新运行安装程序

#### 3. 启动失败：端口被占用

**原因**：18789 端口已被其他程序占用

**解决**：
```powershell
# 查看占用端口的程序
netstat -ano | findstr 18789

# 结束进程
taskkill /PID <进程ID> /F
```

### 日志位置

- 安装日志：`C:\Clawdbot\install.log`
- 运行日志：`C:\Clawdbot\logs\`
- 错误信息：`C:\Clawdbot\install-error.json`

## 版本历史

| 版本 | 日期 | 变更 |
|-----|------|------|
| 2026.1.30 | 2026-01-30 | 统一 WSL 打包方案，删除旧版本 |
| 2026.1.29 | 2026-01-29 | 添加国内镜像支持 |
