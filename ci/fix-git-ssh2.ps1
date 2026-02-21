# Fix git SSH access - redirect ALL SSH URLs to HTTPS
# This handles: git+ssh://git@github.com/, ssh://git@github.com/, git@github.com:
git config --global "url.https://github.com/.insteadOf" "git+ssh://git@github.com/"
git config --global --add "url.https://github.com/.insteadOf" "ssh://git@github.com/"
git config --global --add "url.https://github.com/.insteadOf" "git@github.com:"

# Also add github.com to known_hosts to fix Host key verification
$sshDir = "$env:USERPROFILE\.ssh"
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}
$knownHosts = "$sshDir\known_hosts"
# Add GitHub's SSH host keys
$githubKeys = @"
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZKyRzG6I6BQ4AYL/VNWknvp81qcWdqRWR6bS0E0cYvQXAiKzyxGYXLlSAUQjY0YRiSGJISBp7YH6CFZkKCPYaH/cU6sOWMLjRCQTR+ZHBP5UeFmGYEGhMj0v/6GH6RMDfX7fcY9hwKoGrE/yqKmjnuZ0Y0y7A2SzaGRxIx5lN2fn35EuXzuSIDAC3JMdMH1Ypi47x3EFmnOeQhst1YcKHJn+tCDjv8fM0GsnkzaFThMIj4z6cuR3Yfv+BQJCJ4TSQdxVi/h0pD1iE5OcULMliYOi+Y/s=
"@
if (Test-Path $knownHosts) {
    $existing = Get-Content $knownHosts -Raw
    if ($existing -notmatch "github\.com") {
        Add-Content -Path $knownHosts -Value $githubKeys
        Write-Host "Added GitHub keys to existing known_hosts"
    } else {
        Write-Host "GitHub already in known_hosts"
    }
} else {
    Set-Content -Path $knownHosts -Value $githubKeys
    Write-Host "Created known_hosts with GitHub keys"
}

Write-Host ""
Write-Host "Git config:"
git config --global --get-regexp url
Write-Host ""
Write-Host "Test git+ssh redirect:"
git ls-remote https://github.com/whiskeysockets/libsignal-node.git HEAD 2>&1 | Select-Object -First 1
Write-Host "DONE"
