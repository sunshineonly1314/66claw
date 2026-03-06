<#
.SYNOPSIS
  Build ClawdbotCN-Uninstaller.exe

.DESCRIPTION
  Uses .NET Framework csc.exe (always available on Windows) to compile
  a tiny C# launcher that embeds full-uninstall.ps1 as a resource.
  User double-clicks the exe -> shows menu -> runs PowerShell cleanup.

  Output: build/ClawdbotCN-Uninstaller.exe
#>

$ErrorActionPreference = "Stop"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path "$scriptDir\..\..").Path
$buildDir   = "$projectRoot\build\uninstaller"
$outputExe  = "$projectRoot\build\ClawdbotCN-Uninstaller.exe"

Write-Host "Building ClawdbotCN Uninstaller..." -ForegroundColor Cyan

# clean
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory $buildDir -Force | Out-Null

# ── 1. Copy ps1 ──────────────────────────────────────────────────────────

$ps1Src = "$scriptDir\full-uninstall.ps1"
$ps1Dst = "$buildDir\full-uninstall.ps1"
Copy-Item $ps1Src $ps1Dst
Write-Host "  Copied full-uninstall.ps1" -ForegroundColor Green

# ── 2. Write C# source ───────────────────────────────────────────────────

$csPath = "$buildDir\Launcher.cs"

# Read ps1 content as base64 so we can embed it safely in C# without escaping issues
$ps1Bytes = [System.IO.File]::ReadAllBytes($ps1Src)
$ps1Base64 = [Convert]::ToBase64String($ps1Bytes)

$csSource = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

class Program
{
    // full-uninstall.ps1 content encoded as base64
    static string ps1Base64 = @"$ps1Base64";

    static void Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        try { Console.Title = "ClawdbotCN Uninstaller"; } catch {}

        Console.WriteLine();
        Console.WriteLine("  =======================================================");
        Console.WriteLine("       ClawdbotCN Uninstaller");
        Console.WriteLine("  =======================================================");
        Console.WriteLine();
        Console.WriteLine("  [1] Full Uninstall   - Delete ALL data (clean slate)");
        Console.WriteLine("  [2] Normal Uninstall - Keep user data (config/sessions)");
        Console.WriteLine("  [3] Preview Mode     - Show what would be deleted");
        Console.WriteLine("  [4] Cancel");
        Console.WriteLine();
        Console.Write("  Choose (1/2/3/4): ");

        var key = Console.ReadKey();
        Console.WriteLine();

        if (key.KeyChar == '4') { Console.WriteLine("  Cancelled."); WaitExit(); return; }
        if (key.KeyChar != '1' && key.KeyChar != '2' && key.KeyChar != '3')
        { Console.WriteLine("  Invalid choice."); WaitExit(); return; }

        // Extract ps1 to temp
        string tempPs1 = Path.Combine(Path.GetTempPath(),
            "clawdbot-uninstall-" + Guid.NewGuid().ToString("N").Substring(0,8) + ".ps1");

        try
        {
            byte[] ps1Bytes = Convert.FromBase64String(ps1Base64);
            File.WriteAllBytes(tempPs1, ps1Bytes);
        }
        catch (Exception ex)
        {
            Console.WriteLine("  Error extracting script: " + ex.Message);
            WaitExit();
            return;
        }

        // Build args
        string psArgs;
        switch (key.KeyChar)
        {
            case '1': psArgs = ""; break;
            case '2': psArgs = "-KeepData"; break;
            case '3': psArgs = "-DryRun -Force"; break;
            default:  psArgs = ""; break;
        }

        Console.WriteLine();

        // Run PowerShell
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + tempPs1 + "\" " + psArgs,
            UseShellExecute = false,
            CreateNoWindow = false
        };

        try
        {
            var proc = Process.Start(psi);
            proc.WaitForExit();
        }
        catch (Exception ex)
        {
            Console.WriteLine("  Error: " + ex.Message);
        }

        // Cleanup
        try { File.Delete(tempPs1); } catch {}

        WaitExit();
    }

    static void WaitExit()
    {
        Console.WriteLine();
        Console.WriteLine("  Press any key to close...");
        try { Console.ReadKey(true); } catch {}
    }
}
"@

[System.IO.File]::WriteAllText($csPath, $csSource, [System.Text.Encoding]::UTF8)
Write-Host "  Created C# launcher source" -ForegroundColor Green

# ── 3. Find csc.exe ──────────────────────────────────────────────────────

$cscCandidates = @(
    "$env:SystemRoot\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "$env:SystemRoot\Microsoft.NET\Framework\v4.0.30319\csc.exe",
    "$env:SystemRoot\Microsoft.NET\Framework64\v3.5\csc.exe",
    "$env:SystemRoot\Microsoft.NET\Framework\v3.5\csc.exe"
)

$cscPath = $null
foreach ($c in $cscCandidates) {
    if (Test-Path $c) { $cscPath = $c; break }
}

if (-not $cscPath) {
    Write-Host "  ERROR: csc.exe not found. .NET Framework required." -ForegroundColor Red
    exit 1
}

Write-Host "  Using: $cscPath" -ForegroundColor DarkGray

# ── 4. Compile ────────────────────────────────────────────────────────────

Write-Host "  Compiling..." -ForegroundColor Yellow

& $cscPath /nologo /target:exe /out:$outputExe /utf8output $csPath 2>&1 | ForEach-Object {
    if ($_ -match "error") { Write-Host "    $_" -ForegroundColor Red }
}

if (Test-Path $outputExe) {
    $size = [math]::Round((Get-Item $outputExe).Length / 1024)
    Write-Host ""
    Write-Host "  Done!" -ForegroundColor Green
    Write-Host "    $outputExe  (${size} KB)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Users can double-click this exe to run the uninstaller." -ForegroundColor Yellow
} else {
    Write-Host "  Compilation failed." -ForegroundColor Red
    Write-Host "  Fallback: use build\ClawdbotCN-Uninstaller.bat instead" -ForegroundColor Yellow
    Copy-Item "$scriptDir\ClawdbotCN-全量卸载.bat" "$projectRoot\build\ClawdbotCN-Uninstaller.bat" -ErrorAction SilentlyContinue
}

# cleanup temp
Remove-Item $csPath -Force -ErrorAction SilentlyContinue
