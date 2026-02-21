# Upload installer .exe to Aliyun OSS
# Handles file lock by waiting/retrying

$ErrorActionPreference = 'Continue'
$LOG = 'C:\Users\SunBin\upload-installer.log'
Start-Transcript -Path $LOG -Force

$env:OSS_ACCESS_KEY_ID = "LTAI5tGbuzYX98dppnUcs2tU"
$env:OSS_ACCESS_KEY_SECRET = "1k2GQB7r3wNqsmxivnJWZ6D4PYr1da"
$env:OSS_BUCKET = "chuhai-tecbin"
$env:OSS_REGION = "oss-cn-hangzhou"

$WORKSPACE = 'D:\cicd-workspace\openclawcn'
Set-Location $WORKSPACE

$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $pkgJson.version
Write-Output "Version: $VERSION"

# Find installer
$installerFile = Get-ChildItem -Path "E:\clawdbuild\ClawdbotCN-Setup-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installerFile) {
    Write-Output "ERROR: No installer found"
    Stop-Transcript
    exit 1
}
Write-Output "Installer: $($installerFile.FullName) ($([math]::Round($installerFile.Length/1MB, 1)) MB)"

# Check what's locking the file
Write-Output ""
Write-Output "Checking file locks..."
$handles = Get-Process | Where-Object {
    try { $_.Modules | Where-Object { $_.FileName -like "*ClawdbotCN-Setup*" } } catch {}
}
if ($handles) {
    Write-Output "Processes using the file:"
    $handles | ForEach-Object { Write-Output "  PID=$($_.Id) Name=$($_.ProcessName)" }
} else {
    Write-Output "No process found locking the file via modules."
}

# Try to copy using robocopy (handles locks better than .NET)
$tmpDir = 'D:\cicd-workspace\openclawcn\.tmp-installers'
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

Write-Output ""
Write-Output "Copying with robocopy..."
robocopy (Split-Path $installerFile.FullName) $tmpDir $installerFile.Name /R:3 /W:5 /NFL /NDL
$robocopyExit = $LASTEXITCODE
Write-Output "Robocopy exit: $robocopyExit"

if ($robocopyExit -lt 8) {
    # robocopy: 0=no copy needed, 1=copied, <8 = success
    $copiedFile = Join-Path $tmpDir $installerFile.Name
    if (Test-Path $copiedFile) {
        $copiedSize = (Get-Item $copiedFile).Length
        Write-Output "Copied: $copiedFile ($([math]::Round($copiedSize/1MB, 1)) MB)"
    } else {
        Write-Output "ERROR: Robocopy succeeded but file not found at $copiedFile"
        Stop-Transcript
        exit 1
    }
} else {
    Write-Output "ERROR: Robocopy failed (exit: $robocopyExit), trying direct upload from source..."
    $copiedFile = $installerFile.FullName
}

# Upload to OSS using ali-oss via inline node script
Write-Output ""
Write-Output "Uploading to OSS..."

$nodeLog = 'C:\Users\SunBin\upload-installer-node.log'
$ossKey = "releases/$VERSION/installers/$($installerFile.Name)"
$uploadFile = $copiedFile -replace '\\', '/'

$uploadScript = @"
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
globalThis.Buffer = globalThis.Buffer || require("buffer").Buffer;
const OSS = require("ali-oss");
const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
});
const localPath = "$uploadFile";
const ossKey = "$ossKey";
const size = fs.statSync(localPath).size;
console.log("Uploading: " + localPath);
console.log("  Size: " + (size / 1024 / 1024).toFixed(1) + " MB");
console.log("  To: " + ossKey);
const result = await client.multipartUpload(ossKey, localPath, {
  progress: (p) => {
    const pct = Math.round(p * 100);
    if (pct % 10 === 0) process.stdout.write("  Progress: " + pct + "%\r\n");
  },
});
console.log("Upload complete!");
console.log("  URL: https://dl.obplugins.cn/" + ossKey);
"@

$tmpMjs = "$WORKSPACE\_upload-installer.mjs"
$uploadScript | Out-File -FilePath $tmpMjs -Encoding UTF8

cmd /c "node $tmpMjs > `"$nodeLog`" 2>&1"
$exitCode = $LASTEXITCODE

Write-Output ""
Write-Output "=== Upload Output ==="
if (Test-Path $nodeLog) {
    Get-Content $nodeLog | ForEach-Object { Write-Output $_ }
}
Write-Output "=== End Upload Output ==="

Remove-Item $tmpMjs -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Output ""
    Write-Output "========================================="
    Write-Output "  Installer Upload SUCCESS"
    Write-Output "========================================="
    Write-Output "Download: https://dl.obplugins.cn/$ossKey"
} else {
    Write-Output ""
    Write-Output "========================================="
    Write-Output "  Installer Upload FAILED (exit: $exitCode)"
    Write-Output "========================================="
}

Stop-Transcript
exit $exitCode
