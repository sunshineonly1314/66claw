# Check what's locking the installer file
$ErrorActionPreference = 'Continue'
$LOG = Join-Path $env:USERPROFILE 'check-lock.log'

$file = "E:\clawdbuild\ClawdbotCN-Setup-2026.2.15-x64.exe"

"=== File Check ===" | Out-File $LOG
"File: $file" | Out-File $LOG -Append
if (Test-Path $file) {
    $f = Get-Item $file
    "Size: $([math]::Round($f.Length/1MB, 1)) MB" | Out-File $LOG -Append
    "LastWrite: $($f.LastWriteTime)" | Out-File $LOG -Append
} else {
    "File not found!" | Out-File $LOG -Append
}

"" | Out-File $LOG -Append
"=== Running Processes ===" | Out-File $LOG -Append

# Check for build-related processes
$procs = @('iscc', 'ISCC', 'node', 'powershell', 'Compil32', 'tsc', 'npm', 'npx')
foreach ($p in $procs) {
    $found = Get-Process -Name $p -ErrorAction SilentlyContinue
    if ($found) {
        foreach ($proc in $found) {
            "  $p PID=$($proc.Id) CPU=$($proc.CPU) StartTime=$($proc.StartTime)" | Out-File $LOG -Append
        }
    }
}

"" | Out-File $LOG -Append
"=== Handle check (if handle.exe available) ===" | Out-File $LOG -Append

# Try to find who has the file open using built-in methods
$lockCheck = $null
try {
    # Try openfiles (requires admin)
    $lockCheck = openfiles /query /fo csv 2>&1 | Select-String "ClawdbotCN"
    if ($lockCheck) {
        "Openfiles:" | Out-File $LOG -Append
        $lockCheck | Out-File $LOG -Append
    } else {
        "No locks found via openfiles" | Out-File $LOG -Append
    }
} catch {
    "openfiles failed: $_" | Out-File $LOG -Append
}

"" | Out-File $LOG -Append
"=== Try to open file ===" | Out-File $LOG -Append
try {
    $stream = [System.IO.File]::Open($file, 'Open', 'Read', 'Read')
    "File opened successfully (not locked for reading)" | Out-File $LOG -Append
    $stream.Close()
} catch {
    "File open FAILED: $_" | Out-File $LOG -Append
}

"" | Out-File $LOG -Append

# Wait 5 seconds and check size again
Start-Sleep -Seconds 5
if (Test-Path $file) {
    $f2 = Get-Item $file
    "Size after 5s: $([math]::Round($f2.Length/1MB, 1)) MB (was $([math]::Round($f.Length/1MB, 1)) MB)" | Out-File $LOG -Append
    if ($f2.Length -ne $f.Length) {
        "File is STILL BEING WRITTEN!" | Out-File $LOG -Append
    } else {
        "File size stable (not being written)" | Out-File $LOG -Append
    }
}

"=== Done ===" | Out-File $LOG -Append
