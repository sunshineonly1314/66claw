$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================"
Write-Host " ClawdbotCN Remote Windows Build"
Write-Host " Target: sunbin@192.168.0.102 (KevinSun)"
Write-Host "======================================================"

$REPO = 'https://sunshine1314:7c15433c23160cdae4aea6fff0996543@gitee.com/sunshine1314/openclawcn.git'

# The remote build script uses here-string (no variable expansion inside @' '@)
$remoteScript = @'
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$WORKSPACE = 'D:\cicd-workspace\openclawcn'
$REPO = '__REPO_PLACEHOLDER__'

Write-Host ""
Write-Host "=== Phase 1: Prepare Workspace ==="
Write-Host "Machine: $env:COMPUTERNAME / $env:USERNAME"
Write-Host "Node: $(node --version)"
Write-Host "pnpm: $(pnpm --version)"

if (-not (Test-Path $WORKSPACE)) {
    Write-Host "Creating workspace..."
    New-Item -ItemType Directory -Path $WORKSPACE -Force | Out-Null
}

Set-Location $WORKSPACE

$gitDir = Join-Path $WORKSPACE '.git'
if (Test-Path $gitDir) {
    Write-Host "Updating existing repository..."
    & git fetch origin --prune 2>&1 | ForEach-Object { Write-Host "  $_" }
    & git reset --hard origin/master 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git reset failed"; exit 1 }
    & git clean -fd -e node_modules -e dist 2>&1 | Out-Null
} else {
    Write-Host "Cloning repository from Gitee..."
    & git clone $REPO $WORKSPACE 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git clone failed"; exit 1 }
    Set-Location $WORKSPACE
}

Write-Host "Branch: $(git branch --show-current)"
Write-Host "Commit: $(git rev-parse --short HEAD) - $(git log -1 --pretty='%s')"

Write-Host ""
Write-Host "=== Phase 2: Install Dependencies ==="

& pnpm install --frozen-lockfile 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "frozen-lockfile failed, running pnpm install..."
    & pnpm install 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: pnpm install failed"; exit 1 }
}
Write-Host "Dependencies installed OK"

Write-Host ""
Write-Host "=== Phase 3: Start Build ==="

$buildPS1 = Join-Path $WORKSPACE 'build\scripts\windows\build-windows.ps1'
if (-not (Test-Path $buildPS1)) {
    Write-Host "ERROR: Build script not found at $buildPS1"
    exit 1
}

# Run the unified build in standard mode
# -FastCompress for faster dev builds (zip instead of lzma2)
$ErrorActionPreference = 'Stop'
try {
    & $buildPS1 -Mode standard -MaxThreads 8 -OutputDir 'E:\clawdbuild' -FastCompress
} catch {
    Write-Host "BUILD ERROR: $_"
    exit 1
}

Write-Host ""
Write-Host "=== Phase 4: Verify Artifacts ==="

$artifacts = Get-ChildItem -Path 'E:\clawdbuild\ClawdbotCN-Setup-*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($artifacts) {
    Write-Host "======================================================"
    Write-Host " BUILD SUCCESSFUL!"
    Write-Host ("  {0} ({1:N1} MB)" -f $artifacts.Name, ($artifacts.Length / 1MB))
    Write-Host "======================================================"
    exit 0
} else {
    Write-Host "ERROR: No installer .exe found in E:\clawdbuild"
    exit 1
}
'@

$remoteScript = $remoteScript -replace '__REPO_PLACEHOLDER__', $REPO

# Step 2: Write to temp file and upload
$tempFile = Join-Path $env:TEMP "cicd-build-$(Get-Date -Format 'yyyyMMdd-HHmmss').ps1"
$remoteScript | Out-File -FilePath $tempFile -Encoding UTF8
Write-Host "Local temp script: $tempFile"

Write-Host ""
Write-Host ">>> Uploading build script to KevinSun..."
$tempFileUnix = $tempFile -replace '\\', '/'
scp -o StrictHostKeyChecking=no $tempFileUnix sunbin@192.168.0.102:cicd-build-now.ps1 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
Write-Host "Upload OK"

Write-Host ""
Write-Host ">>> Executing remote build (this will take 5-15 minutes)..."
Write-Host "======================================================"
Write-Host ""

# Step 3: Execute remotely - capture all output including stderr
$result = ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=60 sunbin@192.168.0.102 "powershell -ExecutionPolicy Bypass -File C:\Users\sunbin\cicd-build-now.ps1" 2>&1
$sshExit = $LASTEXITCODE

foreach ($line in $result) {
    Write-Host $line
}

Write-Host ""
Write-Host "Remote exit code: $sshExit"

if ($sshExit -eq 0) {
    # Download artifact
    $localArtifacts = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci\artifacts\windows"
    if (-not (Test-Path $localArtifacts)) {
        New-Item -ItemType Directory -Path $localArtifacts -Force | Out-Null
    }

    Write-Host ""
    Write-Host ">>> Downloading installer..."
    $localArtifactsUnix = $localArtifacts -replace '\\', '/'
    scp -o StrictHostKeyChecking=no "sunbin@192.168.0.102:E:/clawdbuild/ClawdbotCN-Setup-*.exe" "$localArtifactsUnix/" 2>&1

    $downloaded = Get-ChildItem "$localArtifacts\ClawdbotCN-Setup-*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($downloaded) {
        Write-Host ("Downloaded: {0} ({1:N1} MB)" -f $downloaded.FullName, ($downloaded.Length / 1MB))
    } else {
        Write-Host "WARNING: Download may have failed, but build succeeded on remote"
    }

    Write-Host ""
    Write-Host "======================================================"
    Write-Host " ALL DONE - Build completed successfully!"
    Write-Host "======================================================"
} else {
    Write-Host ""
    Write-Host "======================================================"
    Write-Host " BUILD FAILED (exit code: $sshExit)"
    Write-Host "======================================================"
    exit 1
}
