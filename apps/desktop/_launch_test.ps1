$ErrorActionPreference = "Continue"

# Get install location from registry
$entry = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*Clawdbot*" } |
    Select-Object -First 1

if (-not $entry) {
    Write-Host "ERROR: ClawdbotCN not found in registry!" -ForegroundColor Red
    exit 1
}

$installDir = Split-Path ($entry.UninstallString -replace '"','') -Parent
Write-Host "=== Launch Test: ClawdbotCN 1.1.23 ===" -ForegroundColor Cyan
Write-Host "  Install dir: $installDir" -ForegroundColor White

# Check node.exe
Write-Host "`n[1] Node.exe check:" -ForegroundColor Yellow
$nodeExe = Get-ChildItem $installDir -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nodeExe) {
    Write-Host "  FOUND: $($nodeExe.FullName)" -ForegroundColor Green
    $nodeVer = & $nodeExe.FullName --version 2>&1
    Write-Host "  Version: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "  NOT FOUND" -ForegroundColor Red
}

# Check main entry point
Write-Host "`n[2] Main entry check:" -ForegroundColor Yellow
$distDir = Join-Path $installDir "resources\dist"
$mainJs = Join-Path $distDir "index.js"
$mainJsc = Join-Path $distDir "index.jsc"
if (Test-Path $mainJs) {
    Write-Host "  index.js: FOUND ($([math]::Round((Get-Item $mainJs).Length/1KB,1)) KB)" -ForegroundColor Green
} elseif (Test-Path $mainJsc) {
    Write-Host "  index.jsc: FOUND (bytecode, $([math]::Round((Get-Item $mainJsc).Length/1KB,1)) KB)" -ForegroundColor Green
} else {
    Write-Host "  No main entry found in $distDir" -ForegroundColor Red
    Get-ChildItem $distDir -Filter "index.*" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "    $($_.Name) ($([math]::Round($_.Length/1KB,1)) KB)" -ForegroundColor Yellow
    }
}

# Check install.json
Write-Host "`n[3] install.json check:" -ForegroundColor Yellow
$installJson = Join-Path $installDir "resources\data\install.json"
if (Test-Path $installJson) {
    $content = Get-Content $installJson -Raw
    Write-Host "  FOUND: $installJson" -ForegroundColor Green
    Write-Host "  Content: $content" -ForegroundColor White
} else {
    Write-Host "  NOT FOUND at $installJson" -ForegroundColor Red
    # Search for it
    Get-ChildItem (Join-Path $installDir "resources") -Filter "install.json" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  Found at: $($_.FullName)" -ForegroundColor Yellow
    }
}

# Launch the app
Write-Host "`n[4] Launching ClawdbotCN..." -ForegroundColor Yellow
$exe = Join-Path $installDir "clawdbot-desktop.exe"
if (-not (Test-Path $exe)) {
    $exe = Join-Path $installDir "ClawdbotCN.exe"
}

if (Test-Path $exe) {
    Write-Host "  Starting: $exe" -ForegroundColor Cyan
    $proc = Start-Process -FilePath $exe -PassThru
    Write-Host "  PID: $($proc.Id)" -ForegroundColor Green

    # Wait a few seconds and check if it's still running
    Start-Sleep -Seconds 8

    $running = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "  STATUS: Running (CPU: $($running.CPU)s, WorkingSet: $([math]::Round($running.WorkingSet64/1MB,1))MB)" -ForegroundColor Green

        # Check for child processes (node.exe backend)
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
        Write-Host "  Child processes: $($children.Count)" -ForegroundColor White
        foreach ($child in $children) {
            Write-Host "    PID $($child.ProcessId): $($child.Name) (CMD: $($child.CommandLine.Substring(0, [Math]::Min(100, $child.CommandLine.Length)))...)" -ForegroundColor White
        }

        # Check if node backend is listening
        Start-Sleep -Seconds 5
        $listeners = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
        $nodeProc = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*ClawdbotCN*" }
        if ($nodeProc) {
            foreach ($np in $nodeProc) {
                $nodeListeners = Get-NetTCPConnection -OwningProcess $np.Id -State Listen -ErrorAction SilentlyContinue
                foreach ($nl in $nodeListeners) {
                    Write-Host "  Node backend listening on port: $($nl.LocalPort)" -ForegroundColor Green
                }
            }
        }

        # Check for any error windows or crash
        Start-Sleep -Seconds 5
        $stillRunning = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
        if ($stillRunning) {
            Write-Host "  RESULT: App is running normally after 18 seconds" -ForegroundColor Green
            Write-Host "  WorkingSet: $([math]::Round($stillRunning.WorkingSet64/1MB,1))MB" -ForegroundColor Green
        } else {
            Write-Host "  RESULT: App crashed or closed within 18 seconds!" -ForegroundColor Red
        }
    } else {
        Write-Host "  STATUS: App crashed or exited within 8 seconds!" -ForegroundColor Red
        # Check for crash dumps or logs
        $logDir = "$env:LOCALAPPDATA\com.clawdbot.cn.desktop\logs"
        if (Test-Path $logDir) {
            Write-Host "  Recent logs:" -ForegroundColor Yellow
            Get-ChildItem $logDir -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object {
                Write-Host "    $($_.Name) ($($_.LastWriteTime))" -ForegroundColor White
            }
        }
    }
} else {
    Write-Host "  ERROR: Executable not found!" -ForegroundColor Red
}

Write-Host "`n=== Launch Test Complete ===" -ForegroundColor Cyan
