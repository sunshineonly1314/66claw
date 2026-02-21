$root = 'd:\codeknowledge\clawdbot-main\clawdbot-main'
$files = @(
    'dist\entry.js',
    'dist\control-ui\index.html',
    'dist\mcp\index.js',
    'dist\security\integrity-hashes.json',
    'CHANGELOG.md',
    'LICENSE',
    'patches',
    'scripts\postinstall.js',
    'scripts\format-staged.js',
    'scripts\setup-git-hooks.js',
    'docs\reference\templates',
    'cn\docs-cn\reference\templates',
    'scripts\windows\start-gateway.bat',
    'scripts\windows\clawdbot.bat',
    'scripts\windows\diagnose.bat',
    'scripts\windows\view-logs.bat',
    'scripts\windows\assets\loading.html',
    'scripts\windows\assets\clawdbot.ico',
    'scripts\windows\native\ClawdbotService.exe',
    'scripts\windows\node-portable',
    'README.md'
)
foreach ($f in $files) {
    $p = Join-Path $root $f
    $exists = Test-Path $p
    $status = if ($exists) { 'OK     ' } else { 'MISSING' }
    Write-Host "$status  $f"
}
# Also check E:\clawdbuild\test-prod-deps\node_modules
$tp = 'E:\clawdbuild\test-prod-deps\node_modules'
$te = Test-Path $tp
Write-Host "$(if($te){'OK     '}else{'MISSING'})  $tp"
