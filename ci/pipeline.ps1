<#
.SYNOPSIS
  ClawdbotCN 一键打包流水线 — 总入口
.DESCRIPTION
  串联 5 个阶段: prepare → build → verify → collect → deploy
  每个阶段独立脚本，失败即停，可单独重跑或 -Retry 从失败处续跑。
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File ci/pipeline.ps1
  powershell -File ci/pipeline.ps1 -SkipDeploy
  powershell -File ci/pipeline.ps1 -Platform windows
  powershell -File ci/pipeline.ps1 -StartFrom verify
  powershell -File ci/pipeline.ps1 -Retry
#>
param(
    [switch]$SkipDeploy,
    [ValidateSet("all","windows","macos")]
    [string]$Platform = "all",
    [ValidateSet("","prepare","build","verify","collect","deploy")]
    [string]$StartFrom = "",
    [switch]$Retry
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = (Resolve-Path "$SCRIPT_DIR\..").Path

# ── Timestamp & log directory ──
$TS = Get-Date -Format 'yyyyMMdd_HHmmss'
$LOG_DIR = Join-Path $SCRIPT_DIR "logs\pipeline-$TS"
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

$STATE_FILE = Join-Path $LOG_DIR "state.ps1"
# Initialize state file
@"
# Pipeline state — auto-generated $TS
`$PL_TIMESTAMP = "$TS"
`$PL_LOG_DIR = "$LOG_DIR"
`$PL_PLATFORM = "$Platform"
"@ | Set-Content $STATE_FILE -Encoding UTF8

# ── Retry: find last state file ──
if ($Retry) {
    $lastPipelineDir = Get-ChildItem "$SCRIPT_DIR\logs" -Directory -Filter "pipeline-*" |
        Where-Object { $_.Name -ne "pipeline-$TS" } |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($lastPipelineDir) {
        $lastState = Join-Path $lastPipelineDir.FullName "state.ps1"
        if (Test-Path $lastState) {
            . $lastState
            if ($PL_LAST_STATUS -eq "fail" -and $PL_LAST_PHASE) {
                $phases = @("prepare","build","verify","collect","deploy")
                $failIdx = [Array]::IndexOf($phases, $PL_LAST_PHASE)
                if ($failIdx -ge 0) {
                    $StartFrom = $PL_LAST_PHASE
                    # Copy previous state to new state file (carry forward completed phases)
                    Copy-Item $lastState $STATE_FILE -Force
                    # Update timestamp
                    Add-Content $STATE_FILE "`n`$PL_TIMESTAMP = `"$TS`""
                    Write-Host "Retrying from phase: $StartFrom (last run failed here)" -ForegroundColor Yellow
                }
            } else {
                Write-Host "Last pipeline succeeded — nothing to retry. Starting fresh." -ForegroundColor Green
                $StartFrom = ""
            }
        }
    } else {
        Write-Host "No previous pipeline run found — starting fresh." -ForegroundColor Yellow
    }
}

# ── Phase list ──
$allPhases = @("prepare","build","verify","collect","deploy")
$skip = $true
if (-not $StartFrom) { $skip = $false }

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  ClawdbotCN Pipeline — One-Click Build & Deploy"
Write-Host "  Platform: $Platform | Timestamp: $TS"
Write-Host "  Logs: $LOG_DIR"
if ($SkipDeploy) { Write-Host "  Mode: SkipDeploy" -ForegroundColor Yellow }
if ($StartFrom)  { Write-Host "  StartFrom: $StartFrom" -ForegroundColor Yellow }
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$pipelineStart = Get-Date
$phaseResults = @{}

foreach ($phase in $allPhases) {
    # Skip phases before StartFrom
    if ($skip) {
        if ($phase -eq $StartFrom) { $skip = $false }
        else {
            Write-Host "[SKIP] Phase: $phase" -ForegroundColor DarkGray
            continue
        }
    }

    # Skip deploy if -SkipDeploy
    if ($SkipDeploy -and $phase -eq "deploy") {
        Write-Host "[SKIP] Phase: deploy (-SkipDeploy)" -ForegroundColor DarkGray
        continue
    }

    $phaseScript = Join-Path $SCRIPT_DIR "pipeline-$phase.ps1"
    if (-not (Test-Path $phaseScript)) {
        Write-Host "[ERROR] Script not found: $phaseScript" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "────────────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host "  [$phase] Starting..." -ForegroundColor Green
    Write-Host "────────────────────────────────────────────────" -ForegroundColor Cyan

    $phaseLog = Join-Path $LOG_DIR "$phase.log"
    $phaseStart = Get-Date

    # Update state: mark current phase
    Add-Content $STATE_FILE "`n`$PL_LAST_PHASE = `"$phase`""
    Add-Content $STATE_FILE "`$PL_LAST_STATUS = `"running`""

    # Execute phase script
    & powershell -NoProfile -ExecutionPolicy Bypass -File $phaseScript `
        -StateFile $STATE_FILE -LogDir $LOG_DIR -Platform $Platform `
        -ProjectRoot $PROJECT_ROOT 2>&1 | Tee-Object -FilePath $phaseLog

    $exitCode = $LASTEXITCODE
    $duration = [int](New-TimeSpan -Start $phaseStart -End (Get-Date)).TotalSeconds

    if ($exitCode -eq 0) {
        Write-Host "  [$phase] OK (${duration}s)" -ForegroundColor Green
        Add-Content $STATE_FILE "`$PL_LAST_STATUS = `"ok`""
        Add-Content $STATE_FILE "`$PL_$($phase.ToUpper())_DURATION = $duration"
        $phaseResults[$phase] = @{ status = "ok"; duration = $duration }
    } else {
        Write-Host ""
        Write-Host "  [$phase] FAILED (exit $exitCode, ${duration}s)" -ForegroundColor Red
        Write-Host "  Log: $phaseLog" -ForegroundColor Yellow
        Write-Host "  Last 20 lines:" -ForegroundColor Yellow
        Get-Content $phaseLog -Tail 20 | ForEach-Object { Write-Host "    $_" }
        Add-Content $STATE_FILE "`$PL_LAST_STATUS = `"fail`""
        $phaseResults[$phase] = @{ status = "fail"; duration = $duration }

        Write-Host ""
        Write-Host "Pipeline stopped at phase: $phase" -ForegroundColor Red
        Write-Host "To retry: powershell -File ci/pipeline.ps1 -Retry" -ForegroundColor Yellow
        exit 1
    }
}

# ── Summary ──
$totalDuration = [int](New-TimeSpan -Start $pipelineStart -End (Get-Date)).TotalMinutes

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Pipeline Complete!"
Write-Host "  Total time: ${totalDuration} minutes"
Write-Host "========================================================" -ForegroundColor Green

# Load final state for summary
. $STATE_FILE
if ($PL_VERSION) { Write-Host "  Version: $PL_VERSION" }
if ($PL_WIN_EXE) { Write-Host "  Windows: $PL_WIN_EXE" }
if ($PL_MAC_DMG) { Write-Host "  macOS:   $PL_MAC_DMG" }
Write-Host "  Logs:    $LOG_DIR"
Write-Host ""
