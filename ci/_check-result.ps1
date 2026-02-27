$WORKSPACE = 'D:\cicd-workspace\openclawcn'

Write-Host "=== NSIS Installer ==="
$tauriOutput = "$WORKSPACE\apps\desktop\src-tauri\target\release\bundle\nsis"
Get-ChildItem "$tauriOutput\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    $mb = [math]::Round($_.Length / 1MB, 1)
    Write-Host "  $($_.Name): $mb MB (modified: $($_.LastWriteTime))"
}

Write-Host ""
Write-Host "=== Release Deploy Output ==="
$releaseDir = "$WORKSPACE\.release-deploy"
if (Test-Path $releaseDir) {
    Get-ChildItem $releaseDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        $mb = [math]::Round($_.Length / 1MB, 2)
        $rel = $_.FullName.Replace("$releaseDir\", "")
        Write-Host "  $rel ($mb MB)"
    }
} else {
    Write-Host "  .release-deploy/ NOT FOUND"
}

Write-Host ""
Write-Host "=== Release Cache ==="
$cacheDir = 'E:\openclawcn\.release-cache'
if (Test-Path $cacheDir) {
    Get-ChildItem $cacheDir -Directory | ForEach-Object {
        $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $mb = [math]::Round($size / 1MB, 1)
        Write-Host "  $($_.Name): $mb MB"
    }
} else {
    Write-Host "  Release cache NOT FOUND"
}

Write-Host ""
Write-Host "=== Resources Summary ==="
$resDir = "$WORKSPACE\apps\desktop\src-tauri\resources"
$totalSize = (Get-ChildItem $resDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
$totalMB = [math]::Round($totalSize / 1MB, 1)
Write-Host "  Total resources: $totalMB MB"

Write-Host ""
Write-Host "=== install.json content ==="
$installJson = "$resDir\install.json"
if (Test-Path $installJson) {
    Get-Content $installJson
} else {
    Write-Host "  install.json NOT FOUND"
}
