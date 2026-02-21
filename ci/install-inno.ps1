$ErrorActionPreference = 'Stop'
Write-Host "=== Installing Inno Setup 6 ==="

$installerUrl = "https://jrsoftware.org/download.php/is.exe"
$installerPath = "$env:TEMP\innosetup6.exe"

# Download
Write-Host "Downloading Inno Setup 6..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing

if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: Download failed"
    exit 1
}
Write-Host ("Downloaded: {0:N1} MB" -f ((Get-Item $installerPath).Length / 1MB))

# Silent install
Write-Host "Installing silently..."
Start-Process -FilePath $installerPath -ArgumentList "/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART","/SP-" -Wait -NoNewWindow

# Verify
$isccPath = "C:\Program Files (x86)\Inno Setup 6\iscc.exe"
if (Test-Path $isccPath) {
    Write-Host "SUCCESS: Inno Setup 6 installed at $isccPath"
    # Add to PATH for current user
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $innoDir = "C:\Program Files (x86)\Inno Setup 6"
    if ($currentPath -notlike "*$innoDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$innoDir", "User")
        Write-Host "Added to User PATH"
    }
} else {
    Write-Host "ERROR: Installation failed - iscc.exe not found"
    exit 1
}

# Cleanup
Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
Write-Host "=== Done ==="
