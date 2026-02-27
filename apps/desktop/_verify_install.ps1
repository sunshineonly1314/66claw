$ErrorActionPreference = "Continue"
Write-Host "=== Verifying ClawdbotCN Installation ===" -ForegroundColor Cyan

# 1. Check registry for install location
Write-Host "`n[1] Registry check..." -ForegroundColor Yellow
$regPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
$installDir = $null
foreach ($rp in $regPaths) {
    $entries = Get-ItemProperty $rp -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Clawdbot*" }
    foreach ($entry in $entries) {
        Write-Host "  DisplayName: $($entry.DisplayName)" -ForegroundColor Green
        Write-Host "  DisplayVersion: $($entry.DisplayVersion)" -ForegroundColor Green
        Write-Host "  InstallLocation: $($entry.InstallLocation)" -ForegroundColor Green
        Write-Host "  UninstallString: $($entry.UninstallString)" -ForegroundColor Green
        Write-Host "  Publisher: $($entry.Publisher)" -ForegroundColor Green
        # Extract install dir from UninstallString
        if ($entry.UninstallString) {
            $installDir = Split-Path ($entry.UninstallString -replace '"','') -Parent
            Write-Host "  Derived InstallDir: $installDir" -ForegroundColor Cyan
        }
    }
}

# 2. Check the derived install dir
if ($installDir -and (Test-Path $installDir)) {
    Write-Host "`n[2] Install directory contents ($installDir):" -ForegroundColor Yellow
    $topItems = Get-ChildItem $installDir -ErrorAction SilentlyContinue
    foreach ($item in $topItems) {
        $size = if ($item.PSIsContainer) {
            $s = (Get-ChildItem $item.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            "$([math]::Round($s / 1MB, 2)) MB"
        } else {
            "$([math]::Round($item.Length / 1MB, 2)) MB"
        }
        Write-Host "  $($item.Name)  $size" -ForegroundColor White
    }
    $totalSize = (Get-ChildItem $installDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Host "  --- TOTAL: $([math]::Round($totalSize / 1MB, 2)) MB ---" -ForegroundColor Green

    # 3. Check for main exe
    Write-Host "`n[3] Main executable check:" -ForegroundColor Yellow
    $exe = Get-ChildItem $installDir -Filter "ClawdbotCN.exe" -ErrorAction SilentlyContinue
    if ($exe) {
        Write-Host "  FOUND: $($exe.FullName) ($([math]::Round($exe.Length/1MB,2)) MB)" -ForegroundColor Green
        # Check file version
        $ver = (Get-Item $exe.FullName).VersionInfo
        Write-Host "  FileVersion: $($ver.FileVersion)" -ForegroundColor Green
        Write-Host "  ProductName: $($ver.ProductName)" -ForegroundColor Green
        Write-Host "  ProductVersion: $($ver.ProductVersion)" -ForegroundColor Green
    } else {
        Write-Host "  NOT FOUND - searching for any .exe..." -ForegroundColor Red
        Get-ChildItem $installDir -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  EXE: $($_.Name) ($([math]::Round($_.Length/1MB,2)) MB)" -ForegroundColor Yellow
        }
    }

    # 4. Check resources directory
    Write-Host "`n[4] Resources check:" -ForegroundColor Yellow
    $resDir = Join-Path $installDir "resources"
    if (Test-Path $resDir) {
        $resDirs = Get-ChildItem $resDir -Directory -ErrorAction SilentlyContinue
        Write-Host "  Resource subdirectories:" -ForegroundColor White
        foreach ($rd in $resDirs) {
            $rSize = (Get-ChildItem $rd.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "    $($rd.Name): $([math]::Round($rSize / 1MB, 2)) MB" -ForegroundColor White
        }
        # Check critical files
        $criticalFiles = @("dist", "node_modules", "extensions", "node.exe")
        foreach ($cf in $criticalFiles) {
            $cfPath = Join-Path $resDir $cf
            if (Test-Path $cfPath) {
                Write-Host "  [OK] $cf" -ForegroundColor Green
            } else {
                Write-Host "  [MISSING] $cf" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  Resources directory NOT FOUND" -ForegroundColor Red
    }

    # 5. Check WebView2
    Write-Host "`n[5] WebView2 check:" -ForegroundColor Yellow
    $wv2 = Join-Path $installDir "EBWebView"
    if (-not (Test-Path $wv2)) {
        $wv2 = "$env:LOCALAPPDATA\com.clawdbot.cn.desktop\EBWebView"
    }
    if (Test-Path $wv2) {
        $wv2Size = (Get-ChildItem $wv2 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "  WebView2: $wv2 ($([math]::Round($wv2Size / 1MB, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  WebView2 data not found (will be created on first launch)" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[2] Install directory not found or not accessible!" -ForegroundColor Red
    Write-Host "  Searching E:\ for ClawdbotCN..." -ForegroundColor Yellow
    Get-ChildItem "E:\" -Filter "ClawdbotCN.exe" -Recurse -Depth 4 -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  FOUND: $($_.FullName)" -ForegroundColor Green
    }
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
