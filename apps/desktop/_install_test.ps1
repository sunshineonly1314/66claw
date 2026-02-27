$ErrorActionPreference = "Continue"
$installer = "D:\codeknowledge\clawdbot-main\clawdbot-main\apps\desktop\src-tauri\target\release\bundle\nsis\ClawdbotCN_1.1.23_x64-setup.exe"

Write-Host "=== Installing ClawdbotCN 1.1.23 ===" -ForegroundColor Cyan
Write-Host "  Installer: $installer"
Write-Host "  Size: $([math]::Round((Get-Item $installer).Length / 1MB, 2)) MB"

# Kill any existing instances
Get-Process -Name "ClawdbotCN","clawdbot-desktop" -ErrorAction SilentlyContinue | Stop-Process -Force

# Run silent install (Tauri NSIS default installs to $env:LOCALAPPDATA\<productName>)
Write-Host "`nRunning silent install..." -ForegroundColor Yellow
$proc = Start-Process -FilePath $installer -ArgumentList "/S" -Wait -PassThru
$exitCode = if ($proc.HasExited -and $null -ne $proc.ExitCode) { $proc.ExitCode } else { -1 }
Write-Host "  Install exit code: $exitCode"

# Find where it installed
$searchPaths = @(
    "$env:LOCALAPPDATA\ClawdbotCN",
    "$env:LOCALAPPDATA\com.clawdbot.cn.desktop",
    "$env:LOCALAPPDATA\Programs\ClawdbotCN",
    "$env:ProgramFiles\ClawdbotCN",
    "E:\openclawcn\ClawdbotCN"
)

Write-Host "`nSearching for installation..." -ForegroundColor Yellow
foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        Write-Host "  FOUND: $path" -ForegroundColor Green
        $items = Get-ChildItem $path -ErrorAction SilentlyContinue
        Write-Host "  Files: $($items.Count)"
        $items | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
        $totalSize = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "  Total size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Green
    }
}

# Also search for the exe in common locations
Write-Host "`nSearching for ClawdbotCN.exe..." -ForegroundColor Yellow
$exePaths = @(
    "$env:LOCALAPPDATA",
    "$env:ProgramFiles",
    "${env:ProgramFiles(x86)}",
    "E:\openclawcn"
)
foreach ($base in $exePaths) {
    $found = Get-ChildItem -Path $base -Filter "ClawdbotCN.exe" -Recurse -Depth 3 -ErrorAction SilentlyContinue
    foreach ($f in $found) {
        Write-Host "  FOUND EXE: $($f.FullName) ($([math]::Round($f.Length/1MB,2)) MB)" -ForegroundColor Green
    }
}

# Check uninstall registry
Write-Host "`nChecking registry..." -ForegroundColor Yellow
$regPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
foreach ($rp in $regPaths) {
    Get-ItemProperty $rp -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like "*Clawdbot*" -or $_.DisplayName -like "*clawdbot*" } |
        ForEach-Object {
            Write-Host "  REGISTRY: $($_.DisplayName) v$($_.DisplayVersion)" -ForegroundColor Green
            Write-Host "    InstallLocation: $($_.InstallLocation)"
            Write-Host "    UninstallString: $($_.UninstallString)"
        }
}
