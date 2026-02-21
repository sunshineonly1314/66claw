#!/bin/bash
# 在阿里云服务器上执行的配置脚本

# 开放防火墙 9999 端口
firewall-cmd --permanent --add-port=9999/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
iptables -I INPUT -p tcp --dport 9999 -j ACCEPT 2>/dev/null || true

# 配置 sshd 允许 GatewayPorts
if ! grep -q "GatewayPorts yes" /etc/ssh/sshd_config; then
    echo "GatewayPorts yes" >> /etc/ssh/sshd_config
    echo "AllowTcpForwarding yes" >> /etc/ssh/sshd_config
    systemctl restart sshd
    echo "sshd restarted with GatewayPorts=yes"
else
    echo "GatewayPorts already configured"
fi

echo "Setup complete!"
echo "Webhook URL will be: http://106.15.198.253:9999/webhook"
