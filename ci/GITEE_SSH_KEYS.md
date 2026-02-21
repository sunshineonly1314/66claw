# Gitee SSH 密钥配置

请将以下 SSH 公钥添加到您的 Gitee 账户。

## 📝 操作步骤

1. 登录 Gitee: https://gitee.com
2. 进入 **设置** → **SSH 公钥** → **添加公钥**
3. 分别添加以下两个公钥

---

## 🪟 Windows 构建机 SSH 公钥

**标题**: `ClawdbotCN-Windows-CI (KEVINSUN)`

**公钥内容**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAyWMIjJcsf5xyth4mha0hF6D1OcUfXQSkO4oa7mfOR clawdbot-ci-windows
```

---

## 🍎 macOS 构建机 SSH 公钥

**标题**: `ClawdbotCN-macOS-CI (192.168.0.107)`

**公钥内容**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICCHbLUF/U8W1GS+HEYcSv+p+e+K1pT6sr+e5BIWmh99 clawdbot-ci-macos
```

---

## ✅ 验证配置

添加完成后，在对应的机器上测试 Gitee 连接：

### Windows 笔记本验证
```powershell
ssh -T git@gitee.com
```

### Mac Mini 验证
```bash
ssh -T git@gitee.com
```

成功的响应应该是：
```
Hi <username>! You've successfully authenticated, but Gitee.com does not provide shell access.
```

---

## 📋 配置完成检查清单

- [ ] Windows SSH 公钥已添加到 Gitee
- [ ] macOS SSH 公钥已添加到 Gitee
- [ ] Windows 已验证 Gitee 连接成功
- [ ] macOS 已验证 Gitee 连接成功
- [ ] 已更新 `ci/config.json` 中的 Gitee 仓库地址

---

**生成时间**: 2026-02-18
**有效机器**:
- Windows: SunBin@KEVINSUN (192.168.0.102)
- macOS: kevinsun@192.168.0.107
