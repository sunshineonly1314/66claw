$ErrorActionPreference = 'Continue'
$target = "SunBin@192.168.0.102"

# Step 1: Check if file was uploaded
Write-Host "Step 1: Verify upload..."
$out1 = & ssh -o StrictHostKeyChecking=no $target "dir C:\Users\SunBin\env-check*" 2>&1
$out1 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "Step 2: Try inline PowerShell command..."
$out2 = & ssh -o StrictHostKeyChecking=no $target "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command hostname" 2>&1
$out2 | ForEach-Object { Write-Host "  $_" }
Write-Host "Exit: $LASTEXITCODE"
