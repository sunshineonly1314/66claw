---
name: pm2
name_zh: PM2
description: 使用 PM2 进程管理器管理 Node.js 应用程序。适用于生产环境中部署、监控及自动重启 Node 应用。涵盖应用启动、日志查看、开机自启配置以及多进程管理等功能。
description_zh: 使用 PM2 进程管理器管理 Node.js 应用程序。适用于生产环境中部署、监控及自动重启 Node 应用。涵盖应用启动、日志查看、开机自启配置以及多进程管理等功能。
---
# PM2 进程管理器

具备内置负载均衡功能的 Node.js 生产级进程管理器。

## 安装

```bash
npm install -g pm2
```

## 快速开始

```bash
# Start an app
pm2 start app.js
pm2 start npm --name "my-app" -- start
pm2 start "npm run start" --name my-app

# With specific port/env
pm2 start npm --name "my-app" -- start -- --port 3000
PORT=3000 pm2 start npm --name "my-app" -- start
```

## 常用命令

```bash
# List processes
pm2 list
pm2 ls

# Logs
pm2 logs              # All logs
pm2 logs my-app       # Specific app
pm2 logs --lines 100  # Last 100 lines

# Control
pm2 restart my-app
pm2 stop my-app
pm2 delete my-app
pm2 reload my-app     # Zero-downtime reload

# Info
pm2 show my-app
pm2 monit             # Real-time monitor
```

## 开机自启配置

```bash
# Save current process list
pm2 save

# Generate startup script (run the output command with sudo)
pm2 startup

# Example output - run this:
# sudo env PATH=$PATH:/opt/homebrew/bin pm2 startup launchd -u username --hp /Users/username
```

## Next.js / 生产构建

```bash
# Build first
npm run build

# Start production server
pm2 start npm --name "my-app" -- start

# Or with ecosystem file
pm2 start ecosystem.config.js
```

## 生态系统配置文件（ecosystem.config.js）

```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

## 有用参数（Flags）

| 参数 | 描述 |
|------|------|
| `--name` | 进程名称 |
| `--watch` | 文件变更时自动重启 |
| `-i max` | 集群模式（使用全部 CPU 核心） |
| `--max-memory-restart 200M` | 内存超限时自动重启 |
| `--cron "0 * * * *"` | 按计划定时重启 |

## 清理

```bash
pm2 delete all        # Remove all processes
pm2 kill              # Kill PM2 daemon
pm2 unstartup         # Remove startup script
```