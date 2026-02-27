$target = "SunBin@192.168.0.102"
$out = & ssh -o StrictHostKeyChecking=no $target "dir C:\Users\SunBin\post-build-validation.ps1" 2>&1
$out | ForEach-Object { Write-Host $_ }
