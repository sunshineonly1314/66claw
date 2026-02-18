# ClawdbotCN 本地 CI/CD 系统 - 完整配置指南

## 🎉 系统配置完成！

您的本地 CI/CD 自动化构建系统已经配置完成。

---

## ✅ 已完成的配置

### 1️⃣ SSH 免密登录
- ✅ 控制机 → Windows 笔记本 (192.168.0.103)
- ✅ 控制机 → Mac Mini (192.168.0.107)

### 2️⃣ Gitee SSH 认证
- ✅ Windows 笔记本 ↔ Gitee (sunshine1314)
- ✅ Mac Mini ↔ Gitee (sunshine1314)
- ✅ 仓库: https://gitee.com/sunshine1314/openclawcn

### 3️⃣ CI/CD 服务器
- ✅ Webhook 服务器运行中 (端口 8888)
- ✅ 配置文件: `ci/config.json`
- ✅ 日志目录: `ci/logs/`

### 4️⃣ 构建脚本
- ✅ Windows 远程构建: `ci/build-windows.sh`
- ✅ macOS 远程构建: `ci/build-macos.sh`
- ✅ 手动触发脚本: `ci/trigger-build.sh`
- ✅ 管理脚本: `start.sh`, `stop.sh`, `status.sh`

---

## 🚀 使用方式

### 自动触发（推荐）

#### 方式 1: Commit 消息触发

在 commit message 中添加 `[build]` 标记：

```bash
# 默认构建 Windows
git commit -m "feat: 新功能 [build]"
git push

# 指定平台
git commit -m "feat: macOS 功能 [build] macos"
git push

# 构建所有平台
git commit -m "feat: 重要更新 [build] all"
git push
```

#### 方式 2: Tag 触发（正式发布）

推送版本标签自动触发全平台构建：

```bash
git tag v2026.2.18
git push origin v2026.2.18
```

---

### 手动触发

使用命令行触发构建：

```bash
cd ci

# 构建 Windows（自动确认）
bash trigger-build.sh --platform windows --yes

# 构建 macOS
bash trigger-build.sh --platform macos --yes

# 构建所有平台，指定版本
bash trigger-build.sh --platform all --version 2026.2.18 --yes

# Windows 完整版
bash trigger-build.sh --platform windows --mode full --yes
```

**参数说明：**
- `--platform`: 构建平台 (windows/macos/all)
- `--version`: 版本号 (可选)
- `--mode`: Windows 模式 (standard/full)
- `--arch`: macOS 架构 (universal/arm64/x64)
- `--yes`: 自动确认，不提示

---

## 📊 监控和管理

### 查看系统状态

```bash
cd ci
bash status.sh
```

显示内容：
- Webhook 服务器状态
- 构建机器 SSH 连接状态
- 最近的构建日志

### 查看实时日志

```bash
# Webhook 服务器日志
tail -f ci/logs/webhook-server.log

# Windows 构建日志
tail -f ci/logs/build-windows-*.log

# macOS 构建日志
tail -f ci/logs/build-macos-*.log
```

### 访问状态页面

浏览器打开: http://localhost:8888/status

显示：
- 构建机器状态
- 最近的日志
- 构建产物列表

---

## 🔧 管理命令

### 启动/停止服务器

```bash
cd ci

# 启动
bash start.sh

# 停止
bash stop.sh

# 重启
bash stop.sh && bash start.sh

# 查看状态
bash status.sh
```

---

## 📦 构建产物位置

构建完成后，产物保存在：

### 本地（控制机）
- Windows: `ci/artifacts/windows/`
- macOS: `ci/artifacts/macos/`

### Windows 构建机 (192.168.0.103)
- 位置: `E:\clawdbuild\`
- 文件: `ClawdbotCN-Setup-*.exe`

### Mac 构建机 (192.168.0.107)
- 位置: `~/cicd-workspace/openclawcn/build/output/`
- 文件: `ClawdbotCN-macOS-*.dmg`

---

## ⚙️ Gitee Webhook 配置

### 配置步骤

1. 访问: https://gitee.com/sunshine1314/openclawcn/hooks
2. 点击 **添加 WebHook**
3. 填写：
   - URL: `http://您的公网IP:8888/webhook`
   - 密码: `clawdbot-ci-secret-2026`
   - 触发事件: ✅ Push + ✅ Tag Push
4. 点击 **添加**

### 内网访问说明

如果在内网，需要：
- **方案 1**: 配置端口转发（路由器）
- **方案 2**: 使用内网穿透工具（ngrok、frp、花生壳）
- **方案 3**: 仅使用手动触发构建（不配置 Webhook）

---

## 🐛 常见问题

### Windows 防火墙阻止

**问题**: Windows 弹出防火墙提示，阻止 Node.js

**解决**: 在 Windows 笔记本上点击"允许访问"，允许 Node.js JavaScript Runtime 访问网络

### SSH 连接失败

**问题**: `Permission denied` 或连接超时

**解决**:
```bash
# 检查 SSH 连接
bash status.sh

# 重新配置 SSH（如需要）
ssh-copy-id SunBin@192.168.0.103
ssh-copy-id kevinsun@192.168.0.107
```

### Gitee 认证失败

**问题**: `git@gitee.com: Permission denied`

**解决**:
```bash
# 在构建机器上测试
ssh SunBin@192.168.0.103 "ssh -T git@gitee.com"
ssh kevinsun@192.168.0.107 "ssh -T git@gitee.com"

# 应该显示: "successfully authenticated"
```

### 构建失败

**检查步骤**:
1. 查看构建日志: `tail -f ci/logs/build-*.log`
2. 检查 SSH 连接: `bash status.sh`
3. 验证 Gitee 连接（见上）
4. 检查磁盘空间: `ssh SunBin@192.168.0.103 "dir E:\"`

---

## 📋 快速命令参考

```bash
# 启动 CI/CD 系统
cd ci && bash start.sh

# 查看状态
bash status.sh

# 手动触发 Windows 构建
bash trigger-build.sh --platform windows --yes

# 手动触发 macOS 构建
bash trigger-build.sh --platform macos --yes

# 查看实时日志
tail -f logs/webhook-server.log

# 停止系统
bash stop.sh
```

---

## 📚 相关文档

- [Webhook 配置指南](WEBHOOK_SETUP_GUIDE.md)
- [Gitee SSH 配置](GITEE_SSH_SETUP_GUIDE.md)
- [CI/CD 详细说明](README.md)

---

## 🎯 下一步

1. ✅ **测试手动构建** - 验证系统是否正常工作
2. ⏳ **配置 Gitee Webhook** - 实现自动触发构建
3. ✅ **测试自动触发** - 提交代码验证自动构建

---

**配置完成时间**: 2026-02-18
**系统版本**: v1.0.0
**维护者**: ClawdbotCN Team

🎉 **恭喜！您的本地 CI/CD 自动化构建系统已经就绪！**
