# 迁移指南：frp → SSH 反向隧道

## 为什么迁移

frp 的安全风险：
- frps 7000 端口暴露公网，协议曾有漏洞
- `auth.token` 明文静态，泄露即可被任意连接
- 6022/6023 SSH 端口裸暴露公网，可被扫描暴力破解
- 9999 webhook 走明文 HTTP

SSH 反向隧道的优势：
- 253 只开 22 端口，攻击面极小
- SSH 本身加密，无明文流量
- 无第三方组件（frps/frpc），无额外漏洞
- key-only 认证，无暴力破解可能

## 架构对比

```
旧（frp）：
  Gitee → 253:9999(明文) → frps:7000 → frpc → 本地:8888
  远程SSH → 253:6022 → frps:7000 → frpc → 本地:22

新（SSH 隧道）：
  Gitee → 253:9999 → [SSH加密隧道] → 本地:8888
  远程SSH → 253:6022 → [SSH加密隧道] → 本地:22

253 端口变化：
  关闭：7000（frp 控制）
  保留：22（SSH）、9999（webhook，隧道暴露）、6022（SSH 转发）
```

## 迁移步骤

### Step 1：阿里云 253 服务端

SSH 登录 253，执行：

```bash
# 上传脚本
scp ci/aliyun-migrate-frp-to-ssh.sh root@106.15.198.253:/root/

# 执行
ssh root@106.15.198.253 'bash /root/aliyun-migrate-frp-to-ssh.sh'
```

该脚本会：
1. 停止并备份 frps
2. 配置 sshd（GatewayPorts、心跳保活）
3. 加固 SSH（禁密码、限尝试次数）
4. 收紧防火墙（关 7000）
5. 备份 frps 文件到 `/root/frps-backup-*`

### Step 2：Windows 本地

```powershell
# 1. 注册新的开机启动项（同时清理旧 frpc）
powershell -File ci\register-startup-ssh.ps1

# 2. 立即启动 SSH 隧道
Start-Process powershell -ArgumentList '-File', 'ci\ssh-tunnel-loop.ps1' -WindowStyle Hidden

# 3. 验证
powershell -File ci\check-status-ssh.ps1
```

### Step 3：验证

```powershell
# 检查隧道是否通
ci\check-status-ssh.ps1

# 手动验证 webhook 可达
curl http://106.15.198.253:9999/health
```

## 新文件清单

| 文件 | 用途 |
|------|------|
| `ssh-tunnel-loop.ps1` | SSH 反向隧道守护（替代 `frpc-loop.ps1`） |
| `register-startup-ssh.ps1` | 开机启动注册（替代 `register-startup.ps1`） |
| `check-status-ssh.ps1` | 状态检查（替代 `check-status.ps1`） |
| `aliyun-migrate-frp-to-ssh.sh` | 253 服务端迁移脚本（一次性执行） |

## 旧文件（迁移后可删除）

| 文件 | 说明 |
|------|------|
| `frpc.toml` | frp 客户端配置 |
| `frpc-loop.ps1` | frpc 守护循环 |
| `frpc-loop.cmd` | frpc 守护 CMD 版 |
| `start-frpc.ps1` | frpc 启动脚本 |
| `install-frpc.ps1` | frpc 安装脚本 |
| `reinstall-frpc.ps1` | frpc 重装脚本 |
| `frpc.log` | frpc 日志 |

## 回滚

如果 SSH 隧道有问题，需要回退到 frp：

```powershell
# Windows：恢复 frpc
ci\register-startup.ps1    # 旧的注册脚本还在
ci\start-frpc.ps1           # 启动 frpc
```

```bash
# 253：恢复 frps
cp /root/frps-backup-*/frps* /usr/local/bin/
cp /root/frps-backup-*/frps.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frps
firewall-cmd --permanent --add-port=7000/tcp && firewall-cmd --reload
```

## 注意事项

1. **SSH key 必须预先配置好**：本地 Windows 的 SSH 公钥需在 253 的 `~/.ssh/authorized_keys` 中
2. **首次连接**：`StrictHostKeyChecking=accept-new` 首次会自动接受 host key，后续会验证
3. **日志位置**：`ci/ssh-tunnel.log`（自动轮转，超过 10MB 自动切割）
4. **webhook-server.js 不需要改动**：它仍然监听 localhost:8888，隧道只是改变了流量入口方式
