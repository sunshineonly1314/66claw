$msgPath = Join-Path (Get-Location) ".git\COMMIT_MSG_TEMP"
& git commit --no-verify -F $msgPath
