# Fix git SSH access by redirecting to HTTPS
git config --global url."https://github.com/".insteadOf "git+ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "git@github.com:"
Write-Host "Git SSH->HTTPS redirect configured"
git config --global --get-regexp url
