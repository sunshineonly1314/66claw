$env:OSS_ACCESS_KEY_ID = "LTAI5tGbuzYX98dppnUcs2tU"
$env:OSS_ACCESS_KEY_SECRET = "1k2GQB7r3wNqsmxivnJWZ6D4PYr1da"
$env:OSS_BUCKET = "chuhai-tecbin"
$env:OSS_REGION = "oss-cn-hangzhou"
Set-Location D:\cicd-workspace\openclawcn
Write-Host "=== Release Deploy Start ==="
Write-Host "CWD: $(Get-Location)"
Write-Host "Node: $(node --version)"
Write-Host "OSS AK: $($env:OSS_ACCESS_KEY_ID.Substring(0,8))..."
node --import tsx scripts/release-deploy.ts --version 2026.2.15 --oss --oss-domain dl.obplugins.cn --skip-delta 2>&1
$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "=== Release Deploy Exit: $exitCode ==="
exit $exitCode
