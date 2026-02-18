# Rebuild ClawdbotCN Installer
# This rebuilds everything from scratch to ensure it works

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Rebuilding ClawdbotCN Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = "d:\codeknowledge\clawdbot-main\clawdbot-main"
Set-Location $ProjectRoot

# Step 1: Clean everything
Write-Host "[1/6] Cleaning old builds..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
if (Test-Path "ui\dist") { Remove-Item "ui\dist" -Recurse -Force }
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Step 2: Rebuild native modules
Write-Host "[2/6] Rebuilding native modules..." -ForegroundColor Yellow
pnpm rebuild
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to rebuild" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Step 3: Build backend
Write-Host "[3/6] Building backend..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Step 4: Build UI (if exists)
Write-Host "[4/6] Building UI..." -ForegroundColor Yellow
if (Test-Path "ui\package.json") {
    Push-Location ui
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Installing UI dependencies..." -ForegroundColor Gray
        pnpm install
    }
    pnpm build
    $uiBuildResult = $LASTEXITCODE
    Pop-Location

    if ($uiBuildResult -ne 0) {
        Write-Host "  WARNING: UI build failed (continuing anyway)" -ForegroundColor Yellow
    } else {
        Write-Host "  OK" -ForegroundColor Green
    }
} else {
    Write-Host "  Skipped (no UI)" -ForegroundColor Gray
}
Write-Host ""

# Step 5: Check installer type
Write-Host "[5/6] Checking installer configuration..." -ForegroundColor Yellow

$useService = $false
$useTauri = $false

if (Test-Path "scripts\windows\native\ClawdbotService.cs") {
    $useService = $true
    Write-Host "  Found: C# Service (ClawdbotService.exe)" -ForegroundColor Cyan
}

if (Test-Path "scripts\windows\tauri-src\Cargo.toml") {
    $useTauri = $true
    Write-Host "  Found: Tauri (ClawdbotCN.exe)" -ForegroundColor Cyan
}

if (-not $useService -and -not $useTauri) {
    Write-Host "  ERROR: No installer configuration found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Build installer
Write-Host "[6/6] Building installer..." -ForegroundColor Yellow

if ($useTauri) {
    Write-Host "  Building Tauri application..." -ForegroundColor Cyan
    Push-Location "scripts\windows"

    # Check if build-native-app.ps1 exists
    if (Test-Path "build-native-app.ps1") {
        .\build-native-app.ps1
        $tauriResult = $LASTEXITCODE
        Pop-Location

        if ($tauriResult -ne 0) {
            Write-Host "  ERROR: Tauri build failed" -ForegroundColor Red
            Write-Host ""
            Write-Host "  Falling back to C# Service installer..." -ForegroundColor Yellow
            $useTauri = $false
        } else {
            Write-Host "  OK: Tauri app built" -ForegroundColor Green
        }
    } else {
        Write-Host "  WARNING: build-native-app.ps1 not found" -ForegroundColor Yellow
        $useTauri = $false
        Pop-Location
    }
}

if ($useService -and -not $useTauri) {
    Write-Host "  Building C# Service installer..." -ForegroundColor Cyan
    Push-Location "scripts\windows"

    # Check if Inno Setup is available
    $iscc = Get-Command iscc -ErrorAction SilentlyContinue
    if ($iscc) {
        # Build service if needed
        if (Test-Path "native\build-service.ps1") {
            Write-Host "    Compiling ClawdbotService.exe..." -ForegroundColor Gray
            .\native\build-service.ps1
        }

        # Build installer
        if (Test-Path "setup.iss") {
            Write-Host "    Running Inno Setup..." -ForegroundColor Gray
            iscc setup.iss
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  OK: Installer built" -ForegroundColor Green
            } else {
                Write-Host "  ERROR: Inno Setup failed" -ForegroundColor Red
                Pop-Location
                exit 1
            }
        } else {
            Write-Host "  ERROR: setup.iss not found" -ForegroundColor Red
            Pop-Location
            exit 1
        }
    } else {
        Write-Host "  ERROR: Inno Setup (iscc) not found" -ForegroundColor Red
        Write-Host "  Please install Inno Setup: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
        Pop-Location
        exit 1
    }

    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Find output
$outputs = @()
if (Test-Path "E:\clawdbuild") {
    $outputs = Get-ChildItem "E:\clawdbuild" -Filter "*Setup*.exe" | Sort-Object LastWriteTime -Descending
}

if ($outputs) {
    Write-Host "Installer created:" -ForegroundColor Cyan
    $outputs | Select-Object -First 1 | ForEach-Object {
        Write-Host "  $($_.FullName)" -ForegroundColor White
        $sizeMB = [math]::Round($_.Length / 1MB, 1)
        Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
        Write-Host "  Modified: $($_.LastWriteTime)" -ForegroundColor Gray
    }
} else {
    Write-Host "Installer location:" -ForegroundColor Cyan
    Write-Host "  Check E:\clawdbuild\ or scripts\windows\" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run the installer" -ForegroundColor Gray
Write-Host "  2. Test ClawdbotCN" -ForegroundColor Gray
Write-Host ""
