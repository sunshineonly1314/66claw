# Quick fix: copy missing extension src/ files to deploy directory
param(
    [string]$SourceRoot = "d:\codeknowledge\clawdbot-main\clawdbot-main",
    [string]$DeployDir = "E:\clawdbuild\serve\ClawdbotCN"
)

$srcExtDir = Join-Path $SourceRoot "extensions"
$dstExtDir = Join-Path $DeployDir "extensions"

$fixed = 0
$skipped = 0

Get-ChildItem $srcExtDir -Directory | ForEach-Object {
    $extName = $_.Name
    $srcSrc = Join-Path $_.FullName "src"
    $dstExt = Join-Path $dstExtDir $extName
    $dstSrc = Join-Path $dstExt "src"

    # Only process extensions that exist in deploy and have source src/ with .ts files
    if (-not (Test-Path $dstExt)) {
        return  # extension not deployed
    }

    if (-not (Test-Path $srcSrc)) {
        return  # no src/ in source
    }

    $tsFiles = Get-ChildItem $srcSrc -Filter "*.ts" -File -ErrorAction SilentlyContinue
    if ($tsFiles.Count -eq 0) {
        return  # no .ts files to copy
    }

    # Check if deploy src/ is missing files
    if (-not (Test-Path $dstSrc)) {
        New-Item -ItemType Directory -Path $dstSrc -Force | Out-Null
    }

    $dstTsFiles = Get-ChildItem $dstSrc -Filter "*.ts" -File -ErrorAction SilentlyContinue

    if ($dstTsFiles.Count -lt $tsFiles.Count) {
        # Copy all src/*.ts files
        foreach ($f in $tsFiles) {
            Copy-Item $f.FullName (Join-Path $dstSrc $f.Name) -Force
        }
        $copied = ($tsFiles | ForEach-Object { $_.Name }) -join ", "
        Write-Host "  FIXED: $extName/src/ -> $copied" -ForegroundColor Green
        $fixed++
    } else {
        $skipped++
    }
}

Write-Host ""
Write-Host "Fixed: $fixed extensions, Skipped: $skipped (already OK)" -ForegroundColor Cyan
