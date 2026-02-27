Write-Host "=== Environment ==="
Write-Host ("Node: " + (& node --version 2>&1))

Write-Host ""
Write-Host "=== Key Files ==="
$files = @(
    "D:\codeknowledge\clawdbot-main\clawdbot-main\scripts\windows\post-build-validation.ps1",
    "D:\codeknowledge\clawdbot-main\clawdbot-main\build\scripts\windows\build-windows.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { Write-Host ("[OK] " + (Split-Path -Leaf $f)) }
    else { Write-Host ("[MISSING] " + $f) }
}

Write-Host ""
Write-Host "=== Existing Installers ==="
$exes = Get-ChildItem "E:\clawdbuild\ClawdbotCN-Setup-*.exe" -ErrorAction SilentlyContinue
if ($exes) {
    foreach ($e in $exes) {
        Write-Host ("  " + $e.Name + " (" + [math]::Round($e.Length/1MB,1) + " MB, " + $e.LastWriteTime + ")")
    }
} else {
    Write-Host "  (none found)"
}

Write-Host ""
Write-Host "=== Test Install Dir ==="
if (Test-Path "E:\clawdbuild\test\ClawdbotCN\dist\entry.js") {
    Write-Host "  Existing test install found"
    $nodeExe = "E:\clawdbuild\test\ClawdbotCN\node\node.exe"
    if (Test-Path $nodeExe) {
        Write-Host ("  Node: " + (& $nodeExe --version 2>&1))
    }
} else {
    Write-Host "  No test install"
}

Write-Host ""
Write-Host "=== Port 18789 ==="
$c = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue
if ($c) {
    Write-Host ("  IN USE by PID: " + ($c.OwningProcess -join ","))
} else {
    Write-Host "  Free"
}
