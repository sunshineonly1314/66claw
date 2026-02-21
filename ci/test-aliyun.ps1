$out = ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@106.15.198.253 'echo aliyun-ok && uname -a' 2>&1
Write-Host $out
