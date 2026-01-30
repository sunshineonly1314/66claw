# Clawdbot 自动部署脚本

本目录包含用于将 Clawdbot 打包并部署到 WSL Ubuntu 的脚本。

## 目录结构

```
nativedeploy/
├── deploy.ps1       # 主部署脚本 (WSL 本地部署)
├── deploy-ssh.ps1   # SSH 部署脚本 (远程 SSH 部署)
├── setup.sh         # WSL 环境安装脚本
├── start.sh         # 服务启动脚本
├── stop.sh          # 服务停止脚本
├── status.sh        # 服务状态检查脚本
└── README.md        # 本说明文档
```

## 快速开始

### 方法 1: WSL 本地部署 (推荐)

在 Windows PowerShell 中运行:

```powershell
cd d:\codeknowledge\clawdbot-main\clawdbot-main
.\nativedeploy\deploy.ps1
```

### 方法 2: SSH 远程部署

如果需要通过 SSH 部署到 WSL:

```powershell
.\nativedeploy\deploy-ssh.ps1 -SSHHost "kevinUp" -SSHUser "kslinux"
```

## 部署参数

### deploy.ps1

| 参数 | 默认值 | 说明 |
|------|--------|------|
| -SkipBuild | false | 跳过构建步骤 |
| -OnlyBuild | false | 仅构建，不部署 |
| -WSLHost | kevinUp | WSL 主机名 |
| -WSLUser | kslinux | WSL 用户名 |
| -RemotePath | /home/clawdbot | 部署目标路径 |

### deploy-ssh.ps1

| 参数 | 默认值 | 说明 |
|------|--------|------|
| -SkipBuild | false | 跳过构建步骤 |
| -OnlyBuild | false | 仅构建，不部署 |
| -SSHHost | kevinUp | SSH 主机名 |
| -SSHUser | kslinux | SSH 用户名 |
| -SSHPassword | sunbingood123 | SSH 密码 |
| -RemotePath | /home/clawdbot | 部署目标路径 |

## WSL 服务管理

部署完成后，在 WSL 中管理服务:

```bash
cd /home/clawdbot

# 启动服务
./start.sh

# 停止服务
./stop.sh

# 查看状态
./status.sh
```

或从 Windows PowerShell:

```powershell
# 启动
wsl -u kslinux bash -c 'cd /home/clawdbot && ./start.sh'

# 停止
wsl -u kslinux bash -c 'cd /home/clawdbot && ./stop.sh'

# 状态
wsl -u kslinux bash -c 'cd /home/clawdbot && ./status.sh'
```

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 18789 | Gateway | 主要 API 端口 |
| 18790 | Bridge | 桥接服务端口 |

## Windows 访问

WSL 端口会自动转发到 Windows localhost，可直接访问:

- Gateway: http://localhost:18789
- Bridge: http://localhost:18790

## 配置文件

部署后的配置文件位置:

- 环境配置: `/home/clawdbot/.env`
- Clawdbot 配置: `~/.clawdbot/`
- 工作目录: `~/clawd/`
- 日志文件: `/home/clawdbot/logs/gateway.log`

## systemd 服务 (可选)

如果 WSL 支持 systemd，可以使用 systemd 管理服务:

```bash
# 启用服务
systemctl --user enable clawdbot-gateway

# 启动服务
systemctl --user start clawdbot-gateway

# 查看状态
systemctl --user status clawdbot-gateway

# 查看日志
journalctl --user -u clawdbot-gateway -f
```

## 故障排除

### 端口被占用

```bash
# 查看端口占用
ss -tlnp | grep 18789

# 终止占用进程
./stop.sh
```

### Node.js 版本过低

```bash
# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules
pnpm install --frozen-lockfile
```

### WSL 网络问题

确保 WSL 网络正常:

```bash
# 检查网络
ping -c 1 google.com

# 重启 WSL (在 Windows 中)
wsl --shutdown
wsl
```

## 安全提示

- 生产环境请修改默认密码
- 建议使用 SSH 密钥认证替代密码
- 配置防火墙限制端口访问
- 不要在公网暴露服务端口
