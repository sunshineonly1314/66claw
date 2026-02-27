$ErrorActionPreference = 'SilentlyContinue'

function Del($path) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "  DELETED: $path"
    } else {
        Write-Host "  NOT FOUND: $path"
    }
}

Write-Host ""
Write-Host "=== [1/7] Remove D:\cicd-workspace\openclawcn repo ==="
Del "D:\cicd-workspace\openclawcn"

Write-Host ""
Write-Host "=== [2/7] Remove D:\cicd-workspace loose files ==="
Get-ChildItem "D:\cicd-workspace" -File | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "  DELETED: $($_.Name)"
}

Write-Host ""
Write-Host "=== [3/7] Remove E:\clawdbuild entirely ==="
Del "E:\clawdbuild"

Write-Host ""
Write-Host "=== [4/7] Remove C:\Users\SunBin CI build logs ==="
Get-ChildItem "C:\Users\SunBin\*.log" | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "  DELETED: $($_.Name)"
}

Write-Host ""
Write-Host "=== [5/7] Remove C:\Users\SunBin CI scripts ==="
$scripts = @(
    "cicd-build-now.ps1","cicd-build.ps1","cleanup-build.ps1","check-file-lock.ps1",
    "fix-git-ssh.ps1","fix-git-ssh2.ps1","install-inno.ps1","install-msvc.ps1",
    "post-build-validation.ps1","release-deploy-remote.ps1","set-oss-env.ps1",
    "upload-installer-oss.ps1","_check-bundle.ps1","_check-old-build.ps1",
    "_check-resources.ps1","_check-result.ps1","_full-rebuild.ps1","_rebuild-nsis.ps1"
)
foreach ($s in $scripts) {
    $p = "C:\Users\SunBin\$s"
    if (Test-Path $p) { Remove-Item -Force $p; Write-Host "  DELETED: $s" }
}

Write-Host ""
Write-Host "=== [6/7] pnpm store prune ==="
& pnpm store prune
Write-Host "  pnpm store prune done"

Write-Host ""
Write-Host "=== [7/7] npm cache clean ==="
& npm cache clean --force
Write-Host "  npm cache clean done"

Write-Host ""
Write-Host "============================================"
Write-Host "=== CLEANUP DONE - Final Verification ==="
Write-Host "============================================"

Write-Host ""
Write-Host "--- D:\cicd-workspace remaining ---"
Get-ChildItem "D:\cicd-workspace" -ErrorAction SilentlyContinue | Select-Object Name, Length

Write-Host ""
Write-Host "--- E:\clawdbuild exists? ---"
if (Test-Path "E:\clawdbuild") { Write-Host "  [WARN] Still exists!" } else { Write-Host "  [OK] Deleted" }

Write-Host ""
Write-Host "--- C:\Users\SunBin .log files remaining ---"
$logs = Get-ChildItem "C:\Users\SunBin\*.log" -ErrorAction SilentlyContinue
if ($logs) { $logs | Select-Object Name } else { Write-Host "  [OK] No log files" }

Write-Host ""
Write-Host "--- pnpm store path ---"
& pnpm store path

Write-Host ""
Write-Host "=== ALL DONE ==="

# Self-delete this script
Remove-Item -Force "C:\Users\SunBin\clean-102.ps1" -ErrorAction SilentlyContinue
