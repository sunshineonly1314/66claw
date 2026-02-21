$body = @{
    ref = "refs/heads/master"
    commits = @(
        @{
            message = "[build] test windows build trigger"
            id = "abc123"
        }
    )
} | ConvertTo-Json -Depth 3

$headers = @{
    "Content-Type" = "application/json"
    "X-Gitee-Token" = "clawdbot-ci-secret-2026"
    "X-Gitee-Event" = "Push Hook"
}

Write-Host "=== Simulating Gitee Webhook via Aliyun tunnel ==="
Write-Host "URL: http://106.15.198.253:9999/webhook"
Write-Host "Body: $body"
Write-Host ""

try {
    $resp = Invoke-WebRequest -Uri "http://106.15.198.253:9999/webhook" -Method POST -Body $body -Headers $headers -UseBasicParsing -TimeoutSec 10
    Write-Host "Status: $($resp.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($resp.Content)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "HTTP Status: $code" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
