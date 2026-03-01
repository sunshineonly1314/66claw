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
if (Test-Path $ResourcesDir) {
    Write-Host "[Clean] Removing old resources..." -ForegroundColor Yellow
    Remove-Item $ResourcesDir -Recurse -Force
    Write-Host "  Done."
}
New-Item -ItemType Directory -Force -Path $ResourcesDir | Out-Null

# ── 1. Node.js runtime ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[1/9] Copying Node.js runtime..." -ForegroundColor Green
$nodeDir = Join-Path $ResourcesDir "node"
New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null

$NodeVersion = if ($env:NODE_VERSION) { $env:NODE_VERSION } else { "22.16.0" }
$nodeSources = @(
    "$ProjectRoot\scripts\windows\node-portable\node.exe",
    "$ProjectRoot\scripts\windows\node\node.exe"
)
$nodeFound = $false
foreach ($src in $nodeSources) {
    if (Test-Path $src) {
        Copy-Item $src "$nodeDir\node.exe" -Force
        $nodeFound = $true
        $size = [math]::Round((Get-Item "$nodeDir\node.exe").Length / 1MB, 2)
        Write-Host "  OK: node.exe ($size MB) from $src [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        break
    }
}
# Fallback: download from CN mirror (npmmirror) if not found locally
if (-not $nodeFound) {
    Write-Host "  node.exe not found locally, downloading from CN mirror..." -ForegroundColor Yellow
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
                # node.exe is inside node-vXX.XX.X-win-x64/node.exe
                $extractedNode = Get-ChildItem "$extractDir\*\node.exe" -Recurse | Select-Object -First 1
                if ($extractedNode) {
                    Copy-Item $extractedNode.FullName "$nodeDir\node.exe" -Force
                    $nodeFound = $true
                    $size = [math]::Round((Get-Item "$nodeDir\node.exe").Length / 1MB, 2)
                    Write-Host "  OK: node.exe ($size MB) downloaded from CN mirror [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]" -ForegroundColor Green
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
    Write-Host "  ERROR: node.exe not found and download failed!" -ForegroundColor Red
    Write-Host "  Tried local paths:" -ForegroundColor Red
    foreach ($src in $nodeSources) {
        Write-Host "    - $src" -ForegroundColor Red
    }
    Write-Host "  Tried CN mirrors:" -ForegroundColor Red
    Write-Host "    - https://npmmirror.com/mirrors/node/v$NodeVersion/" -ForegroundColor Red
    exit 1
}

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

# ── 5. Skills ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[5/9] Copying skills/..." -ForegroundColor Green
# Skills that must NOT be bundled (WeChat/WeCom desktop automation — in skills-private/)
$excludedSkills = @("wechat-desktop", "wecom-desktop")
$skillsSources = @(
    "$ProjectRoot\skills-merged",
    "$ProjectRoot\skills"
)
$skillsFound = $false
foreach ($src in $skillsSources) {
    if (Test-Path $src) {
        # Copy all skill directories except excluded ones
        New-Item -ItemType Directory -Force -Path "$ResourcesDir\skills" | Out-Null
        Get-ChildItem $src -Directory | Where-Object { $_.Name -notin $excludedSkills } | ForEach-Object {
            Copy-Item $_.FullName "$ResourcesDir\skills\$($_.Name)" -Recurse -Force
        }
        # Also copy any top-level files (README, index, etc.)
        Get-ChildItem $src -File -ErrorAction SilentlyContinue | ForEach-Object {
            Copy-Item $_.FullName "$ResourcesDir\skills\$($_.Name)" -Force
        }
        $skillsCount = (Get-ChildItem "$ResourcesDir\skills" -Directory -ErrorAction SilentlyContinue).Count
        $skippedList = ($excludedSkills | Where-Object { Test-Path "$src\$_" }) -join ", "
        Write-Host "  OK: skills/ ($skillsCount skills) from $src [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        if ($skippedList) {
            Write-Host "  Excluded: $skippedList" -ForegroundColor Yellow
        }
        $skillsFound = $true
        break
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
            Copy-Item $src "$dataResDir\$f" -Force
        }
    }
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
    # Ensure mcp-index.json exists (Gateway warns if missing).
    # A minimal seed is enough - runtime sync will fetch the full index.
    $mcpIndexPath = Join-Path $dataResDir "mcp-index.json"
    if (-not (Test-Path $mcpIndexPath)) {
        Write-Host "  Creating minimal mcp-index.json seed (full index synced at runtime)"
        $seedJson = '{"items":[],"generated":"' + (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") + '","seed":true}'
        Set-Content -Path $mcpIndexPath -Value $seedJson -Encoding UTF8
    }
    # Verify MCP index has enough items
    $mcpItems = 0
    try {
        $mcpData = Get-Content $mcpIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $mcpItems = $mcpData.items.Count
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
    $buildNodeVersion = (& node -e "process.stdout.write(process.version)" 2>$null)
    $buildV8Version   = (& node -e "process.stdout.write(process.versions.v8)" 2>$null)
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
