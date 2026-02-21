Start-Sleep -Seconds 3

# 检查隧道是否在阿里云建立
$out = ssh -o StrictHostKeyChecking=no root@106.15.198.253 "ss -tlnp | grep 9999" 2>&1
Write-Host "阿里云 9999 端口状态: $out"

# 测试从阿里云访问 webhook
$out2 = ssh -o StrictHostKeyChecking=no root@106.15.198.253 "curl -s http://localhost:9999/health 2>&1 || echo 'not reachable'" 2>&1
Write-Host "Webhook 健康检查: $out2"
