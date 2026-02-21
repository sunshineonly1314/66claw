# Temporary launcher: run post-build-validation with the existing installer
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$validationScript = Join-Path $scriptDir "post-build-validation.ps1"

& $validationScript `
    -InstallerPath "E:\clawdbuild\ClawdbotCN-Setup-2026.2.15-x64.exe" `
    -InstallDir "E:\clawdbuild\test\ClawdbotCN" `
    -LogDir "E:\clawdbuild\logs" `
    -Port 18789 `
    -Cleanup

Write-Host ""
Write-Host "Exit code: $LASTEXITCODE"
