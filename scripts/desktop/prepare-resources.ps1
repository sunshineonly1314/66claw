# Prepare bundled resources for Tauri desktop build — Windows
# Stages Node.js runtime, backend dist, extensions, skills into apps/desktop/src-tauri/resources/

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path
$ResourcesDir = Join-Path $ProjectRoot "apps\desktop\src-tauri\resources"

$totalTimer = [Diagnostics.Stopwatch]::StartNew()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Tauri Resource Preparation (Windows)"   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project root  : $ProjectRoot"
Write-Host "Resources dir : $ResourcesDir"
Write-Host "Time          : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Clean previous resources
# LESSON LEARNED (v1.6.7): Remove-Item can fail silently when files are locked
# by running Node processes (e.g. @opentelemetry), causing stale data to remain.
# We must kill Node processes first and retry if the directory still exists.
if (Test-Path $ResourcesDir) {
    Write-Host "[Clean] Removing old resources..." -ForegroundColor Yellow
    # Kill any Node processes that may lock files in resources/
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Remove-Item $ResourcesDir -Recurse -Force -ErrorAction SilentlyContinue
    # Retry once if directory still exists (file locks may take a moment to release)
    if (Test-Path $ResourcesDir) {
        Write-Host "  Retrying cleanup (files may have been locked)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        Remove-Item $ResourcesDir -Recurse -Force -ErrorAction Stop
    }
    Write-Host "  Done."
}
New-Item -ItemType Directory -Force -Path $ResourcesDir | Out-Null

# ── 1. Node.js runtime ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[1/9] Copying Node.js runtime..." -ForegroundColor Green
$nodeDir = Join-Path $ResourcesDir "node"
New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null

# PINNED: must match bytecode compilation Node version exactly (V8 bytecode is version-specific)
$NodeVersion = "22.16.0"
$nodeSources = @(
    "$ProjectRoot\scripts\windows\node-portable\node.exe",
    "$ProjectRoot\scripts\windows\node\node.exe"
)
$nodeFound = $false
# Prefer the full node-portable directory (contains npx.cmd, npm.cmd, node_modules)
$nodePortableDirs = @(
    "$ProjectRoot\scripts\windows\node-portable",
    "$ProjectRoot\scripts\windows\node"
)
foreach ($dir in $nodePortableDirs) {
    if (Test-Path "$dir\node.exe") {
        # Copy the entire directory so npx.cmd / npm.cmd / node_modules are included
        Copy-Item "$dir\*" $nodeDir -Recurse -Force
        $nodeFound = $true
        $size = [math]::Round((Get-Item "$nodeDir\node.exe").Length / 1MB, 2)
        $hasNpx = Test-Path "$nodeDir\npx.cmd"
        Write-Host "  OK: node.exe ($size MB) from $dir (npx.cmd=$hasNpx) [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        break
    }
}
# Fallback: download full zip from CN mirror (npmmirror) if not found locally
if (-not $nodeFound) {
    Write-Host "  node not found locally, downloading full zip from CN mirror..." -ForegroundColor Yellow
    $nodeZipName = "node-v$NodeVersion-win-x64.zip"
    $nodeDlDir = Join-Path $ProjectRoot "build\download-output\node"
    New-Item -ItemType Directory -Force -Path $nodeDlDir | Out-Null
    $nodeZipPath = Join-Path $nodeDlDir $nodeZipName

    $nodeMirrors = @(
        "https://npmmirror.com/mirrors/node/v$NodeVersion/$nodeZipName",
        "https://nodejs.org/dist/v$NodeVersion/$nodeZipName"
    )
    foreach ($url in $nodeMirrors) {
        Write-Host "  Trying: $url"
        try {
            Invoke-WebRequest -Uri $url -OutFile $nodeZipPath -TimeoutSec 300 -UseBasicParsing -ErrorAction Stop
            if (Test-Path $nodeZipPath) {
                $extractDir = Join-Path $nodeDlDir "node-win-x64"
                if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
                Expand-Archive -Path $nodeZipPath -DestinationPath $extractDir -Force
                # Full node dir is inside node-vXX.XX.X-win-x64/
                $extractedRoot = Get-ChildItem $extractDir -Directory | Select-Object -First 1
                if ($extractedRoot -and (Test-Path "$($extractedRoot.FullName)\node.exe")) {
                    Copy-Item "$($extractedRoot.FullName)\*" $nodeDir -Recurse -Force
                    $nodeFound = $true
                    $size = [math]::Round((Get-Item "$nodeDir\node.exe").Length / 1MB, 2)
                    $hasNpx = Test-Path "$nodeDir\npx.cmd"
                    Write-Host "  OK: node.exe ($size MB, npx.cmd=$hasNpx) downloaded from CN mirror [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]" -ForegroundColor Green
                    Remove-Item $nodeZipPath -Force -ErrorAction SilentlyContinue
                    break
                }
            }
        } catch {
            Write-Host "  Download failed: $_" -ForegroundColor Yellow
        }
        Remove-Item $nodeZipPath -Force -ErrorAction SilentlyContinue
    }
}
if (-not $nodeFound) {
    Write-Host "  ERROR: node not found and download failed!" -ForegroundColor Red
    Write-Host "  Tried local paths:" -ForegroundColor Red
    foreach ($dir in $nodePortableDirs) {
        Write-Host "    - $dir\node.exe" -ForegroundColor Red
    }
    Write-Host "  Tried CN mirrors:" -ForegroundColor Red
    Write-Host "    - https://npmmirror.com/mirrors/node/v$NodeVersion/" -ForegroundColor Red
    exit 1
}
# Hard validation: npx.cmd MUST be present — MCP servers require it.
# If missing, MCP falls back to system npx which varies by user machine → -32000 errors.
if (-not (Test-Path "$nodeDir\npx.cmd")) {
    Write-Host "  ERROR: npx.cmd not found in $nodeDir after copy!" -ForegroundColor Red
    Write-Host "  The node-portable directory must be a full Node.js distribution (not just node.exe)." -ForegroundColor Red
    Write-Host "  Download the full zip from: https://npmmirror.com/mirrors/node/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$nodeDir\npm.cmd")) {
    Write-Host "  ERROR: npm.cmd not found in $nodeDir after copy!" -ForegroundColor Red
    exit 1
}
Write-Host "  Verified: node.exe + npx.cmd + npm.cmd present" -ForegroundColor Green

# Verify Node.js version matches pinned version (V8 bytecode is version-specific)
# LESSON LEARNED: .jsc bytecode compiled with Node 22.16.0 is V8-version-locked.
# If a different Node version is bundled, the app crashes on startup with V8 errors.
$nodeVerOut = & "$nodeDir\node.exe" --version 2>$null
if ($nodeVerOut -notmatch "v$NodeVersion") {
    Write-Host "  ERROR: Bundled node version mismatch!" -ForegroundColor Red
    Write-Host "    Expected: v$NodeVersion" -ForegroundColor Red
    Write-Host "    Got     : $nodeVerOut" -ForegroundColor Red
    Write-Host "  The .jsc bytecode will crash at runtime due to V8 version mismatch." -ForegroundColor Red
    Write-Host "  Update $($nodePortableDirs[0]) to Node.js v$NodeVersion." -ForegroundColor Yellow
    exit 1
}
Write-Host "  Verified: node version $nodeVerOut matches pinned v$NodeVersion" -ForegroundColor Green

# ── [Fix: CJS package.json isolation for node/] ──────────────────────────────
# The root resources/package.json has "type": "module" (copied from the project).
# Node.js walks up directory tree to find the nearest package.json to determine
# module type.  Without a local package.json, extensionless JS files under node/
# inherit "type": "module" and fail with "require is not defined in ES module scope".
# Fix: place a {"type":"commonjs"} package.json in node/ to isolate it.
# Use .NET to write UTF-8 without BOM — PowerShell 5.x -Encoding UTF8 adds BOM
# which could cause JSON parse errors in older Node.js versions.
[System.IO.File]::WriteAllText("$nodeDir\package.json", '{"type":"commonjs"}' + "`n")
Write-Host "  Created node/package.json (type=commonjs) to isolate from resources/ ESM scope" -ForegroundColor Green

# ── 2. Backend dist ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[2/9] Copying backend dist/..." -ForegroundColor Green
$distSource = "$ProjectRoot\dist"
if (Test-Path $distSource) {
    Copy-Item $distSource "$ResourcesDir\dist" -Recurse -Force
    $distSize = [math]::Round(((Get-ChildItem "$ResourcesDir\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
    # Verify CN encrypted files
    $jscCount = (Get-ChildItem "$ResourcesDir\dist" -Recurse -Filter "*.jsc" -ErrorAction SilentlyContinue).Count
    $dispatchExists = Test-Path "$ResourcesDir\dist\dispatch"
    $licenseExists = Test-Path "$ResourcesDir\dist\license"
    $securityExists = Test-Path "$ResourcesDir\dist\security"
    Write-Host "  OK: dist/ ($distSize MB) [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
    Write-Host "  CN encryption check: .jsc=$jscCount dispatch=$dispatchExists license=$licenseExists security=$securityExists" -ForegroundColor $(if ($jscCount -gt 0) { "Green" } else { "Red" })
    if ($jscCount -eq 0) {
        Write-Host "  WARNING: No .jsc bytecode files found! Run 'pnpm build:secure' first." -ForegroundColor Red
    }

    # Remove private GUI automation tools from dist (must NOT ship in installer)
    $guiToolFiles = @(
        "agents\tools\wechat-send.js",
        "agents\tools\wechat-check.js",
        "agents\tools\wechat-read.js",
        "agents\tools\wecom-send.js",
        "agents\tools\wecom-check.js",
        "agents\tools\wecom-read.js",
        "agents\tools\wecom-auto-reply.js",
        "agents\tools\wecom-broadcast.js",
        "agents\tools\wecom-patrol.js",
        "agents\tools\wecom-group-summary.js",
        "agents\tools\wecom-helpers.js",
        "agents\tools\wecom-cs-config.js",
        "agents\tools\wecom-handoff.js",
        "agents\tools\wecom-ticket.js"
    )
    $guiRemoved = 0
    foreach ($f in $guiToolFiles) {
        $target = Join-Path "$ResourcesDir\dist" $f
        if (Test-Path $target) { Remove-Item $target -Force; $guiRemoved++ }
        # Also remove .jsc and .d.ts variants
        $jscTarget = $target -replace '\.js$', '.jsc'
        if (Test-Path $jscTarget) { Remove-Item $jscTarget -Force; $guiRemoved++ }
        $dtsTarget = $target -replace '\.js$', '.d.ts'
        if (Test-Path $dtsTarget) { Remove-Item $dtsTarget -Force }
        $mapTarget = "$target.map"
        if (Test-Path $mapTarget) { Remove-Item $mapTarget -Force }
    }
    Write-Host "  Removed $guiRemoved private GUI automation files from dist/" -ForegroundColor Yellow

    # ── 2b. Create src/infra/safe-rename.js shim for orchestrator extension ──
    # extensions/orchestrator/src/state.jsc resolves "../../../src/infra/safe-rename.js"
    # which maps to resources/src/infra/safe-rename.js in the packaged app.
    # The actual file lives at resources/dist/infra/safe-rename.js, so we create a shim.
    $shimDir = Join-Path $ResourcesDir "src\infra"
    New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
    Set-Content -Path (Join-Path $shimDir "safe-rename.js") -Value 'module.exports = require("../../dist/infra/safe-rename.js");' -Encoding UTF8
    # The main app is ESM — without this package.json, Node treats .js as ESM
    # and the CJS shim fails with "module is not defined".
    Set-Content -Path (Join-Path $ResourcesDir "src\package.json") -Value '{"type":"commonjs"}' -Encoding UTF8
    Write-Host "  Created src/infra/safe-rename.js shim (orchestrator compat)" -ForegroundColor Yellow

    # ── 2a. Fix rolldown chunk circular dependency in plugin-sdk ──
    # rolldown splits dist/plugin-sdk/index.js into index.js + pi-model-discovery-*.js
    # The chunk file imports { t as __exportAll } from "./index.js", but index.js
    # imports the chunk as a side-effect on line 1.  In ESM, `var __exportAll`
    # (line 63 of index.js) is hoisted as `undefined` during the circular evaluation,
    # causing "TypeError: __exportAll is not a function".
    # Fix: inline __exportAll definition directly in the chunk file.
    $pluginSdkDir = Join-Path $ResourcesDir "dist\plugin-sdk"
    $chunkFile = Get-ChildItem $pluginSdkDir -Filter "pi-model-discovery-*.js" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($chunkFile) {
        $chunkContent = Get-Content $chunkFile.FullName -Raw -Encoding UTF8
        $oldImport = 'import { t as __exportAll } from "./index.js";'
        $inlinedDef = 'var __defProp = Object.defineProperty; var __exportAll = (all, no_symbols) => { let target = {}; for (var name in all) { __defProp(target, name, { get: all[name], enumerable: true }); } if (!no_symbols) { __defProp(target, Symbol.toStringTag, { value: "Module" }); } return target; };'
        if ($chunkContent.Contains($oldImport)) {
            $chunkContent = $chunkContent.Replace($oldImport, $inlinedDef)
            Set-Content $chunkFile.FullName -Value $chunkContent -Encoding UTF8 -NoNewline
            Write-Host "  Fixed plugin-sdk chunk circular dependency (inlined __exportAll)"
        }
    }
    # ── 2c. Post-copy mandatory validations ──
    # LESSON LEARNED (v1.6.7): These checks catch issues that would cause silent failures:
    # 1) 'asset not found: index.html' crash on startup
    # 2) V8 bytecode missing (runtime module-not-found errors)
    # 3) Integrity check failures at startup (hash mismatch)
    $distValidationOk = $true

    # Check 1: control-ui/index.html (most critical — its absence causes startup crash)
    if (-not (Test-Path "$ResourcesDir\dist\control-ui\index.html")) {
        Write-Host "  FATAL: resources/dist/control-ui/index.html is MISSING!" -ForegroundColor Red
        Write-Host "    The installer will crash on startup with 'asset not found: index.html'." -ForegroundColor Red
        Write-Host "    Run: cd ui && pnpm build   (then re-run prepare-resources)" -ForegroundColor Yellow
        $distValidationOk = $false
    } else {
        Write-Host "  OK: control-ui/index.html present" -ForegroundColor Green
    }

    # Check 2: dist/entry.js (Tauri startup script, written by tsdown base build)
    if (-not (Test-Path "$ResourcesDir\dist\entry.js")) {
        Write-Host "  FATAL: resources/dist/entry.js is MISSING!" -ForegroundColor Red
        Write-Host "    Run: pnpm build   (tsdown base build)" -ForegroundColor Yellow
        $distValidationOk = $false
    } else {
        Write-Host "  OK: entry.js present" -ForegroundColor Green
    }

    # Check 3: .jsc bytecode files (compiled by compile-bytecode.ts with Node 22.16.0)
    $resourceJscCount = (Get-ChildItem "$ResourcesDir\dist" -Recurse -Filter "*.jsc" -ErrorAction SilentlyContinue).Count
    if ($resourceJscCount -lt 100) {
        Write-Host "  FATAL: Only $resourceJscCount .jsc bytecode files in resources/dist (expected >= 100)!" -ForegroundColor Red
        Write-Host "    Run: pnpm build:cn-compile && pnpm build:cn-extensions && node --import tsx cn/scripts/build/compile-bytecode.ts" -ForegroundColor Yellow
        $distValidationOk = $false
    } else {
        Write-Host "  OK: $resourceJscCount .jsc bytecode files present" -ForegroundColor Green
    }

    # Check 4: integrity-hashes.json (startup integrity check reads this file)
    if (-not (Test-Path "$ResourcesDir\dist\security\integrity-hashes.json")) {
        Write-Host "  FATAL: resources/dist/security/integrity-hashes.json is MISSING!" -ForegroundColor Red
        Write-Host "    Run: pnpm integrity:gen" -ForegroundColor Yellow
        $distValidationOk = $false
    } else {
        Write-Host "  OK: integrity-hashes.json present" -ForegroundColor Green
    }

    if (-not $distValidationOk) {
        Write-Host ""
        Write-Host "FATAL: dist/ validation failed. Aborting resource preparation." -ForegroundColor Red
        exit 1
    }
    Write-Host "  All dist/ validations passed" -ForegroundColor Green

} else {
    Write-Host "  ERROR: dist/ not found. Run 'pnpm build' first." -ForegroundColor Red
    exit 1
}

# ── 3. Production node_modules ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[3/9] Installing production node_modules/..." -ForegroundColor Green

# ── Pre-seeded node_modules: 如果 CI 预先上传了 prod-node-modules.tar.gz，直接解压使用 ──
# 这避免了 npm install 从 github.com 下载 @whiskeysockets/libsignal-node 等依赖（国内网络不可达）
$preSeededTarball = "D:\cicd-workspace\prod-node-modules.tar.gz"
if (Test-Path $preSeededTarball) {
    Write-Host "  Found pre-seeded node_modules tarball: $preSeededTarball" -ForegroundColor Cyan
    Write-Host "  Extracting (skipping npm install)..."
    $extractDir = Join-Path $env:TEMP "clawdbot-prod-nm-preseed"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

    # Use tar to extract (available on Windows 10+)
    # --force-local prevents tar from treating "D:" as a remote host
    cmd /c "tar xzf `"$preSeededTarball`" -C `"$extractDir`" --force-local 2>&1"
    if ($LASTEXITCODE -eq 0 -and (Test-Path "$extractDir\node_modules")) {
        robocopy "$extractDir\node_modules" "$ResourcesDir\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        if ($LASTEXITCODE -ge 8) {
            Write-Host "  WARNING: robocopy failed, falling back to npm install" -ForegroundColor Yellow
        } else {
            $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
            Write-Host "  OK: node_modules/ ($nmSize MB) [pre-seeded tarball] [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]" -ForegroundColor Green
            Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
            # Skip the rest of step 3 — jump to step 4 (use goto-like flag)
            $skipNpmInstall = $true
        }
    } else {
        Write-Host "  WARNING: tarball extraction failed, falling back to npm install" -ForegroundColor Yellow
    }
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
}

if (-not $skipNpmInstall) {
# CRITICAL: pnpm uses hardlinks to a global store. robocopy/Copy-Item expands
# each hardlink into an independent file copy: 1.5GB real → 18GB copied.
# Solution: use npm install --prod in a temp dir to get a flat, real node_modules.
$tempInstallDir = Join-Path $env:TEMP "clawdbot-prod-nm-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Force -Path $tempInstallDir | Out-Null

# Select CN npm registry (same logic as macOS prepare-resources.sh)
$NpmRegistry = "https://registry.npmmirror.com"
$registryPingUrls = @(
    "https://registry.npmmirror.com",
    "https://registry.npm.taobao.org",
    "https://registry.npmjs.org"
)
foreach ($reg in $registryPingUrls) {
    try {
        $resp = Invoke-WebRequest -Uri "$reg/-/ping" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) { $NpmRegistry = $reg; break }
    } catch { }
}
Write-Host "  npm registry: $NpmRegistry"

Write-Host "  Strategy: npm install --omit=dev in temp dir (avoids pnpm hardlink expansion)"
Write-Host "  Temp dir: $tempInstallDir"

try {
    # Copy package.json (dependencies list) and .npmrc (registry) to temp dir
    Copy-Item "$ProjectRoot\package.json" "$tempInstallDir\package.json" -Force
    if (Test-Path "$ProjectRoot\.npmrc") {
        Copy-Item "$ProjectRoot\.npmrc" "$tempInstallDir\.npmrc" -Force
    }

    # Remove dependencies with git:// sub-deps (unreachable from CN network).
    # @whiskeysockets/baileys depends on libsignal-node via git+https://github.com/
    # which requires github.com access for git ls-remote. WhatsApp channel is not
    # needed in the desktop app, so we remove it before npm install.
    $gitDepPackages = @("@whiskeysockets/baileys")
    foreach ($pkg in $gitDepPackages) {
        Write-Host "  Removing git-dep package from temp package.json: $pkg"
        $pkgJson = Get-Content "$tempInstallDir\package.json" -Raw | ConvertFrom-Json
        if ($pkgJson.dependencies.PSObject.Properties[$pkg]) {
            $pkgJson.dependencies.PSObject.Properties.Remove($pkg)
        }
        if ($pkgJson.optionalDependencies -and $pkgJson.optionalDependencies.PSObject.Properties[$pkg]) {
            $pkgJson.optionalDependencies.PSObject.Properties.Remove($pkg)
        }
        if ($pkgJson.pnpm -and $pkgJson.pnpm.onlyBuiltDependencies) {
            $pkgJson.pnpm.onlyBuiltDependencies = @($pkgJson.pnpm.onlyBuiltDependencies | Where-Object { $_ -ne $pkg })
        }
        $pkgJson | ConvertTo-Json -Depth 10 | Set-Content "$tempInstallDir\package.json" -Encoding UTF8
    }

    # Run npm install with production deps only
    Write-Host "  Running npm install --omit=dev (registry: $NpmRegistry)..."
    Push-Location $tempInstallDir
    try {
        # Use cmd /c to avoid PowerShell $ErrorActionPreference="Stop" catching npm's
        # stderr warnings (deprecated packages) as terminating errors
        $npmLog = cmd /c "npm install --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps --registry $NpmRegistry 2>&1"
        $npmExitCode = $LASTEXITCODE
        Write-Host "  npm install exit code: $npmExitCode [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        # Show last few lines of output
        $npmLog -split "`n" | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" }

        if ($npmExitCode -ne 0) {
            Write-Host "  Full npm output:" -ForegroundColor Yellow
            $npmLog -split "`n" | ForEach-Object { Write-Host "    $_" }
            throw "npm install failed with exit code $npmExitCode"
        }
    } finally {
        Pop-Location
    }

    if (Test-Path "$tempInstallDir\node_modules") {
        # Measure temp node_modules size (sample first 500 files for speed)
        $sampleFiles = Get-ChildItem "$tempInstallDir\node_modules" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 500
        $sampleSize = ($sampleFiles | Measure-Object -Property Length -Sum).Sum
        $sampleCount = $sampleFiles.Count
        Write-Host "  Sample: $sampleCount files, avg $([math]::Round($sampleSize / [math]::Max($sampleCount, 1) / 1KB, 1)) KB/file"

        # Count total files
        $totalFiles = (Get-ChildItem "$tempInstallDir\node_modules" -Recurse -File -ErrorAction SilentlyContinue).Count
        Write-Host "  Total files in temp node_modules: $totalFiles"

        if ($totalFiles -gt 500000) {
            Write-Host "  WARNING: >500K files detected. This seems too large!" -ForegroundColor Red
        }

        # Copy to resources using robocopy (safe here — no hardlinks in npm's node_modules)
        # robocopy exit codes: 0-7 = success (1=copied, 2=extras, 4=mismatches), >=8 = error
        Write-Host "  Copying to resources dir..."
        robocopy "$tempInstallDir\node_modules" "$ResourcesDir\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy failed with exit code $LASTEXITCODE"
        }

        # Get final size
        $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        $nmFiles = (Get-ChildItem "$ResourcesDir\node_modules" -Recurse -File).Count
        Write-Host "  OK: node_modules/ ($nmSize MB, $nmFiles files) [npm prod] [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]" -ForegroundColor Green

        if ($nmSize -gt 5000) {
            Write-Host "  ALERT: node_modules > 5GB ($nmSize MB)! Aborting — likely hardlink expansion." -ForegroundColor Red
            Remove-Item "$ResourcesDir\node_modules" -Recurse -Force
            exit 1
        }
    } else {
        throw "npm install produced no node_modules directory"
    }
} catch {
    Write-Host "  ERROR: npm prod install failed: $_" -ForegroundColor Red
    Write-Host "  Attempting pnpm deploy --filter openclawcn --prod fallback..." -ForegroundColor Yellow

    # Fallback: try pnpm deploy with filter
    $deployDir = Join-Path $env:TEMP "clawdbot-pnpm-deploy"
    if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue }

    Push-Location $ProjectRoot
    try {
        pnpm deploy --filter openclawcn --prod "$deployDir" 2>&1 | Out-Null
        if (Test-Path "$deployDir\node_modules") {
            robocopy "$deployDir\node_modules" "$ResourcesDir\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
            if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
            $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
            Write-Host "  OK: node_modules/ ($nmSize MB) [pnpm deploy fallback] [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]" -ForegroundColor Green
        } else {
            throw "pnpm deploy also produced no node_modules"
        }
    } catch {
        Write-Host "  ERROR: All strategies failed. Cannot create production node_modules." -ForegroundColor Red
        Write-Host "  Last error: $_" -ForegroundColor Red
        exit 1
    } finally {
        Pop-Location
        if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue }
    }
} finally {
    # Clean up temp dir
    if (Test-Path $tempInstallDir) {
        Write-Host "  Cleaning temp dir..."
        Remove-Item $tempInstallDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
} # end if (-not $skipNpmInstall)

# ── 3b. Apply pnpm patches to production node_modules ──
# pnpm patchedDependencies only apply during pnpm install, not npm install.
# We must manually apply patches from the patches/ directory.
# Patch filename format: @scope__pkg@version.patch → @scope/pkg
#                         pkg@version.patch       → pkg
$patchesDir = Join-Path $ProjectRoot "patches"
if (Test-Path $patchesDir) {
    $patchFiles = Get-ChildItem $patchesDir -Filter "*.patch" -ErrorAction SilentlyContinue
    if ($patchFiles.Count -gt 0) {
        $patchCount = 0
        foreach ($patchFile in $patchFiles) {
            # Derive npm package name from pnpm patch filename
            $base = $patchFile.BaseName                            # e.g. @mariozechner__pi-coding-agent@0.52.12
            $pkgWithVer = $base
            # Strip trailing @version (last @ segment)
            $lastAt = $pkgWithVer.LastIndexOf('@')
            if ($lastAt -gt 0) {
                $pkgName = $pkgWithVer.Substring(0, $lastAt)       # e.g. @mariozechner__pi-coding-agent
            } else {
                $pkgName = $pkgWithVer
            }
            # Convert double-underscore back to slash for scoped packages
            $pkgName = $pkgName -replace '__', '/'                  # e.g. @mariozechner/pi-coding-agent
            $pkgDir = Join-Path "$ResourcesDir\node_modules" $pkgName

            if (-not (Test-Path $pkgDir)) {
                Write-Host "  Patch target not found, skipping: $pkgName ($($patchFile.Name))" -ForegroundColor Yellow
                continue
            }

            Write-Host "  Applying patch to ${pkgName}: $($patchFile.Name)" -ForegroundColor Cyan
            try {
                Push-Location $pkgDir
                $gitAvailable = Get-Command git -ErrorAction SilentlyContinue
                if ($gitAvailable) {
                    # Temporarily allow stderr from git apply (it writes warnings/errors
                    # to stderr even on success, which triggers NativeCommandError under
                    # $ErrorActionPreference = "Stop" and aborts the entire script).
                    $prevEAP = $ErrorActionPreference
                    $ErrorActionPreference = "Continue"
                    # Check if already applied (dry-run reverse)
                    git apply --no-index --reverse --check "$($patchFile.FullName)" 2>&1 | Out-Null
                    if ($LASTEXITCODE -eq 0) {
                        $ErrorActionPreference = $prevEAP
                        Write-Host "    Already applied, skipping: $($patchFile.Name)" -ForegroundColor Green
                        $patchCount++
                    } else {
                        # Actually apply
                        $applyOutput = git apply --no-index --ignore-whitespace "$($patchFile.FullName)" 2>&1
                        $ErrorActionPreference = $prevEAP
                        if ($LASTEXITCODE -eq 0) {
                            $patchCount++
                        } else {
                            Write-Host "  FAILED to apply patch: $($patchFile.Name) to $pkgName" -ForegroundColor Red
                            Write-Host "  $applyOutput" -ForegroundColor Red
                            Write-Host "  This may cause runtime crashes. Check if package version matches patch." -ForegroundColor Red
                        }
                    }
                } else {
                    Write-Host "  WARNING: git not available for patch application. Patch skipped: $($patchFile.Name)" -ForegroundColor Yellow
                }
            } finally {
                Pop-Location
            }
        }
        if ($patchCount -gt 0) {
            Write-Host "  Applied $patchCount patch(es) to production node_modules" -ForegroundColor Green
        }
    }
}

# NOTE: Stub injection for @whiskeysockets/baileys moved to after step 4b
# (extension dependency install) to prevent npm install from overwriting stubs.

# ── 4. Extensions ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[4/9] Copying extensions/..." -ForegroundColor Green
$extSource = "$ProjectRoot\extensions"
if (Test-Path $extSource) {
    robocopy "$extSource" "$ResourcesDir\extensions" /E /XD node_modules .turbo .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ($LASTEXITCODE -ge 8) {
        Write-Host "  ERROR: robocopy extensions failed (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
    $extCount = (Get-ChildItem "$ResourcesDir\extensions" -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "  OK: extensions/ ($extCount extensions) [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"

    # ── 4a. Remove .ts source files from compiled extensions ──
    # Extensions listed in cn_extension_build have pre-compiled .js files.
    # If .ts files remain, the plugin discovery (index.ts > index.js priority)
    # will load the .ts via jiti, which fails in the packaged environment because
    # the bundled openclawcn/plugin-sdk uses chunk references that jiti cannot resolve.
    $cnExtDirs = node -e "
        const cfg = require('$($ProjectRoot -replace '\\','/')/config/cn-protected-files.json');
        (cfg.cn_extension_build?.directories || []).forEach(d => console.log(d));
    " 2>$null
    $tsRemoved = 0
    if ($cnExtDirs) {
        foreach ($extRel in ($cnExtDirs -split "`n")) {
            $extRel = $extRel.Trim()
            if (-not $extRel) { continue }
            $extAbs = Join-Path $ResourcesDir $extRel
            if (Test-Path $extAbs) {
                Get-ChildItem $extAbs -Recurse -Filter "*.ts" -File | Where-Object { $_.Name -notmatch '\.d\.ts$' } | ForEach-Object {
                    Remove-Item $_.FullName -Force
                    $tsRemoved++
                }
            }
        }
    }
    if ($tsRemoved -gt 0) {
        Write-Host "  Removed $tsRemoved .ts source files from compiled extensions (keeps .js only)"
    }

    # Also rewrite package.json "extensions" entries from .ts to .js
    # so that plugin discovery resolves to the compiled .js files.
    $pkgRewritten = 0
    if ($cnExtDirs) {
        foreach ($extRel in ($cnExtDirs -split "`n")) {
            $extRel = $extRel.Trim()
            if (-not $extRel) { continue }
            $extPkgPath = Join-Path $ResourcesDir ($extRel + "package.json")
            if (Test-Path $extPkgPath) {
                $content = Get-Content $extPkgPath -Raw -Encoding UTF8
                if ($content -match '\.ts"') {
                    $content = $content -replace '\.ts"', '.js"'
                    Set-Content $extPkgPath -Value $content -Encoding UTF8 -NoNewline
                    $pkgRewritten++
                }
            }
        }
    }
    if ($pkgRewritten -gt 0) {
        Write-Host "  Rewrote $pkgRewritten package.json files (.ts -> .js references)"
    }

    # ── 4b. Install extension-specific dependencies into bundled node_modules ──
    # Extensions have their own package.json with dependencies (e.g. dingtalk-stream,
    # qq-bot-sdk) that are NOT in the main package.json. We must install them into
    # the shared resources/node_modules so extensions can require() them at runtime.
    Write-Host "  Installing extension dependencies..." -ForegroundColor Green
    $extDepsMissing = @()
    $extDepsInstalled = @()
    Get-ChildItem "$extSource" -Directory | ForEach-Object {
        $extPkgJson = Join-Path $_.FullName "package.json"
        if (Test-Path $extPkgJson) {
            $extPkg = Get-Content $extPkgJson -Raw -Encoding UTF8 | ConvertFrom-Json
            $deps = $extPkg.dependencies
            if ($deps) {
                $deps.PSObject.Properties | ForEach-Object {
                    $depName = $_.Name
                    $depVersion = $_.Value
                    $depDir = Join-Path "$ResourcesDir\node_modules" $depName
                    if (-not (Test-Path $depDir)) {
                        $extDepsMissing += "$depName@$depVersion"
                    }
                }
            }
        }
    }
    if ($extDepsMissing.Count -gt 0) {
        $uniqueDeps = $extDepsMissing | Select-Object -Unique
        Write-Host "  Missing extension deps: $($uniqueDeps -join ', ')" -ForegroundColor Yellow
        Push-Location "$ResourcesDir"
        try {
            # Use the real package.json so npm doesn't prune existing production deps
            Copy-Item "$ProjectRoot\package.json" "$ResourcesDir\package.json" -Force
            if (Test-Path "$ProjectRoot\.npmrc") {
                Copy-Item "$ProjectRoot\.npmrc" "$ResourcesDir\.npmrc" -Force
            }
            $npmArgs = @("install") + $uniqueDeps + @("--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps", "--registry", $NpmRegistry)
            $npmLog = cmd /c "npm $($npmArgs -join ' ') 2>&1"
            $npmExitCode = $LASTEXITCODE
            if ($npmExitCode -eq 0) {
                Write-Host "  OK: installed $($uniqueDeps.Count) extension deps" -ForegroundColor Green
            } else {
                Write-Host "  WARNING: npm install for extension deps failed (exit $npmExitCode)" -ForegroundColor Red
                $npmLog -split "`n" | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" }
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "  All extension deps already present in node_modules"
    }
} else {
    Write-Host "  WARNING: extensions/ not found." -ForegroundColor Yellow
}

# ── 4c. Inject stub modules for stripped packages ──
# MUST run AFTER step 4b (extension dependency install) to prevent npm from
# overwriting stubs with broken/incomplete real packages.
# The plugin-sdk bundle has require("@whiskeysockets/baileys") calls (WhatsApp
# onboarding adapter marked as external). Without a stub, ALL plugins crash
# with "Cannot find module '@whiskeysockets/baileys'".
$stubPackages = @("@whiskeysockets/baileys")
foreach ($stubPkg in $stubPackages) {
    $stubDir = Join-Path $ResourcesDir "node_modules\$stubPkg"
    # Force-create (overwrite if exists) — npm install may have left a broken copy
    New-Item -ItemType Directory -Force -Path $stubDir | Out-Null
    # package.json: must NOT have "type":"module" so index.js is treated as CJS.
    # exports map provides both require (CJS) and import (ESM) paths.
    @'
{
  "name": "@whiskeysockets/baileys",
  "version": "0.0.0-stub",
  "main": "index.js",
  "exports": {
    ".": {
      "require": "./index.js",
      "import": "./index.mjs",
      "default": "./index.js"
    }
  },
  "description": "Stub: WhatsApp channel not available in desktop builds"
}
'@ | Set-Content "$stubDir\package.json" -Encoding UTF8
    # CJS stub (for require() calls)
    @'
// Stub module — @whiskeysockets/baileys is not bundled in desktop builds.
// WhatsApp channel features are unavailable; all exported symbols are no-ops.
function noop() { return undefined; }
const noopProxy = new Proxy(noop, {
  get(_, prop) {
    if (prop === Symbol.toPrimitive) return () => "";
    if (prop === Symbol.iterator) return undefined;
    if (prop === "then") return undefined;
    if (prop === "default") return noopProxy;
    return noopProxy;
  },
  apply() { return undefined; },
});
// Explicit named exports required by plugin-sdk ESM import binding:
exports.DisconnectReason = { loggedOut: "loggedOut", connectionClosed: "connectionClosed", connectionLost: "connectionLost", connectionReplaced: "connectionReplaced", timedOut: "timedOut", forbidden: "403", badSession: "bad session", restartRequired: "restart required", multideviceMismatch: "multidevice mismatch" };
exports.fetchLatestBaileysVersion = async function() { return { version: [2,3000,0], isLatest: true }; };
exports.makeCacheableSignalKeyStore = function(store) { return store || {}; };
exports.makeWASocket = function() { return noopProxy; };
exports.useMultiFileAuthState = async function() { return { state: {}, saveCreds: noop }; };
exports.default = noopProxy;
module.exports = Object.assign(noopProxy, exports);
'@ | Set-Content "$stubDir\index.js" -Encoding UTF8
    # ESM stub (for import {} from baileys in plugin-sdk — Node 22 resolves via exports map)
    @'
// ESM stub for @whiskeysockets/baileys
function noop() { return undefined; }
export const DisconnectReason = { loggedOut: "loggedOut", connectionClosed: "connectionClosed", connectionLost: "connectionLost", connectionReplaced: "connectionReplaced", timedOut: "timedOut", forbidden: "403", badSession: "bad session", restartRequired: "restart required", multideviceMismatch: "multidevice mismatch" };
export const fetchLatestBaileysVersion = async function() { return { version: [2,3000,0], isLatest: true }; };
export const makeCacheableSignalKeyStore = function(store) { return store || {}; };
export const makeWASocket = function() { return {}; };
export const useMultiFileAuthState = async function() { return { state: {}, saveCreds: noop }; };
export const proto = {};
export default {};
'@ | Set-Content "$stubDir\index.mjs" -Encoding UTF8
    Write-Host "  Injected stub module: $stubPkg (CJS+ESM, with named exports)"
}

# Verify all stub packages were actually written (prevents silent failure)
foreach ($stubPkg in $stubPackages) {
    $stubDir = Join-Path $ResourcesDir "node_modules\$stubPkg"
    foreach ($stubFile in @("package.json", "index.js", "index.mjs")) {
        $stubPath = Join-Path $stubDir $stubFile
        if (-not (Test-Path $stubPath)) {
            Write-Host "  CRITICAL: Stub file missing: $stubPath" -ForegroundColor Red
            Write-Host "  Without this stub, ALL plugins will crash at runtime." -ForegroundColor Red
            exit 1
        }
        $stubSize = (Get-Item $stubPath).Length
        if ($stubSize -lt 50) {
            Write-Host "  CRITICAL: Stub file too small (${stubSize} bytes): $stubPath" -ForegroundColor Red
            Write-Host "  File may be empty or truncated. ALL plugins will crash." -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "  Verified stub: $stubPkg (package.json + index.js + index.mjs, content OK)" -ForegroundColor Green
}

# ── 4d. Create openclawcn self-referencing package in node_modules ──
# Extensions import "openclawcn/plugin-sdk" which resolves via the workspace
# package in development. In the packaged app, we must create a real package
# entry in node_modules/openclawcn pointing to dist/ so extensions can require it.
$selfPkgDir = Join-Path $ResourcesDir "node_modules\openclawcn"
New-Item -ItemType Directory -Force -Path $selfPkgDir | Out-Null
# Copy the root package.json (contains the exports map for ./plugin-sdk etc.)
$rootPkgJson = Get-Content "$ProjectRoot\package.json" -Raw -Encoding UTF8
Set-Content "$selfPkgDir\package.json" -Value $rootPkgJson -Encoding UTF8
# Create a symlink/junction from node_modules/openclawcn/dist → resources/dist
# Use a junction (no admin rights needed on Windows)
$junctionTarget = Join-Path $ResourcesDir "dist"
$junctionPath = Join-Path $selfPkgDir "dist"
if (-not (Test-Path $junctionPath)) {
    cmd /c "mklink /J `"$junctionPath`" `"$junctionTarget`"" | Out-Null
}
# Also link the CLI entry point
$cliEntry = Join-Path $ResourcesDir "dist\entry.js"
if (Test-Path $cliEntry) {
    Copy-Item $cliEntry "$selfPkgDir\openclawcn.mjs" -Force -ErrorAction SilentlyContinue
}
Write-Host "  Created openclawcn self-referencing package in node_modules (plugin-sdk exports available)"

# ── 4e. Create resources/src/infra/dedupe.js CJS shim ──
# hook-error-logger.jsc uses compiled dev path "../../../src/infra/dedupe.js"
# which resolves to resources/src/infra/dedupe.js in the packaged app.
# dist/infra/dedupe.js is ESM (cannot be require()-d as CJS); generate a CJS shim.
$srcInfraDir = Join-Path $ResourcesDir "src\infra"
New-Item -ItemType Directory -Force -Path $srcInfraDir | Out-Null
@'
// CJS shim for src/infra/dedupe.js — generated by prepare-resources.ps1
function createDedupeCache(options) {
    const ttlMs = Math.max(0, options.ttlMs);
    const maxSize = Math.max(0, Math.floor(options.maxSize));
    const cache = new Map();
    let operationsSinceLastPrune = 0;
    const PRUNE_INTERVAL = 10;
    let lastPruneTime = Date.now();
    const MIN_PRUNE_INTERVAL_MS = 100;
    const touch = (key, now) => { cache.delete(key); cache.set(key, now); };
    const maybePrune = (now) => {
        const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
        if (cutoff !== undefined) {
            for (const [entryKey, entryTs] of cache) { if (entryTs < cutoff) cache.delete(entryKey); }
        }
        if (maxSize > 0 && cache.size > maxSize) {
            while (cache.size > maxSize) { const k = cache.keys().next().value; if (!k) break; cache.delete(k); }
            operationsSinceLastPrune = 0; lastPruneTime = now; return;
        }
        operationsSinceLastPrune++;
        if (operationsSinceLastPrune >= PRUNE_INTERVAL && now - lastPruneTime >= MIN_PRUNE_INTERVAL_MS) {
            if (maxSize > 0 && cache.size > maxSize * 0.9) {
                while (cache.size > maxSize) { const k = cache.keys().next().value; if (!k) break; cache.delete(k); }
            }
            operationsSinceLastPrune = 0; lastPruneTime = now;
        }
    };
    return {
        check: (key, now = Date.now()) => {
            if (!key) return false;
            const existing = cache.get(key);
            if (existing !== undefined && (ttlMs <= 0 || now - existing < ttlMs)) { touch(key, now); return true; }
            touch(key, now); maybePrune(now); return false;
        },
        clear: () => { cache.clear(); },
        size: () => cache.size,
    };
}
exports.createDedupeCache = createDedupeCache;
'@ | Set-Content (Join-Path $srcInfraDir "dedupe.js") -Encoding UTF8
Write-Host "  Created src/infra/dedupe.js CJS shim (for hook-error-logger.jsc)"

# ── 5. Skills ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[5/9] Copying skills/..." -ForegroundColor Green
# Skills that must NOT be bundled (WeChat/WeCom desktop automation — in skills-private/)
$excludedSkills = @("wechat-desktop", "wecom-desktop")
$skillsSources = @(
    "$ProjectRoot\skills-merged",
    "$ProjectRoot\skills",
    "E:\clawdbuild\full-skills"
)
$skillsFound = $false
New-Item -ItemType Directory -Force -Path "$ResourcesDir\skills" | Out-Null
foreach ($src in $skillsSources) {
    if (Test-Path $src) {
        # Copy all skill directories except excluded ones (merge from all sources)
        Get-ChildItem $src -Directory | Where-Object { $_.Name -notin $excludedSkills } | ForEach-Object {
            $destSkillDir = "$ResourcesDir\skills\$($_.Name)"
            if (-not (Test-Path $destSkillDir)) {
                Copy-Item $_.FullName $destSkillDir -Recurse -Force
            }
        }
        # Also copy any top-level files (README, index, etc.)
        Get-ChildItem $src -File -ErrorAction SilentlyContinue | ForEach-Object {
            Copy-Item $_.FullName "$ResourcesDir\skills\$($_.Name)" -Force
        }
        $skillsCount = (Get-ChildItem "$ResourcesDir\skills" -Directory -ErrorAction SilentlyContinue).Count
        $skippedList = ($excludedSkills | Where-Object { Test-Path "$src\$_" }) -join ", "
        Write-Host "  OK: skills/ ($skillsCount skills total) merged from $src [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        if ($skippedList) {
            Write-Host "  Excluded: $skippedList" -ForegroundColor Yellow
        }
        $skillsFound = $true
        # Continue to merge from next source (no break)
    }
}
# NOTE: skills-private/ is intentionally NOT copied (contains wechat-desktop, wecom-desktop)
if (-not $skillsFound) {
    Write-Host "  ERROR: skills/ directory not found! Skills page will be empty." -ForegroundColor Red
    exit 1
}
# Verify minimum skills count
$bundledSkillsCount = (Get-ChildItem "$ResourcesDir\skills" -Directory -ErrorAction SilentlyContinue).Count
if ($bundledSkillsCount -lt 500) {
    Write-Host "  ERROR: Only $bundledSkillsCount skills bundled — expected 500+. Check git push completeness." -ForegroundColor Red
    exit 1
}

# ── 6. Bundled tool binaries (CN users cannot access GitHub to download) ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[6/9] Copying bundled tool binaries..." -ForegroundColor Green
$bundledBinsSources = @(
    "$ProjectRoot\scripts\windows\bundled-bins",
    "E:\openclawcn\bundled-bins"
)
$toolsDir = Join-Path $ResourcesDir "tools"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$binsCopied = 0
foreach ($src in $bundledBinsSources) {
    if (Test-Path $src) {
        Get-ChildItem "$src\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
            Copy-Item $_.FullName "$toolsDir\$($_.Name)" -Force
            $binsCopied++
        }
        $binsSize = [math]::Round(((Get-ChildItem "$toolsDir\*.exe" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
        Write-Host "  OK: tools/ ($binsCopied binaries, $binsSize MB) from $src [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        break
    }
}
if ($binsCopied -eq 0) {
    Write-Host "  WARNING: No bundled-bins found. Tool binaries will not be pre-installed." -ForegroundColor Yellow
    Write-Host "  Looked in:" -ForegroundColor Yellow
    foreach ($src in $bundledBinsSources) { Write-Host "    - $src" -ForegroundColor Yellow }
}

# ── 7. Data & docs ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[7/9] Copying data and docs..." -ForegroundColor Green
$dataResDir = Join-Path $ResourcesDir "data"
New-Item -ItemType Directory -Force -Path $dataResDir | Out-Null
if (Test-Path "$ProjectRoot\data") {
    # Copy selective seed data (not user runtime data like sessions, logs)
    # SECURITY: Never include clawdbot.json (contains channel secrets, API keys),
    #           agents/ (contains auth-profiles with API keys, session logs),
    #           identity/ (contains device-auth tokens).
    #           These are user-specific runtime data, not distributable seed data.
    $seedFiles = @(
        "mcp-index.db",
        "mcp-index.json",
        "tool-index.sqlite",
        "skill-availability-dictionary.json",
        "skill-availability-schema.json",
        "skill-verification-needed.json",
        "skills-availability-dictionary.json",
        "skills-availability-dictionary-enriched.json",
        "README-skill-availability.md"
    )
    $seedDirs = @("subagents", "qrcodes")
    foreach ($f in $seedFiles) {
        $src = Join-Path "$ProjectRoot\data" $f
        if (Test-Path $src) {
            if ($f -match '\.db$|\.sqlite$') {
                # SQLite: use VACUUM INTO to merge WAL and produce a clean single-file copy
                # This prevents "database disk image is malformed" in the packaged app
                # NOTE: Uses node:sqlite (built-in), NOT better-sqlite3 (removed from project)
                $dst = "$dataResDir\$f"
                $srcFwd = $src -replace '\\','/'
                $dstFwd = $dst -replace '\\','/'
                # Temporarily allow non-terminating errors: Node.js prints
                # "(node:PID) ExperimentalWarning: SQLite is an experimental feature"
                # to stderr, which PowerShell treats as NativeCommandError under $ErrorActionPreference=Stop.
                $prevEAP = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                $vacuumResult = & node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';
try {
  const db = new DatabaseSync('$srcFwd', { readOnly: true });
  db.exec(``VACUUM INTO '$dstFwd'``);
  db.close();
  process.stdout.write('OK');
} catch(e) {
  process.stdout.write('FAIL:' + e.message);
}" 2>$null
                $ErrorActionPreference = $prevEAP
                if ($vacuumResult -match '^OK') {
                    Write-Host "  Checkpointed $f (VACUUM INTO clean copy)"
                } else {
                    # Fallback: plain copy (still works, just may include WAL data)
                    Copy-Item $src $dst -Force
                    Write-Host "  Copied $f (VACUUM failed: $vacuumResult)"
                }
            } else {
                Copy-Item $src "$dataResDir\$f" -Force
            }
        }
    }
    # Remove any WAL/SHM files that NSIS would otherwise package alongside the db
    Get-ChildItem $dataResDir -Filter "*.db-wal" -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem $dataResDir -Filter "*.db-shm" -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem $dataResDir -Filter "*.sqlite-wal" -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem $dataResDir -Filter "*.sqlite-shm" -ErrorAction SilentlyContinue | Remove-Item -Force
    Write-Host "  Removed WAL/SHM leftover files from resources/data"

    # Copy mcp-index-enhanced (any version: v4, v5, etc.)
    Get-ChildItem "$ProjectRoot\data\mcp-index-enhanced*.json" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName "$dataResDir\$($_.Name)" -Force
    }
    foreach ($d in $seedDirs) {
        $src = Join-Path "$ProjectRoot\data" $d
        if (Test-Path $src) {
            Copy-Item $src "$dataResDir\$d" -Recurse -Force
        }
    }
    # CRITICAL: mcp-index.json MUST be copied from project data/ — it is the baseline
    # for the MCP marketplace. Without it the DB is empty and all items show "暂不可安装".
    # DO NOT replace with an empty seed — Desktop mode skips runtime sync so the DB
    # will never be populated if the bundled json is missing.
    $mcpIndexPath = Join-Path $dataResDir "mcp-index.json"
    $mcpIndexSrc  = Join-Path $ProjectRoot "data\mcp-index.json"
    if (-not (Test-Path $mcpIndexPath)) {
        if (Test-Path $mcpIndexSrc) {
            Copy-Item $mcpIndexSrc $mcpIndexPath -Force
            $sz = [math]::Round((Get-Item $mcpIndexPath).Length / 1MB, 1)
            Write-Host "  Copied mcp-index.json ($sz MB) from project data/"
        } else {
            Write-Host "  ERROR: data\mcp-index.json not found at $mcpIndexSrc" -ForegroundColor Red
            Write-Host "  MCP marketplace will be empty for all users!" -ForegroundColor Red
            exit 1
        }
    }
    # Verify MCP index has enough items (use node to avoid PowerShell 5.x JSON/encoding bugs)
    $mcpItems = 0
    try {
        $mcpItems = [int](node -e "const d=require('$($mcpIndexPath -replace '\\','/')');process.stdout.write(String((d.items||[]).length))" 2>$null)
    } catch { }
    if ($mcpItems -lt 1000) {
        Write-Host "  ERROR: MCP index only has $mcpItems items — expected 1000+. MCP page will be nearly empty!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  MCP index: $mcpItems items"
    # Check enhanced index
    $enhancedCount = (Get-ChildItem "$dataResDir\mcp-index-enhanced*.json" -ErrorAction SilentlyContinue).Count
    if ($enhancedCount -gt 0) {
        Write-Host "  MCP enhanced index: $enhancedCount files"
    } else {
        Write-Host "  WARNING: No mcp-index-enhanced*.json — Chinese translations missing" -ForegroundColor Yellow
    }
    $dataSize = [math]::Round(((Get-ChildItem $dataResDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
    Write-Host "  OK: data/ ($dataSize MB, seed data only)"
} else {
    Write-Host "  ERROR: data/ not found at $ProjectRoot\data" -ForegroundColor Red
    Write-Host "  MCP marketplace and Skills pages will be empty!" -ForegroundColor Red
    Write-Host "  Ensure data/mcp-index.json is populated before build." -ForegroundColor Red
    exit 1
}
# 🔥 P0 修复: 先复制 docs/reference/templates/ 作为 base，再用 CN 版本覆盖
# 之前只从 docs-cn/ 复制（目录只有 .gitkeep），导致模板缺失，chat 无法使用
if (Test-Path "$ProjectRoot\docs\reference\templates") {
    New-Item -ItemType Directory -Force -Path "$ResourcesDir\docs\reference" | Out-Null
    Copy-Item "$ProjectRoot\docs\reference\templates" "$ResourcesDir\docs\reference\templates" -Recurse -Force
    Write-Host "  OK: docs/reference/templates/ (base)"
}
# CN overlay: 覆盖上游模板（如果有 CN 本地化版本）
if (Test-Path "$ProjectRoot\cn\docs-cn\reference\templates") {
    New-Item -ItemType Directory -Force -Path "$ResourcesDir\docs\reference\templates" | Out-Null
    Copy-Item "$ProjectRoot\cn\docs-cn\reference\templates\*" "$ResourcesDir\docs\reference\templates\" -Force
    Write-Host "  OK: docs/reference/templates/ (CN overlay)"
}
Write-Host "  [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"

# ── 8. Build metadata ──
Write-Host "[8/9] Copying build metadata..." -ForegroundColor Green
Copy-Item "$ProjectRoot\package.json" "$ResourcesDir\package.json" -Force
Write-Host "  OK: package.json"

# Generate install.json for auto-update system
# - installer-updater.ts::detectInstallKind() checks for this file -> returns "installer"
# - installer-updater.ts::resolveUpdateServerUrl() reads the updateServer field
$appVersion = (Get-Content "$ProjectRoot\package.json" -Raw | ConvertFrom-Json).version
$installJson = @{
    installKind  = "installer"
    updateServer = "https://www.obplugins.cn"
    version      = $appVersion
} | ConvertTo-Json -Compress
# Use .NET API to write UTF-8 without BOM (PowerShell 5.x -Encoding UTF8 adds BOM)
[System.IO.File]::WriteAllText("$ResourcesDir\install.json", $installJson, [System.Text.UTF8Encoding]::new($false))
Write-Host "  OK: install.json (version=$appVersion)"

# Generate build-meta.json — records Node.js and V8 versions used during build.
# At startup, entry.js checks this to detect node.exe / .jsc bytecode version mismatch
# (e.g. delta update replaced node.exe but not .jsc, or vice versa → V8 crash).
$nodeExe = "$ResourcesDir\node\node.exe"
if (Test-Path $nodeExe) {
    $prevEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $buildNodeVersion = (& $nodeExe -e "process.stdout.write(process.version)" 2>$null)
    $buildV8Version   = (& $nodeExe -e "process.stdout.write(process.versions.v8)" 2>$null)
    $ErrorActionPreference = $prevEA
} else {
    # CRITICAL: Do NOT fall back to system node — its V8 version may differ from the
    # bundled node.exe, causing build-meta.json to record wrong versions.
    Write-Host "  ERROR: Bundled node.exe not found at $nodeExe" -ForegroundColor Red
    Write-Host "  Cannot generate accurate build-meta.json. Aborting." -ForegroundColor Red
    exit 1
}
$buildMeta = @{
    nodeVersion = $buildNodeVersion
    v8Version   = $buildV8Version
    buildTime   = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    appVersion  = $appVersion
} | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText("$ResourcesDir\dist\build-meta.json", $buildMeta, [System.Text.UTF8Encoding]::new($false))
Write-Host "  OK: build-meta.json (node=$buildNodeVersion, v8=$buildV8Version)"

# ── 9. Launch scripts and service binary ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[9/9] Copying launch scripts and assets..." -ForegroundColor Green
$winScriptsDir = "$ProjectRoot\scripts\windows"
$launchFiles = @("start-gateway.bat", "clawdbot.bat", "diagnose.bat", "view-logs.bat")
foreach ($f in $launchFiles) {
    $src = Join-Path $winScriptsDir $f
    if (Test-Path $src) {
        Copy-Item $src "$ResourcesDir\$f" -Force
        Write-Host "  OK: $f"
    }
}
# ClawdbotService.exe (native tray service)
$svcExe = Join-Path $winScriptsDir "native\ClawdbotService.exe"
if (Test-Path $svcExe) {
    Copy-Item $svcExe "$ResourcesDir\ClawdbotService.exe" -Force
    Write-Host "  OK: ClawdbotService.exe"
}
# Assets (icon, loading page)
$assetsDir = "$ProjectRoot\assets"
if (Test-Path $assetsDir) {
    Copy-Item $assetsDir "$ResourcesDir\assets" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK: assets/"
}
Write-Host "  [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"

# ── Summary ──
$totalSize = [math]::Round(((Get-ChildItem $ResourcesDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
$totalElapsed = $totalTimer.Elapsed
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Resources ready: $totalSize MB"         -ForegroundColor Green
Write-Host " Output: $ResourcesDir"                  -ForegroundColor Green
Write-Host " Time: $($totalElapsed.Minutes)m $($totalElapsed.Seconds)s"  -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Sanity checks
if ($totalSize -gt 5000) {
    Write-Host " WARNING: Resources > 5GB ($totalSize MB). Check for pnpm hardlink expansion!" -ForegroundColor Red
}
if ($totalSize -lt 100) {
    Write-Host " WARNING: Resources < 100MB ($totalSize MB). Likely missing node_modules!" -ForegroundColor Red
}
