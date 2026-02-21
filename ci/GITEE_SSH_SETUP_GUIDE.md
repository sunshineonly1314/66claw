# Gitee SSH 密钥配置详细操作指南

## 📋 需要添加的 SSH 公钥

### 🪟 Windows 构建机公钥
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAyWMIjJcsf5xyth4mha0hF6D1OcUfXQSkO4oa7mfOR clawdbot-ci-windows
```

### 🍎 macOS 构建机公钥
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICCHbLUF/U8W1GS+HEYcSv+p+e+K1pT6sr+e5BIWmh99 clawdbot-ci-macos
```

---

## 🎯 操作步骤（超详细版）

### 步骤 1: 登录 Gitee

1. 打开浏览器，访问 **https://gitee.com**
2. 点击右上角 **登录** 按钮
3. 输入您的账号密码登录

---

### 步骤 2: 进入 SSH 公钥管理页面

**方法一：直接访问链接（推荐）**
```
https://gitee.com/profile/sshkeys
```

**方法二：通过菜单导航**
1. 登录后，点击右上角的 **头像**
2. 在下拉菜单中选择 **设置**
3. 在左侧菜单栏找到 **安全设置** → **SSH 公钥**

---

### 步骤 3: 添加第一个 SSH 公钥（Windows 构建机）

1. 在 "SSH 公钥" 页面，点击右上角的 **添加公钥** 按钮

2. 在弹出的表单中填写：

   **标题：**
   ```
   ClawdbotCN-Windows-CI (KEVINSUN)
   ```

   **公钥：**
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAyWMIjJcsf5xyth4mha0hF6D1OcUfXQSkO4oa7mfOR clawdbot-ci-windows
   ```

3. 点击 **确定** 按钮

4. 如果提示输入密码，输入您的 Gitee 登录密码验证

5. 看到提示 "添加成功" 即可

---

### 步骤 4: 添加第二个 SSH 公钥（macOS 构建机）

1. 继续在 "SSH 公钥" 页面，再次点击 **添加公钥** 按钮

2. 在弹出的表单中填写：

   **标题：**
   ```
   ClawdbotCN-macOS-CI (192.168.0.107)
   ```

   **公钥：**
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICCHbLUF/U8W1GS+HEYcSv+p+e+K1pT6sr+e5BIWmh99 clawdbot-ci-macos
   ```

3. 点击 **确定** 按钮

4. 再次验证密码（如需要）

5. 看到提示 "添加成功" 即可

---

### 步骤 5: 验证公钥是否添加成功

添加完成后，您应该能在 "SSH 公钥" 列表中看到两个密钥：

```
✓ ClawdbotCN-Windows-CI (KEVINSUN)
  公钥指纹: SHA256:xxxxxxxx
  添加时间: 2026-02-18

✓ ClawdbotCN-macOS-CI (192.168.0.107)
  公钥指纹: SHA256:xxxxxxxx
  添加时间: 2026-02-18
```

---

## 🧪 测试 SSH 连接

### 在 Windows 笔记本上测试

1. 在 Windows 笔记本上打开 **PowerShell** 或 **Git Bash**

2. 执行命令：
   ```bash
   ssh -T git@gitee.com
   ```

3. 如果首次连接，会提示：
   ```
   The authenticity of host 'gitee.com (xxx.xxx.xxx.xxx)' can't be established.
   Are you sure you want to continue connecting (yes/no)?
   ```
   **输入 `yes` 并回车**

4. 成功的响应：
   ```
   Hi <你的用户名>! You've successfully authenticated, but Gitee.com does not provide shell access.
   ```

---

### 在 Mac Mini 上测试

1. 在 Mac Mini 上打开 **终端 (Terminal)**

2. 执行命令：
   ```bash
   ssh -T git@gitee.com
   ```

3. 同样，首次连接会提示确认，输入 `yes`

4. 看到成功消息即表示配置正确

---

## ⚠️ 常见问题

### 问题 1: 提示 "公钥格式不正确"

**原因：** 复制公钥时可能包含了多余的空格或换行

**解决方法：**
1. 重新复制公钥（确保完整复制，从 `ssh-ed25519` 开始到最后）
2. 不要包含任何多余的空格或换行符
3. 可以先粘贴到记事本检查，再复制到 Gitee

---

### 问题 2: 测试时提示 "Permission denied (publickey)"

**可能原因：**
1. 公钥没有正确添加到 Gitee
2. 本地 SSH 密钥文件位置不对

**解决方法：**
1. 检查 Gitee 上的公钥是否完整
2. 确认本地密钥在正确位置：
   - Windows: `C:\Users\SunBin\.ssh\id_ed25519`
   - macOS: `/Users/kevinsun/.ssh/id_ed25519`

---

### 问题 3: 提示 "已存在相同的公钥"

**原因：** 该公钥已经被其他账户或仓库使用

**解决方法：**
1. 检查是否之前已添加过
2. 如果是误删，可以直接重新添加
3. 一个公钥只能在一个 Gitee 账户中使用

---

## ✅ 配置完成检查清单

完成以下所有步骤，即表示配置成功：

- [ ] 已登录 Gitee 账户
- [ ] Windows SSH 公钥已添加（标题：ClawdbotCN-Windows-CI）
- [ ] macOS SSH 公钥已添加（标题：ClawdbotCN-macOS-CI）
- [ ] 在 Windows 上执行 `ssh -T git@gitee.com` 成功
- [ ] 在 Mac 上执行 `ssh -T git@gitee.com` 成功
- [ ] 已更新 `ci/config.json` 中的 Gitee 仓库地址

---

## 📝 下一步

配置完成后，您就可以：

1. **启动 CI/CD Webhook 服务器：**
   ```bash
   cd ci
   bash start.sh
   ```

2. **配置 Gitee Webhook**（见 [WEBHOOK_SETUP_GUIDE.md](WEBHOOK_SETUP_GUIDE.md)）

3. **测试自动构建流程**

---

**最后更新：** 2026-02-18
**有任何问题？** 请参考 [ci/README.md](README.md) 获取更多帮助
