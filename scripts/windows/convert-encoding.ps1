# Batch file encoding converter
# Converts UTF-8 source to GBK (codepage 936) + CRLF

param(
    [string]$SourceFile,
    [string]$TargetFile,
    [switch]$All
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Convert-ToGBK {
    param(
        [string]$Source,
        [string]$Target
    )
    
    Write-Host "Converting: $Source -> $Target" -ForegroundColor Cyan
    
    if (-not (Test-Path $Source)) {
        Write-Host "  [ERROR] Source file not found: $Source" -ForegroundColor Red
        return $false
    }
    
    # Read UTF-8 content
    $utf8Content = Get-Content $Source -Raw -Encoding UTF8
    
    # Write as GBK (codepage 936)
    $gbkEncoding = [System.Text.Encoding]::GetEncoding(936)
    [System.IO.File]::WriteAllText($Target, $utf8Content, $gbkEncoding)
    
    # Fix LF to CRLF
    $bytes = [System.IO.File]::ReadAllBytes($Target)
    $newBytes = New-Object System.Collections.ArrayList
    
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        if ($bytes[$i] -eq 0x0A -and ($i -eq 0 -or $bytes[$i-1] -ne 0x0D)) {
            [void]$newBytes.Add([byte]0x0D)
        }
        [void]$newBytes.Add($bytes[$i])
    }
    
    [System.IO.File]::WriteAllBytes($Target, [byte[]]$newBytes.ToArray())
    
    $size = (Get-Item $Target).Length
    Write-Host "  [OK] Converted, size: $size bytes" -ForegroundColor Green
    return $true
}

if ($All) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Converting all batch files to GBK" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    
    $conversions = @(
        @{ Source = "post-install-source.txt"; Target = "post-install.bat" }
    )
    
    $success = 0
    $failed = 0
    
    foreach ($conv in $conversions) {
        $sourcePath = Join-Path $ScriptDir $conv.Source
        $targetPath = Join-Path $ScriptDir $conv.Target
        
        if (Test-Path $sourcePath) {
            $result = Convert-ToGBK -Source $sourcePath -Target $targetPath
            if ($result) { $success++ } else { $failed++ }
        } else {
            Write-Host "  [SKIP] Source not found: $($conv.Source)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "Done: $success converted, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
    
} elseif ($SourceFile -and $TargetFile) {
    Convert-ToGBK -Source $SourceFile -Target $TargetFile
} else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\convert-encoding.ps1 -SourceFile <source.txt> -TargetFile <target.bat>" -ForegroundColor Gray
    Write-Host "  .\convert-encoding.ps1 -All" -ForegroundColor Gray
}
