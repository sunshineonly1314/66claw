# Gitee Webhook 配置指南

CI/CD Webhook 服务器已启动，现在需要在 Gitee 仓库中配置 Webhook。

---

## 📋 配置信息

- **仓库地址**: https://gitee.com/sunshine1314/openclawcn
- **Webhook 服务器**: 已启动 (端口 8888)
- **密钥**: `clawdbot-ci-secret-2026`

---

## 🔧 配置步骤

### 步骤 1: 进入 Gitee Webhook 设置

1. 访问您的仓库: https://gitee.com/sunshine1314/openclawcn
2. 点击 **管理** 标签
3. 在左侧菜单选择 **WebHooks**
4. 点击 **添加 WebHook** 按钮

---

### 步骤 2: 填写 Webhook 配置

#### 🌐 URL 地址
```
http://您的公网IP:8888/webhook
```

**注意：**
- 如果在内网，需要配置端口转发或使用内网穿透工具（如 ngrok、frp）
- 或者使用您当前电脑的局域网 IP（仅限同一局域网）

#### 🔑 密码（WebHook 密码）
```
clawdbot-ci-secret-2026
```

#### 📌 触发事件
勾选以下选项：
- ✅ **Push** (代码推送)
- ✅ **Tag Push** (标签推送)

#### 🔍 其他选项
- SSL 验证: 如果使用 HTTP，取消勾选
- 激活: ✅ 勾选

---

### 步骤 3: 保存并测试

1. 点击 **添加** 按钮
2. 添加成功后，在 WebHooks 列表中找到刚才添加的 Webhook
3. 点击 **测试** 按钮
4. 选择 **Push** 事件测试

---

## 🧪 验证 Webhook

### 方式 1: 查看服务器日志

```bash
cd ci
tail -f logs/webhook-server.log
```

成功的日志应该显示：
```
[INFO] Received webhook request
[INFO] ✅ Build triggered
```

### 方式 2: 访问状态页面

打开浏览器访问: http://localhost:8888/status

---

## 🚀 触发构建

### 自动触发（推荐）

#### 方式 1: Commit 消息触发
在 commit message 中包含 `[build]` 标记：

```bash
git commit -m "feat: 新功能 [build]"
git push
```

**平台选择：**
- `feat: 功能 [build]` - 默认构建 Windows
- `feat: 功能 [build] windows` - 构建 Windows
- `feat: 功能 [build] macos` - 构建 macOS
- `feat: 功能 [build] all` - 构建所有平台

#### 方式 2: Tag 触发（正式发布）
推送版本标签自动触发全平台构建：

```bash
git tag v2026.2.18
git push origin v2026.2.18
```

---

### 手动触发

使用手动触发脚本：

```bash
cd ci

# 构建 Windows
bash trigger-build.sh --platform windows --mode standard

# 构建 macOS
bash trigger-build.sh --platform macos --arch universal

# 构建所有平台
bash trigger-build.sh --platform all --version 2026.2.18
```

---

## 📊 监控构建

### 实时查看日志

```bash
# Webhook 服务器日志
tail -f ci/logs/webhook-server.log

# Windows 构建日志
tail -f ci/logs/build-windows.log

# macOS 构建日志
tail -f ci/logs/build-macos.log
```

### 访问状态页面

浏览器打开: http://localhost:8888/status

显示内容：
- 构建机器状态
- 最近的构建日志
- 构建产物列表

---

## 🔧 管理命令

### 启动服务器
```bash
cd ci
bash start.sh
```

### 停止服务器
```bash
cd ci
bash stop.sh
```

### 查看状态
```bash
cd ci
bash status.sh
```

### 重启服务器
```bash
cd ci
bash stop.sh && bash start.sh
```

---

## 📦 构建产物位置

构建完成后，产物会保存在：

- **本地下载**: `ci/artifacts/`
  - Windows: `ci/artifacts/windows/`
  - macOS: `ci/artifacts/macos/`

- **Windows 构建机**: `E:\clawdbuild\`
- **Mac 构建机**: `~/cicd-workspace/openclawcn/build/output/`

---

## 🐛 故障排查

### Webhook 没有触发

1. **检查 Gitee Webhook 配置**
   - URL 是否正确
   - 密码是否匹配
   - 触发事件是否勾选

2. **检查服务器状态**
   ```bash
   bash status.sh
   ```

3. **查看日志**
   ```bash
   tail -f logs/webhook-server.log
   ```

### 构建失败

1. **检查 SSH 连接**
   ```bash
   bash status.sh
   ```
   确保 Windows 和 macOS 都显示 ✅ Connected

2. **检查 Gitee 认证**
   ```bash
   ssh SunBin@KEVINSUN "ssh -T git@gitee.com"
   ssh kevinsun@192.168.0.107 "ssh -T git@gitee.com"
   ```
   都应该显示 "successfully authenticated"

3. **查看构建日志**
   ```bash
   tail -f ci/logs/build-windows.log
   tail -f ci/logs/build-macos.log
   ```

---

## ✅ 快速检查清单

- [ ] Webhook 服务器正在运行 (`bash status.sh`)
- [ ] SSH 连接正常（Windows + macOS）
- [ ] Gitee SSH 认证成功
- [ ] Gitee Webhook 已配置
- [ ] Webhook 测试成功
- [ ] 已尝试手动触发构建

---

**配置完成时间**: 2026-02-18
**维护者**: ClawdbotCN Team

需要帮助？查看 [ci/README.md](README.md) 获取更多信息。
