$ALIYUN = "root@106.15.198.253"

Write-Host "=== 1. 上传配置脚本到阿里云 ==="
scp -o StrictHostKeyChecking=no "d:/codeknowledge/clawdbot-main/clawdbot-main/ci/aliyun-setup.sh" "${ALIYUN}:/root/aliyun-setup.sh"
Write-Host "Upload exit: $LASTEXITCODE"

Write-Host ""
Write-Host "=== 2. 执行配置 ==="
$out = ssh -o StrictHostKeyChecking=no $ALIYUN "bash /root/aliyun-setup.sh" 2>&1
Write-Host $out

Write-Host ""
Write-Host "=== 3. 检查阿里云安全组 ==="
Write-Host "请确认阿里云控制台安全组已放行 9999 端口（TCP 入方向）"
Write-Host "控制台: https://ecs.console.aliyun.com"
