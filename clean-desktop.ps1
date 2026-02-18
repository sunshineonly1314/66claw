# Desktop Cleanup Script
# 桌面清理脚本

$desktopPath = [Environment]::GetFolderPath("Desktop")

Write-Host "Starting desktop cleanup..." -ForegroundColor Green
Write-Host "Desktop path: $desktopPath" -ForegroundColor Cyan

# Create organization folders
$documentsFolder = Join-Path $desktopPath "Documents"
$shortcutsFolder = Join-Path $desktopPath "Shortcuts"

if (-not (Test-Path $documentsFolder)) {
    New-Item -Path $documentsFolder -ItemType Directory | Out-Null
    Write-Host "Created folder: Documents" -ForegroundColor Yellow
}

if (-not (Test-Path $shortcutsFolder)) {
    New-Item -Path $shortcutsFolder -ItemType Directory | Out-Null
    Write-Host "Created folder: Shortcuts" -ForegroundColor Yellow
}

$movedCount = 0

# Move PDF files
Write-Host "`nMoving PDF files..." -ForegroundColor Cyan
$pdfFiles = Get-ChildItem -Path $desktopPath -Filter "*.pdf" -File
foreach ($file in $pdfFiles) {
    try {
        $dest = Join-Path $documentsFolder $file.Name
        Move-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "  Moved: $($file.Name)" -ForegroundColor Gray
        $movedCount++
    } catch {
        Write-Host "  Failed: $($file.Name)" -ForegroundColor Red
    }
}

# Move DOC files
Write-Host "`nMoving DOC files..." -ForegroundColor Cyan
$docFiles = Get-ChildItem -Path $desktopPath -Filter "*.doc*" -File
foreach ($file in $docFiles) {
    try {
        $dest = Join-Path $documentsFolder $file.Name
        Move-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "  Moved: $($file.Name)" -ForegroundColor Gray
        $movedCount++
    } catch {
        Write-Host "  Failed: $($file.Name)" -ForegroundColor Red
    }
}

# Move TXT files
Write-Host "`nMoving TXT files..." -ForegroundColor Cyan
$txtFiles = Get-ChildItem -Path $desktopPath -Filter "*.txt" -File
foreach ($file in $txtFiles) {
    try {
        $dest = Join-Path $documentsFolder $file.Name
        Move-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "  Moved: $($file.Name)" -ForegroundColor Gray
        $movedCount++
    } catch {
        Write-Host "  Failed: $($file.Name)" -ForegroundColor Red
    }
}

# Move MD files
Write-Host "`nMoving MD files..." -ForegroundColor Cyan
$mdFiles = Get-ChildItem -Path $desktopPath -Filter "*.md" -File
foreach ($file in $mdFiles) {
    try {
        $dest = Join-Path $documentsFolder $file.Name
        Move-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "  Moved: $($file.Name)" -ForegroundColor Gray
        $movedCount++
    } catch {
        Write-Host "  Failed: $($file.Name)" -ForegroundColor Red
    }
}

# Move shortcuts
Write-Host "`nMoving shortcuts..." -ForegroundColor Cyan
$lnkFiles = Get-ChildItem -Path $desktopPath -Filter "*.lnk" -File
foreach ($file in $lnkFiles) {
    try {
        $dest = Join-Path $shortcutsFolder $file.Name
        Move-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "  Moved: $($file.Name)" -ForegroundColor Gray
        $movedCount++
    } catch {
        Write-Host "  Failed: $($file.Name)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host "Total files moved: $movedCount" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

# Show remaining items
Write-Host "`nRemaining items on desktop:" -ForegroundColor Cyan
Get-ChildItem -Path $desktopPath | Select-Object Name | Format-Table -AutoSize
