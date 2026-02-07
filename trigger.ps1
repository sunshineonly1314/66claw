$token = "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"
$headers = @{ Accept = "application/vnd.github.v3+json"; Authorization = "token $token" }
$body = '{"ref":"main","inputs":{"version":"2026.1.30","push_image":"false"}}'
Invoke-RestMethod -Uri "https://api.github.com/repos/kevinGoGoGo123/clawdbotCNDocker/actions/workflows/docker-build-test.yml/dispatches" -Method POST -Headers $headers -Body $body -ContentType "application/json"
Write-Host "Triggered!"
