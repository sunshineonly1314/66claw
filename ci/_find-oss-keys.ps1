$scopes = @('User', 'Machine')
foreach ($scope in $scopes) {
    $vars = [System.Environment]::GetEnvironmentVariables($scope)
    foreach ($key in $vars.Keys) {
        if ($key -like '*OSS*' -or $key -like '*ALI*' -or $key -like '*ALIYUN*' -or $key -like '*ACCESS_KEY*') {
            $val = $vars[$key]
            $preview = if ($val.Length -gt 8) { $val.Substring(0,4) + '...' + $val.Substring($val.Length-4) } else { '***' }
            Write-Host "${scope}: ${key} = ${preview}"
        }
    }
}
