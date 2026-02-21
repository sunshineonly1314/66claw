$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Config = Get-Content (Join-Path $ScriptDir "config.json") | ConvertFrom-Json

$MAC_HOST = $Config.builders.macos.host
$MAC_USER = $Config.builders.macos.user

# 查找 node 路径
$out = ssh -o StrictHostKeyChecking=no "${MAC_USER}@${MAC_HOST}" '
which node 2>/dev/null || true
ls /usr/local/lib/nodejs/ 2>/dev/null || true
ls /opt/homebrew/bin/node 2>/dev/null || true
ls ~/.nvm/versions/node/ 2>/dev/null | tail -3 || true
ls ~/.fnm/node-versions/ 2>/dev/null | tail -3 || true
echo "---"
/opt/homebrew/bin/node --version 2>/dev/null || echo "not at homebrew"
' 2>&1
Write-Host $out
