# 🚀 CI/CD 快速开始指南

5 分钟快速上手 ClawdbotCN 本地 CI/CD 自动化构建系统！

---

## ✅ 系统已就绪

- ✅ Webhook 服务器运行中
- ✅ SSH 连接已配置
- ✅ Gitee 认证完成
- ✅ 构建脚本就绪

---

## 🎯 现在就开始！

### 方式 1: 手动触发构建（最简单）

打开终端，执行：

```bash
cd d:/codeknowledge/clawdbot-main/clawdbot-main/ci

# 构建 Windows
bash trigger-build.sh --platform windows --yes

# 构建 macOS
bash trigger-build.sh --platform macos --yes

# 同时构建两个平台
bash trigger-build.sh --platform all --yes
```

**构建时间：** Windows ~30-60分钟，macOS ~20-40分钟

**产物位置：**
- 本地: `ci/artifacts/windows/` 和 `ci/artifacts/macos/`
- Windows 机: `E:\clawdbuild\`
- Mac 机: `~/cicd-workspace/openclawcn/build/output/`

---

### 方式 2: Commit 自动触发（全自动）

#### 步骤 1: 配置 Gitee Webhook（一次性）

1. 访问: https://gitee.com/sunshine1314/openclawcn/hooks
2. 点击 **添加 WebHook**
3. 填写：
   - **URL**: `http://你的公网IP:8888/webhook`
   - **密码**: `clawdbot-ci-secret-2026`
   - **触发事件**: ✅ Push + ✅ Tag Push
4. 点击 **添加**

> 💡 如果在内网，可以跳过这步，只使用手动触发

#### 步骤 2: 提交代码触发构建

```bash
# 在 commit message 中加 [build]
git commit -m "feat: 新功能 [build]"
git push

# 指定平台
git commit -m "fix: Windows 修复 [build] windows"
git push

# 正式发布（全平台）
git tag v2026.2.18
git push origin v2026.2.18
```

**自动流程：**
1. 推送代码到 Gitee
2. Gitee Webhook 通知本地服务器
3. 服务器解析构建指令
4. 自动连接构建机器
5. 拉取代码并构建
6. 下载构建产物

---

## 📊 监控构建进度

### 查看实时状态

```bash
cd ci

# 查看系统状态
bash status.sh

# 查看实时日志
tail -f logs/webhook-server.log
tail -f logs/build-windows-*.log
tail -f logs/build-macos-*.log
```

### 浏览器查看

访问: http://localhost:8888/status

---

## 🔧 常用命令

```bash
cd ci

# 启动服务器
bash start.sh

# 停止服务器
bash stop.sh

# 查看状态
bash status.sh

# Windows 标准版
bash trigger-build.sh --platform windows --yes

# Windows 完整版（包含所有 skills）
bash trigger-build.sh --platform windows --mode full --yes

# macOS Universal 二进制
bash trigger-build.sh --platform macos --arch universal --yes

# 指定版本号
bash trigger-build.sh --platform all --version 2026.2.18 --yes
```

---

## ⚡ 构建示例

### 示例 1: 快速测试 Windows 构建

```bash
cd ci
bash trigger-build.sh --platform windows --yes
```

**预期输出：**
```
🚀 手动触发构建
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Platform:      windows
  Version:       auto
  Windows Mode:  standard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Auto-confirmed, starting build...

🪟 Starting Windows build...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target: SunBin@KEVINSUN
Workspace: D:\cicd-workspace\openclawcn
...
```

### 示例 2: 发布正式版本

```bash
# 1. 更新版本号
cd d:/codeknowledge/clawdbot-main/clawdbot-main
npm version 2026.2.18

# 2. 提交并打标签
git add .
git commit -m "chore: release v2026.2.18"
git tag v2026.2.18

# 3. 推送（自动触发构建）
git push --follow-tags

# 4. 等待构建完成（或手动触发）
cd ci
bash trigger-build.sh --platform all --version 2026.2.18 --yes
```

---

## 🐛 遇到问题？

### Windows 防火墙阻止

**现象**: Windows 弹出防火墙提示

**解决**: 点击"允许访问"，允许 Node.js 访问网络

### 构建失败

**检查步骤**:

1. 查看日志
   ```bash
   tail -f ci/logs/build-windows-*.log
   ```

2. 检查连接
   ```bash
   bash status.sh
   ```

3. 验证 Gitee
   ```bash
   ssh SunBin@KEVINSUN "ssh -T git@gitee.com"
   ssh kevinsun@192.168.0.107 "ssh -T git@gitee.com"
   ```

---

## 📚 完整文档

- [完整使用指南](README-FINAL.md) - 详细功能说明
- [Webhook 配置](WEBHOOK_SETUP_GUIDE.md) - Gitee Webhook 设置
- [系统说明](README.md) - 架构和原理

---

## 💡 小贴士

1. **第一次构建**: 会比较慢（需要安装依赖），后续会快很多
2. **磁盘空间**: Windows 机器确保 E:\ 有足够空间（约 5GB）
3. **网络稳定**: 构建过程需要从 Gitee 拉取代码，确保网络畅通
4. **并行构建**: 可以同时构建 Windows 和 macOS（`--platform all`）

---

**准备好了吗？运行第一个构建：**

```bash
cd ci
bash trigger-build.sh --platform windows --yes
```

🎉 享受全自动化构建的便利吧！
