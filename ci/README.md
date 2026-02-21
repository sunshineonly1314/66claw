# 本地 CI/CD 自动化打包方案

基于 Gitee + 局域网设备的自动化构建系统

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Gitee 仓库                            │
│  https://gitee.com/your-org/clawdbot                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Webhook (Push/Tag)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              控制服务器 (当前电脑)                            │
│  - 接收 Gitee Webhook                                        │
│  - 解析构建指令                                               │
│  - 分发构建任务                                               │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           │ SSH                      │ SSH
           ▼                          ▼
┌──────────────────────┐    ┌────────────────────────┐
│  Windows 笔记本       │    │  Mac Mini              │
│  KEVINSUN       │    │  192.168.0.107         │
│  - 拉取代码           │    │  - 拉取代码             │
│  - 执行 Windows 构建  │    │  - 执行 macOS 构建      │
│  - 上传制品           │    │  - 上传制品             │
└──────────────────────┘    └────────────────────────┘
```

---

## 📋 设备清单

| 设备 | IP | 用途 | 配置 |
|------|-----|------|------|
| **控制服务器** | 当前电脑 | Webhook 接收 + 任务分发 | - |
| **Windows 构建机** | KEVINSUN | Windows 打包 | - |
| **Mac Mini** | 192.168.0.107 | macOS 打包 | 4C8G Apple Silicon |

---

## 🔑 前置准备

### 1. SSH 免密登录配置

在**控制服务器**（当前电脑）执行：

```bash
# 生成 SSH 密钥（如果还没有）
ssh-keygen -t ed25519 -C "cicd@clawdbot"

# 将公钥复制到 Windows 笔记本
# 方法 1: 使用 ssh-copy-id (如果 Windows 支持)
ssh-copy-id username@KEVINSUN

# 方法 2: 手动复制（Windows）
# 1. 查看公钥
cat ~/.ssh/id_ed25519.pub
# 2. 在 Windows 上创建 C:\Users\username\.ssh\authorized_keys
# 3. 将公钥内容粘贴进去

# 将公钥复制到 Mac Mini
ssh-copy-id username@192.168.0.107

# 测试免密登录
ssh username@KEVINSUN "echo Windows OK"
ssh username@192.168.0.107 "echo Mac OK"
```

### 2. Gitee SSH 密钥配置

在 **Windows 笔记本** 和 **Mac Mini** 上分别执行：

```bash
# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub

# 复制公钥内容，添加到 Gitee
# 1. 登录 Gitee
# 2. 设置 → SSH 公钥
# 3. 粘贴公钥内容并保存

# 测试 Gitee 连接
ssh -T git@gitee.com
```

### 3. 在构建机上克隆仓库

**Windows 笔记本**:
```powershell
# 创建工作目录
mkdir D:\cicd-workspace
cd D:\cicd-workspace

# 克隆仓库
git clone git@gitee.com:your-org/clawdbot.git
cd clawdbot

# 安装依赖
pnpm install
```

**Mac Mini**:
```bash
# 创建工作目录
mkdir ~/cicd-workspace
cd ~/cicd-workspace

# 克隆仓库
git clone git@gitee.com:your-org/clawdbot.git
cd clawdbot

# 安装依赖
pnpm install
```

---

## 🚀 自动化流程

### 触发方式

#### 1️⃣ **Commit 触发**
```bash
# 包含 [build] 标记触发快速构建
git commit -m "feat: 新功能 [build]"
git push

# 指定平台
git commit -m "fix: Windows 修复 [build] windows"
git commit -m "feat: macOS 新功能 [build] macos"
```

#### 2️⃣ **Tag 触发**
```bash
# 推送 tag 触发正式发布
git tag v2026.2.18
git push origin v2026.2.18

# 自动构建全平台
```

#### 3️⃣ **手动触发**
```bash
# 在控制服务器执行
cd ci
./trigger-build.sh windows  # 构建 Windows
./trigger-build.sh macos    # 构建 macOS
./trigger-build.sh all      # 构建全平台
```

---

## 📦 构建输出

构建完成后，制品会自动收集到控制服务器：

```
ci/artifacts/
├── windows/
│   └── ClawdbotCN-Setup-2026.2.18-x64.exe
├── macos/
│   ├── ClawdbotCN-macOS-2026.2.18-universal.dmg
│   └── ClawdbotCN-macOS-2026.2.18-universal.dmg.sha256
└── build.log
```

---

## 🔧 配置文件

### ci/config.json

```json
{
  "gitee": {
    "repo": "https://gitee.com/your-org/clawdbot",
    "branch": "main"
  },
  "builders": {
    "windows": {
      "host": "KEVINSUN",
      "user": "username",
      "workspace": "D:\\cicd-workspace\\clawdbot",
      "output": "E:\\clawdbuild",
      "enabled": true
    },
    "macos": {
      "host": "192.168.0.107",
      "user": "username",
      "workspace": "~/cicd-workspace/clawdbot",
      "output": "~/cicd-workspace/clawdbot/build/output",
      "enabled": true
    }
  },
  "webhook": {
    "port": 8888,
    "secret": "your-webhook-secret"
  },
  "notification": {
    "email": "your-email@example.com",
    "slack_webhook": ""
  }
}
```

---

## 📊 监控和日志

### 查看实时日志

```bash
# 查看 Webhook 服务日志
tail -f ci/logs/webhook.log

# 查看 Windows 构建日志
tail -f ci/logs/build-windows.log

# 查看 macOS 构建日志
tail -f ci/logs/build-macos.log
```

### Web 监控界面（可选）

访问: `http://localhost:8888/status`

显示:
- 当前构建状态
- 构建历史
- 设备状态
- 制品下载

---

## 🛡️ 安全建议

1. **使用强密码**
   - SSH 密钥使用密码保护
   - Webhook secret 使用随机字符串

2. **限制网络访问**
   - Webhook 服务只监听内网
   - 使用防火墙规则限制访问

3. **定期备份**
   - 定期备份构建制品
   - 定期备份配置文件

4. **日志轮转**
   - 设置日志大小限制
   - 定期清理旧日志

---

## 🔍 故障排查

### Webhook 未触发

```bash
# 检查服务是否运行
ps aux | grep webhook-server

# 检查端口是否监听
netstat -tlnp | grep 8888

# 测试 Webhook
curl -X POST http://localhost:8888/webhook \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main"}'
```

### SSH 连接失败

```bash
# 测试连接
ssh -v username@KEVINSUN

# 检查 authorized_keys 权限
# 必须是 600 或 400
chmod 600 ~/.ssh/authorized_keys
```

### 构建失败

```bash
# 查看详细日志
cat ci/logs/build-windows.log
cat ci/logs/build-macos.log

# 手动登录构建机检查
ssh username@KEVINSUN
ssh username@192.168.0.107
```

---

## 📝 最佳实践

1. **使用 tmux/screen 保持 Webhook 服务运行**
   ```bash
   tmux new -s cicd
   node ci/webhook-server.js
   # Ctrl+B, D 分离会话
   ```

2. **设置构建超时**
   - Windows: 90 分钟
   - macOS: 60 分钟

3. **磁盘空间监控**
   ```bash
   # 定期清理旧制品（保留最近 10 个版本）
   ./ci/cleanup-artifacts.sh --keep 10
   ```

4. **构建前清理**
   ```bash
   # 每次构建前清理 node_modules
   # 确保使用最新依赖
   ```

---

**下一步**: 运行 `./ci/setup.sh` 开始配置自动化流程
