# Quick fix: regenerate integrity hashes for deployed directory
param(
    [string]$DeployDir = "E:\clawdbuild\serve\ClawdbotCN"
)

$distDir = Join-Path $DeployDir "dist"
$outputFile = Join-Path $distDir "security\integrity-hashes.json"
$criticalDirs = @("license", "security")
$excludePatterns = @("\.test\.js$", "integrity-hashes\.json$")

$hashes = @()

foreach ($dir in $criticalDirs) {
    $dirPath = Join-Path $distDir $dir
    if (-not (Test-Path $dirPath)) {
        Write-Host "  SKIP: $dirPath not found" -ForegroundColor Yellow
        continue
    }

    $jsFiles = Get-ChildItem $dirPath -Filter "*.js" -Recurse -File
    foreach ($f in $jsFiles) {
        $relativePath = $f.FullName.Substring($distDir.Length + 1).Replace("\", "/")

        $skip = $false
        foreach ($pat in $excludePatterns) {
            if ($relativePath -match $pat) { $skip = $true; break }
        }
        if ($skip) { continue }

        $sha = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower()
        $hashes += @{ path = $relativePath; hash = $sha }
        Write-Host "  OK: $relativePath -> $($sha.Substring(0,16))..." -ForegroundColor Green
    }
}

$json = $hashes | ConvertTo-Json -Depth 3
Set-Content $outputFile $json -Encoding UTF8
Write-Host "`nGenerated $($hashes.Count) hashes -> $outputFile" -ForegroundColor Cyan
