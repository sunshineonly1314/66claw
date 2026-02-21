$ALIYUN = "root@106.15.198.253"

Write-Host "=== 1. 配置阿里云服务器 ==="

# 开放 9999 端口，允许外部访问反向隧道
$setupCmd = @'
# 开放防火墙 9999 端口
firewall-cmd --permanent --add-port=9999/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

# 或者用 iptables
iptables -I INPUT -p tcp --dport 9999 -j ACCEPT 2>/dev/null || true

# 修改 sshd_config 允许 GatewayPorts（允许外部访问反向隧道端口）
if ! grep -q "GatewayPorts yes" /etc/ssh/sshd_config; then
    echo "GatewayPorts yes" >> /etc/ssh/sshd_config
    echo "AllowTcpForwarding yes" >> /etc/ssh/sshd_config
    systemctl restart sshd
    echo "sshd restarted with GatewayPorts=yes"
else
    echo "GatewayPorts already configured"
fi

# 测试端口
echo "Server ready. Testing port 9999..."
ss -tlnp | grep 9999 || echo "Port 9999 not yet listening (will be after tunnel connects)"
echo "Setup complete!"
'@

$out = ssh -o StrictHostKeyChecking=no $ALIYUN $setupCmd 2>&1
Write-Host $out

Write-Host ""
Write-Host "=== 2. 建立 SSH 反向隧道 ==="
Write-Host "本机 8888 → 阿里云 9999"
Write-Host "Gitee Webhook URL: http://106.15.198.253:9999/webhook"
