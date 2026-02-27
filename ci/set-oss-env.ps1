# OSS environment setup (template)
# IMPORTANT: DO NOT hardcode credentials in this file.
# Set them via secure methods: CI secrets, Windows Credential Manager, or manual env vars.
#
# Required env vars for OSS mode (currently unused -- SCP is the active upload method):
#   OSS_ACCESS_KEY_ID     - Aliyun OSS AccessKey ID
#   OSS_ACCESS_KEY_SECRET - Aliyun OSS AccessKey Secret
#   OSS_BUCKET            - OSS bucket name
#   OSS_REGION            - OSS region (e.g., oss-cn-hangzhou)
#
# Example (run in elevated PowerShell, replace with actual values):
#   [Environment]::SetEnvironmentVariable("OSS_ACCESS_KEY_ID", "YOUR_KEY_ID", "Machine")
#   [Environment]::SetEnvironmentVariable("OSS_ACCESS_KEY_SECRET", "YOUR_KEY_SECRET", "Machine")
#   [Environment]::SetEnvironmentVariable("OSS_BUCKET", "your-bucket", "Machine")
#   [Environment]::SetEnvironmentVariable("OSS_REGION", "oss-cn-hangzhou", "Machine")

$required = @("OSS_ACCESS_KEY_ID", "OSS_ACCESS_KEY_SECRET", "OSS_BUCKET", "OSS_REGION")
$missing = $required | Where-Object { -not [Environment]::GetEnvironmentVariable($_, "Machine") }

if ($missing) {
    Write-Host "WARNING: The following OSS env vars are not set:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host "Set them before using --oss upload mode." -ForegroundColor Yellow
} else {
    Write-Host "OSS env vars are configured:" -ForegroundColor Green
    Write-Host "  OSS_ACCESS_KEY_ID: $([Environment]::GetEnvironmentVariable('OSS_ACCESS_KEY_ID', 'Machine').Substring(0, 8))..."
    Write-Host "  OSS_BUCKET: $([Environment]::GetEnvironmentVariable('OSS_BUCKET', 'Machine'))"
    Write-Host "  OSS_REGION: $([Environment]::GetEnvironmentVariable('OSS_REGION', 'Machine'))"
}
