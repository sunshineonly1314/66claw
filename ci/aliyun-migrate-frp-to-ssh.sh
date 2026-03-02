#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 阿里云 253 服务端迁移脚本：frps → SSH 反向隧道
# 在 253 (106.15.198.253) 上以 root 执行
#
# 做了什么：
#   1. 停止并卸载 frps 服务
#   2. 关闭 frp 相关端口（7000）
#   3. 配置 sshd 支持反向隧道（GatewayPorts）
#   4. 收紧防火墙：只保留 22(SSH) + 业务必需端口
#   5. 加固 SSH 配置
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo " 阿里云 253 迁移：frps → SSH 反向隧道"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Step 1: 停止 frps ──────────────────────────────────────────────
echo "[1/5] 停止 frps 服务..."

# systemd 方式
if systemctl is-active frps &>/dev/null; then
    systemctl stop frps
    systemctl disable frps
    echo "  frps systemd service stopped and disabled"
elif systemctl is-active frp &>/dev/null; then
    systemctl stop frp
    systemctl disable frp
    echo "  frp systemd service stopped and disabled"
fi

# 进程方式（兜底）
if pgrep -x frps &>/dev/null; then
    pkill -x frps
    echo "  frps process killed"
fi

echo "  Done"
echo ""

# ── Step 2: 配置 sshd 支持反向隧道 ──────────────────────────────────
echo "[2/5] 配置 sshd 支持反向隧道..."

SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_BACKUP="/etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)"

# 备份
cp "$SSHD_CONFIG" "$SSHD_BACKUP"
echo "  sshd_config backed up to $SSHD_BACKUP"

# GatewayPorts: 允许反向隧道绑定到 0.0.0.0（外部可达）
# 安全做法：只允许绑定到特定端口（通过防火墙控制）
if grep -q "^GatewayPorts" "$SSHD_CONFIG"; then
    sed -i 's/^GatewayPorts.*/GatewayPorts clientspecified/' "$SSHD_CONFIG"
elif grep -q "^#GatewayPorts" "$SSHD_CONFIG"; then
    sed -i 's/^#GatewayPorts.*/GatewayPorts clientspecified/' "$SSHD_CONFIG"
else
    echo "GatewayPorts clientspecified" >> "$SSHD_CONFIG"
fi

# AllowTcpForwarding: 允许 TCP 转发
if grep -q "^AllowTcpForwarding" "$SSHD_CONFIG"; then
    sed -i 's/^AllowTcpForwarding.*/AllowTcpForwarding yes/' "$SSHD_CONFIG"
elif grep -q "^#AllowTcpForwarding" "$SSHD_CONFIG"; then
    sed -i 's/^#AllowTcpForwarding.*/AllowTcpForwarding yes/' "$SSHD_CONFIG"
else
    echo "AllowTcpForwarding yes" >> "$SSHD_CONFIG"
fi

# ClientAliveInterval: 服务端也发心跳，双向保活
if grep -q "^ClientAliveInterval" "$SSHD_CONFIG"; then
    sed -i 's/^ClientAliveInterval.*/ClientAliveInterval 30/' "$SSHD_CONFIG"
else
    echo "ClientAliveInterval 30" >> "$SSHD_CONFIG"
fi

if grep -q "^ClientAliveCountMax" "$SSHD_CONFIG"; then
    sed -i 's/^ClientAliveCountMax.*/ClientAliveCountMax 3/' "$SSHD_CONFIG"
else
    echo "ClientAliveCountMax 3" >> "$SSHD_CONFIG"
fi

echo "  sshd_config updated"

# 验证配置有效后再重启
if sshd -t 2>/dev/null; then
    systemctl restart sshd
    echo "  sshd restarted"
else
    echo "  ERROR: sshd config test failed! Restoring backup..."
    cp "$SSHD_BACKUP" "$SSHD_CONFIG"
    systemctl restart sshd
    echo "  Restored original config"
    exit 1
fi

echo "  Done"
echo ""

# ── Step 3: SSH 安全加固 ────────────────────────────────────────────
echo "[3/5] SSH 安全加固..."

# 确保禁用密码登录（只允许 key 认证）
if grep -q "^PasswordAuthentication" "$SSHD_CONFIG"; then
    sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
elif grep -q "^#PasswordAuthentication" "$SSHD_CONFIG"; then
    sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
else
    echo "PasswordAuthentication no" >> "$SSHD_CONFIG"
fi

# 禁用空密码
if grep -q "^PermitEmptyPasswords" "$SSHD_CONFIG"; then
    sed -i 's/^PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONFIG"
else
    echo "PermitEmptyPasswords no" >> "$SSHD_CONFIG"
fi

# 限制最大认证尝试次数
if grep -q "^MaxAuthTries" "$SSHD_CONFIG"; then
    sed -i 's/^MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CONFIG"
else
    echo "MaxAuthTries 3" >> "$SSHD_CONFIG"
fi

# 再次验证并重启
if sshd -t 2>/dev/null; then
    systemctl restart sshd
    echo "  sshd hardened and restarted"
else
    echo "  ERROR: sshd config test failed after hardening!"
    cp "$SSHD_BACKUP" "$SSHD_CONFIG"
    systemctl restart sshd
    exit 1
fi

echo "  Done"
echo ""

# ── Step 4: 防火墙收紧 ─────────────────────────────────────────────
echo "[4/5] 收紧防火墙..."

# 检测防火墙类型
if command -v firewall-cmd &>/dev/null && systemctl is-active firewalld &>/dev/null; then
    echo "  Using firewalld"

    # 关闭 frp 相关端口
    firewall-cmd --permanent --remove-port=7000/tcp 2>/dev/null || true
    echo "  Closed port 7000 (frp control)"

    # 保留必需端口
    # 22:   SSH（核心，反向隧道入口）
    # 9999: Webhook（通过 SSH 反向隧道暴露，但防火墙也需放行）
    # 6022: Windows SSH 转发端口
    firewall-cmd --permanent --add-port=9999/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=6022/tcp 2>/dev/null || true

    firewall-cmd --reload
    echo "  Firewall reloaded"

    echo "  Current open ports:"
    firewall-cmd --list-ports

elif command -v ufw &>/dev/null; then
    echo "  Using ufw"

    ufw deny 7000/tcp 2>/dev/null || true
    echo "  Closed port 7000 (frp control)"

    ufw allow 22/tcp 2>/dev/null || true
    ufw allow 9999/tcp 2>/dev/null || true
    ufw allow 6022/tcp 2>/dev/null || true

    echo "  UFW status:"
    ufw status

else
    echo "  Using iptables (raw)"

    # 删除 frp 端口规则
    iptables -D INPUT -p tcp --dport 7000 -j ACCEPT 2>/dev/null || true
    echo "  Closed port 7000 (frp control)"

    # 确保必需端口开放
    iptables -C INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || \
        iptables -I INPUT -p tcp --dport 22 -j ACCEPT
    iptables -C INPUT -p tcp --dport 9999 -j ACCEPT 2>/dev/null || \
        iptables -I INPUT -p tcp --dport 9999 -j ACCEPT
    iptables -C INPUT -p tcp --dport 6022 -j ACCEPT 2>/dev/null || \
        iptables -I INPUT -p tcp --dport 6022 -j ACCEPT

    # 持久化（如果有 iptables-save）
    if command -v iptables-save &>/dev/null; then
        iptables-save > /etc/sysconfig/iptables 2>/dev/null || \
            iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    fi
fi

echo "  Done"
echo ""

# ── Step 5: 清理 frps 文件 ──────────────────────────────────────────
echo "[5/5] 清理 frps 相关文件..."

# 移到备份目录，不直接删除
FRP_BACKUP="/root/frps-backup-$(date +%Y%m%d)"
mkdir -p "$FRP_BACKUP"

for f in /usr/local/bin/frps /usr/bin/frps /etc/frps.ini /etc/frps.toml \
         /etc/frp/frps.ini /etc/frp/frps.toml \
         /etc/systemd/system/frps.service /etc/systemd/system/frp.service; do
    if [ -f "$f" ]; then
        mv "$f" "$FRP_BACKUP/" 2>/dev/null || true
        echo "  Moved $f → $FRP_BACKUP/"
    fi
done

systemctl daemon-reload 2>/dev/null || true

echo "  frps files backed up to $FRP_BACKUP"
echo "  Done"
echo ""

# ── 完成 ────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo " 迁移完成！"
echo ""
echo " 服务端状态："
echo "   SSH:  $(systemctl is-active sshd)"
echo "   frps: $(systemctl is-active frps 2>/dev/null || echo 'stopped')"
echo ""
echo " 开放端口："
echo "   22   - SSH（隧道入口）"
echo "   9999 - Webhook（反向隧道暴露）"
echo "   6022 - Windows SSH 转发"
echo ""
echo " 已关闭："
echo "   7000 - frp 控制端口（已删除）"
echo ""
echo " 下一步："
echo "   在 Windows 本地运行 ssh-tunnel-loop.ps1 建立隧道"
echo "═══════════════════════════════════════════════════════"
