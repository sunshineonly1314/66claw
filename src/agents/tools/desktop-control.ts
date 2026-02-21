import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";
import type { AnyAgentTool } from "./common.js";
import { imageResultFromFile, jsonResult, readNumberParam, readStringParam } from "./common.js";

// ─── Schema ──────────────────────────────────────────────────────────

const DESKTOP_CONTROL_ACTIONS = [
  "screenshot",
  "click",
  "type",
  "key",
  "scroll",
  "list_windows",
  "focus",
  "app_search",
] as const;

const MOUSE_BUTTONS = ["left", "right", "middle"] as const;

const DesktopControlSchema = Type.Object({
  action: stringEnum(DESKTOP_CONTROL_ACTIONS, {
    description:
      "Action to perform: screenshot, click, type, key, scroll, list_windows, focus, app_search",
  }),
  x: Type.Optional(
    Type.Number({ description: "Screen X coordinate for click (physical pixels)." }),
  ),
  y: Type.Optional(
    Type.Number({ description: "Screen Y coordinate for click (physical pixels)." }),
  ),
  button: optionalStringEnum(MOUSE_BUTTONS, {
    description: "Mouse button for click (default: left).",
  }),
  double: Type.Optional(Type.Boolean({ description: "Double-click if true (default: false)." })),
  text: Type.Optional(
    Type.String({
      description:
        "Text to type at cursor position. Uses clipboard paste for full Unicode/CJK support.",
    }),
  ),
  keys: Type.Optional(
    Type.String({
      description:
        'Keyboard shortcut string, e.g. "ctrl+c", "alt+f4", "enter", "tab", "ctrl+shift+s".',
    }),
  ),
  window: Type.Optional(
    Type.String({
      description: "Window title substring for screenshot targeting or focus.",
    }),
  ),
  amount: Type.Optional(
    Type.Number({
      description:
        "Scroll amount in notches (positive=up, negative=down). Default: -3 (scroll down 3 notches).",
    }),
  ),
});

// ─── Key mapping ────────────────────────────────────────────────────

/** Maps human-readable key names to System.Windows.Forms.SendKeys format. */
const KEY_MAP: Record<string, string> = {
  enter: "{ENTER}",
  return: "{ENTER}",
  tab: "{TAB}",
  escape: "{ESC}",
  esc: "{ESC}",
  backspace: "{BACKSPACE}",
  bs: "{BACKSPACE}",
  delete: "{DELETE}",
  del: "{DELETE}",
  home: "{HOME}",
  end: "{END}",
  pageup: "{PGUP}",
  pagedown: "{PGDN}",
  up: "{UP}",
  down: "{DOWN}",
  left: "{LEFT}",
  right: "{RIGHT}",
  space: " ",
  f1: "{F1}",
  f2: "{F2}",
  f3: "{F3}",
  f4: "{F4}",
  f5: "{F5}",
  f6: "{F6}",
  f7: "{F7}",
  f8: "{F8}",
  f9: "{F9}",
  f10: "{F10}",
  f11: "{F11}",
  f12: "{F12}",
  insert: "{INSERT}",
  ins: "{INSERT}",
  printscreen: "{PRTSC}",
  capslock: "{CAPSLOCK}",
  numlock: "{NUMLOCK}",
  scrolllock: "{SCROLLLOCK}",
};

/** Convert "ctrl+shift+s" → "^+s" in SendKeys format. */
function toSendKeysCombo(combo: string): string {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((s) => s.trim());
  let modifiers = "";
  let key = "";

  for (const part of parts) {
    if (part === "ctrl" || part === "control") {
      modifiers += "^";
    } else if (part === "alt") {
      modifiers += "%";
    } else if (part === "shift") {
      modifiers += "+";
    } else if (part === "win" || part === "windows") {
      // Windows key handled via separate keybd_event path (see handleKey)
      modifiers += "{WIN}";
      continue;
    } else {
      key = KEY_MAP[part] ?? part;
    }
  }

  if (!key) return modifiers;

  // If the key is a special key (wrapped in {}), modifiers go before
  // If it's a plain character, wrap it: ^(c)  → just ^c
  return modifiers + key;
}

// ─── PowerShell helpers ─────────────────────────────────────────────

function resolvePsExe(): string {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const psExe = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return fs.existsSync(psExe) ? psExe : "powershell.exe";
}

function psEscape(s: string): string {
  return s.replace(/'/g, "''").replace(/`/g, "``").replace(/\$/g, "`$");
}

/**
 * Run a PowerShell script via a temp .ps1 file.
 * Using -File instead of -Command avoids parsing issues with complex scripts.
 */
function psFile(script: string, timeoutMs = 10000): string {
  const tmpFile = path.join(
    os.tmpdir(),
    `openclawcn-dc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.ps1`,
  );
  try {
    fs.writeFileSync(tmpFile, script, "utf-8");
    return execFileSync(
      resolvePsExe(),
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tmpFile],
      {
        encoding: "utf-8",
        timeout: timeoutMs,
        windowsHide: true,
      },
    ).trim();
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

// ─── Helper script (cached with version) ────────────────────────────

/** Bump this version whenever the helper script content changes.
 *  This ensures a stale cached .ps1 in %TEMP% is regenerated. */
const HELPER_SCRIPT_VERSION = 9;
const HELPER_SCRIPT_NAME = `openclawcn-desktop-control-helper-v${HELPER_SCRIPT_VERSION}.ps1`;

function getHelperScriptPath(): string {
  return path.join(os.tmpdir(), HELPER_SCRIPT_NAME);
}

function ensureHelperScript(): string {
  const helperPath = getHelperScriptPath();
  if (fs.existsSync(helperPath)) return helperPath;

  const script = `
param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    [int]$X = 0,
    [int]$Y = 0,
    [string]$Button = "left",
    [switch]$Double,
    [string]$Text = "",
    [string]$Keys = "",
    [string]$Window = "",
    [string]$OutputPath = "",
    [int]$Amount = -3,
    [string]$Method = "sendinput"
)

# UTF-8 output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# DPI awareness — ensures physical pixel coordinates match screenshot
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DpiHelper {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[DpiHelper]::SetProcessDPIAware() > $null

# Win32 input APIs
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int data, int extra);

    public const int MOUSEEVENTF_LEFTDOWN   = 0x0002;
    public const int MOUSEEVENTF_LEFTUP     = 0x0004;
    public const int MOUSEEVENTF_RIGHTDOWN  = 0x0008;
    public const int MOUSEEVENTF_RIGHTUP    = 0x0010;
    public const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const int MOUSEEVENTF_MIDDLEUP   = 0x0040;
    public const int MOUSEEVENTF_WHEEL      = 0x0800;

    // Window management
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_SHOWWINDOW = 0x0040;

    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    // SendInput for KEYEVENTF_UNICODE character input
    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    public const int INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_UNICODE  = 0x0004;
    public const uint KEYEVENTF_KEYUP    = 0x0002;

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public int type;
        public INPUTUNION u;
    }

    public static void SendUnicodeChar(char c) {
        var inputs = new INPUT[2];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].u.ki.wVk = 0;
        inputs[0].u.ki.wScan = (ushort)c;
        inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs[0].u.ki.time = 0;
        inputs[0].u.ki.dwExtraInfo = IntPtr.Zero;

        inputs[1].type = INPUT_KEYBOARD;
        inputs[1].u.ki.wVk = 0;
        inputs[1].u.ki.wScan = (ushort)c;
        inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        inputs[1].u.ki.time = 0;
        inputs[1].u.ki.dwExtraInfo = IntPtr.Zero;

        SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function DrawCoordinateGrid($graphics, $imgWidth, $imgHeight) {
    # Draw semi-transparent coordinate grid to help AI locate positions
    # Grid spacing: every 200px, with labels at intersections
    $gridSpacing = 200
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 0, 0), 1)
    $font = New-Object System.Drawing.Font("Arial", 10)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 255, 0, 0))
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 255, 255, 255))

    # Vertical lines + X labels along top
    for ($x = $gridSpacing; $x -lt $imgWidth; $x += $gridSpacing) {
        $graphics.DrawLine($pen, $x, 0, $x, $imgHeight)
        $label = "$x"
        $sz = $graphics.MeasureString($label, $font)
        $graphics.FillRectangle($bgBrush, $x + 2, 2, $sz.Width, $sz.Height)
        $graphics.DrawString($label, $font, $brush, ($x + 2), 2)
    }

    # Horizontal lines + Y labels along left
    for ($y = $gridSpacing; $y -lt $imgHeight; $y += $gridSpacing) {
        $graphics.DrawLine($pen, 0, $y, $imgWidth, $y)
        $label = "$y"
        $sz = $graphics.MeasureString($label, $font)
        $graphics.FillRectangle($bgBrush, 2, $y + 2, $sz.Width, $sz.Height)
        $graphics.DrawString($label, $font, $brush, 2, ($y + 2))
    }

    $pen.Dispose()
    $font.Dispose()
    $brush.Dispose()
    $bgBrush.Dispose()
}

switch ($Action) {
    "screenshot" {
        if ($Window) {
            # Find window and capture its bounds
            $targetHwnd = [IntPtr]::Zero
            $allWindows = New-Object System.Collections.ArrayList
            $callback = [WinInput+EnumWindowsProc]{
                param($hwnd, $lparam)
                if ([WinInput]::IsWindowVisible($hwnd)) {
                    $len = [WinInput]::GetWindowTextLength($hwnd)
                    if ($len -gt 0) {
                        $sb = New-Object System.Text.StringBuilder($len + 1)
                        [WinInput]::GetWindowText($hwnd, $sb, $sb.Capacity) > $null
                        $title = $sb.ToString()
                        if ($title -like "*$Window*") {
                            $script:targetHwnd = $hwnd
                            return $false  # stop enumeration
                        }
                    }
                }
                return $true
            }
            [WinInput]::EnumWindows($callback, [IntPtr]::Zero) > $null

            if ($targetHwnd -ne [IntPtr]::Zero) {
                $rect = New-Object WinInput+RECT
                [WinInput]::GetWindowRect($targetHwnd, [ref]$rect) > $null
                $w = $rect.Right - $rect.Left
                $h = $rect.Bottom - $rect.Top
                if ($w -gt 0 -and $h -gt 0) {
                    $bitmap = New-Object System.Drawing.Bitmap($w, $h)
                    $g = [System.Drawing.Graphics]::FromImage($bitmap)
                    $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
                    DrawCoordinateGrid $g $w $h
                    $g.Dispose()
                    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
                    $bitmap.Dispose()
                    Write-Output "ok|$w|$h|window|winpos:$($rect.Left),$($rect.Top)"
                } else {
                    Write-Output "error|Window has zero size"
                }
            } else {
                # Window not found, fall back to full virtual screen (all monitors)
                $vx = [System.Windows.Forms.SystemInformation]::VirtualScreen.X
                $vy = [System.Windows.Forms.SystemInformation]::VirtualScreen.Y
                $vw = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
                $vh = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height
                $bitmap = New-Object System.Drawing.Bitmap($vw, $vh)
                $g = [System.Drawing.Graphics]::FromImage($bitmap)
                $g.CopyFromScreen($vx, $vy, 0, 0, (New-Object System.Drawing.Size($vw, $vh)))
                DrawCoordinateGrid $g $vw $vh
                $g.Dispose()
                $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
                $bitmap.Dispose()
                Write-Output "ok|$vw|$vh|fullscreen|window_not_found|offset:$vx,$vy"
            }
        } else {
            # Capture full virtual screen (all monitors)
            $vx = [System.Windows.Forms.SystemInformation]::VirtualScreen.X
            $vy = [System.Windows.Forms.SystemInformation]::VirtualScreen.Y
            $vw = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
            $vh = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height
            $bitmap = New-Object System.Drawing.Bitmap($vw, $vh)
            $g = [System.Drawing.Graphics]::FromImage($bitmap)
            $g.CopyFromScreen($vx, $vy, 0, 0, (New-Object System.Drawing.Size($vw, $vh)))
            DrawCoordinateGrid $g $vw $vh
            $g.Dispose()
            $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $bitmap.Dispose()
            $monitors = [System.Windows.Forms.Screen]::AllScreens.Count
            Write-Output "ok|$vw|$vh|fullscreen|monitors:$monitors|offset:$vx,$vy"
        }
    }

    "click" {
        [WinInput]::SetCursorPos($X, $Y) > $null
        Start-Sleep -Milliseconds 50

        switch ($Button) {
            "right" {
                [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
                [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
                if ($Double) {
                    Start-Sleep -Milliseconds 50
                    [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
                    [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
                }
            }
            "middle" {
                [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
                [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
                if ($Double) {
                    Start-Sleep -Milliseconds 50
                    [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
                    [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
                }
            }
            default {
                [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                if ($Double) {
                    Start-Sleep -Milliseconds 50
                    [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                    [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                }
            }
        }
        Write-Output "ok|clicked|$X|$Y|$Button"
    }

    "scroll" {
        [WinInput]::SetCursorPos($X, $Y) > $null
        Start-Sleep -Milliseconds 50
        $wheelDelta = $Amount * 120
        [WinInput]::mouse_event([WinInput]::MOUSEEVENTF_WHEEL, 0, 0, $wheelDelta, 0)
        Start-Sleep -Milliseconds 200
        Write-Output "ok|scrolled|$X|$Y|$Amount"
    }

    "type" {
        if ($Method -eq "clipboard") {
            # Clipboard paste method: more reliable for CEF/Chromium-based apps
            # (e.g. WeChat, WeCom) that ignore SendInput KEYEVENTF_UNICODE.
            # CRITICAL: Clear() first to remove any image/rich data — otherwise
            # apps like WeChat will paste the image instead of text.
            [System.Windows.Forms.Clipboard]::Clear()
            Start-Sleep -Milliseconds 30
            [System.Windows.Forms.Clipboard]::SetText($Text)
            Start-Sleep -Milliseconds 50
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            Start-Sleep -Milliseconds 200
            Write-Output "ok|typed|$($Text.Length) chars|clipboard"
        } else {
            # SendInput with KEYEVENTF_UNICODE for each character.
            # Works for standard Windows edit controls.
            $chars = $Text.ToCharArray()
            foreach ($c in $chars) {
                [WinInput]::SendUnicodeChar($c)
                Start-Sleep -Milliseconds 15
            }
            Start-Sleep -Milliseconds 100
            Write-Output "ok|typed|$($Text.Length) chars|sendinput"
        }
    }

    "key" {
        [System.Windows.Forms.SendKeys]::SendWait($Keys)
        Start-Sleep -Milliseconds 100
        Write-Output "ok|key_sent|$Keys"
    }

    "list_windows" {
        $windows = New-Object System.Collections.ArrayList
        $callback = [WinInput+EnumWindowsProc]{
            param($hwnd, $lparam)
            if ([WinInput]::IsWindowVisible($hwnd)) {
                $len = [WinInput]::GetWindowTextLength($hwnd)
                if ($len -gt 0) {
                    $sb = New-Object System.Text.StringBuilder($len + 1)
                    [WinInput]::GetWindowText($hwnd, $sb, $sb.Capacity) > $null
                    $title = $sb.ToString()

                    $rect = New-Object WinInput+RECT
                    [WinInput]::GetWindowRect($hwnd, [ref]$rect) > $null

                    $procId = [uint32]0
                    [WinInput]::GetWindowThreadProcessId($hwnd, [ref]$procId) > $null
                    $procName = ""
                    try { $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName } catch {}

                    $w = $rect.Right - $rect.Left
                    $h = $rect.Bottom - $rect.Top
                    if ($w -gt 0 -and $h -gt 0) {
                        $script:windows.Add("$title|||$procName|||$($rect.Left)|||$($rect.Top)|||$w|||$h") > $null
                    }
                }
            }
            return $true
        }
        [WinInput]::EnumWindows($callback, [IntPtr]::Zero) > $null

        foreach ($win in $windows) {
            Write-Output $win
        }
    }

    "focus" {
        # First pass: try exact match
        $targetHwnd = [IntPtr]::Zero
        $targetTitle = ""
        $callback1 = [WinInput+EnumWindowsProc]{
            param($hwnd, $lparam)
            if ([WinInput]::IsWindowVisible($hwnd)) {
                $len = [WinInput]::GetWindowTextLength($hwnd)
                if ($len -gt 0) {
                    $sb = New-Object System.Text.StringBuilder($len + 1)
                    [WinInput]::GetWindowText($hwnd, $sb, $sb.Capacity) > $null
                    $title = $sb.ToString()
                    if ($title -eq $Window) {
                        $script:targetHwnd = $hwnd
                        $script:targetTitle = $title
                        return $false
                    }
                }
            }
            return $true
        }
        [WinInput]::EnumWindows($callback1, [IntPtr]::Zero) > $null

        # Second pass: fallback to substring match if no exact match
        if ($targetHwnd -eq [IntPtr]::Zero) {
            $callback2 = [WinInput+EnumWindowsProc]{
                param($hwnd, $lparam)
                if ([WinInput]::IsWindowVisible($hwnd)) {
                    $len = [WinInput]::GetWindowTextLength($hwnd)
                    if ($len -gt 0) {
                        $sb = New-Object System.Text.StringBuilder($len + 1)
                        [WinInput]::GetWindowText($hwnd, $sb, $sb.Capacity) > $null
                        $title = $sb.ToString()
                        if ($title -like "*$Window*") {
                            $script:targetHwnd = $hwnd
                            $script:targetTitle = $title
                            return $false
                        }
                    }
                }
                return $true
            }
            [WinInput]::EnumWindows($callback2, [IntPtr]::Zero) > $null
        }

        if ($targetHwnd -ne [IntPtr]::Zero) {
            # Restore if minimized
            if ([WinInput]::IsIconic($targetHwnd)) {
                [WinInput]::ShowWindow($targetHwnd, [WinInput]::SW_RESTORE) > $null
                Start-Sleep -Milliseconds 300
            }
            [WinInput]::ShowWindow($targetHwnd, [WinInput]::SW_SHOW) > $null
            Start-Sleep -Milliseconds 200

            # Temporarily set TOPMOST to force window above all others
            [WinInput]::SetWindowPos($targetHwnd, [WinInput]::HWND_TOPMOST, 0, 0, 0, 0,
                [WinInput]::SWP_NOMOVE -bor [WinInput]::SWP_NOSIZE -bor [WinInput]::SWP_SHOWWINDOW) > $null
            Start-Sleep -Milliseconds 200

            # Attach to foreground thread for SetForegroundWindow to succeed
            $fgHwnd = [WinInput]::GetForegroundWindow()
            $fgPid = [uint32]0
            $fgTid = [WinInput]::GetWindowThreadProcessId($fgHwnd, [ref]$fgPid)
            $tgtPid = [uint32]0
            $tgtTid = [WinInput]::GetWindowThreadProcessId($targetHwnd, [ref]$tgtPid)

            $attached = $false
            if ($fgTid -ne $tgtTid) {
                $attached = [WinInput]::AttachThreadInput($fgTid, $tgtTid, $true)
            }

            [WinInput]::BringWindowToTop($targetHwnd) > $null
            [WinInput]::SetForegroundWindow($targetHwnd) > $null

            if ($attached) {
                [WinInput]::AttachThreadInput($fgTid, $tgtTid, $false) > $null
            }

            Start-Sleep -Milliseconds 300

            # Cancel TOPMOST
            [WinInput]::SetWindowPos($targetHwnd, [WinInput]::HWND_NOTOPMOST, 0, 0, 0, 0,
                [WinInput]::SWP_NOMOVE -bor [WinInput]::SWP_NOSIZE -bor [WinInput]::SWP_SHOWWINDOW) > $null

            Write-Output "ok|focused|$targetTitle"
        } else {
            Write-Output "error|Window not found matching: $Window"
        }
    }
}
`;

  fs.writeFileSync(helperPath, script, "utf-8");
  return helperPath;
}

/** Run the cached helper script with parameters. */
export function runHelper(args: string[], timeoutMs = 10000): string {
  const helperPath = ensureHelperScript();
  return execFileSync(
    resolvePsExe(),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helperPath, ...args],
    {
      encoding: "utf-8",
      timeout: timeoutMs,
      windowsHide: true,
    },
  ).trim();
}

// ─── Action handlers ────────────────────────────────────────────────

export async function handleScreenshot(
  params: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const window = readStringParam(params, "window");
  const tmpPath = path.join(os.tmpdir(), `openclawcn-screenshot-${Date.now()}.png`);

  try {
    const args = ["-Action", "screenshot", "-OutputPath", tmpPath];
    if (window) {
      args.push("-Window", window);
    }

    const out = runHelper(args, 15000);
    const parts = out.split("|");

    if (parts[0] !== "ok") {
      return {
        content: [{ type: "text", text: `截图失败: ${parts.slice(1).join(" ")}` }],
        details: { status: "error", action: "screenshot" },
      };
    }

    const width = parseInt(parts[1] || "0", 10);
    const height = parseInt(parts[2] || "0", 10);
    const mode = parts[3] || "fullscreen";
    const note =
      parts.find(
        (p) =>
          p &&
          !p.startsWith("monitors:") &&
          !p.startsWith("offset:") &&
          !p.startsWith("winpos:") &&
          p !== "ok" &&
          p !== String(width) &&
          p !== String(height) &&
          p !== mode,
      ) || "";

    const monitorInfo = parts.find((p) => p?.startsWith("monitors:")) ?? "";
    const offsetInfo = parts.find((p) => p?.startsWith("offset:")) ?? "";
    const winposInfo = parts.find((p) => p?.startsWith("winpos:")) ?? "";
    const monitorCount = monitorInfo ? parseInt(monitorInfo.split(":")[1] || "1", 10) : 1;

    // Parse window position for window-mode screenshots
    let winLeft = 0;
    let winTop = 0;
    if (winposInfo) {
      const [l, t] = winposInfo.split(":")[1]?.split(",") ?? [];
      winLeft = parseInt(l || "0", 10);
      winTop = parseInt(t || "0", 10);
    }

    // Calculate scale factor: image may be resized by sanitizeToolResultImages (max 2000px)
    // The model sees the resized image but needs to output physical screen coordinates
    const MAX_SANITIZE_DIM = 2000;
    const maxDim = Math.max(width, height);
    const willBeResized = maxDim > MAX_SANITIZE_DIM;
    const scaleFactor = willBeResized ? maxDim / MAX_SANITIZE_DIM : 1;
    const displayWidth = willBeResized ? Math.round(width / scaleFactor) : width;
    const displayHeight = willBeResized ? Math.round(height / scaleFactor) : height;

    // Build coordinate instruction for the model
    const extraTextLines: string[] = [];

    if (mode === "window" && winposInfo) {
      extraTextLines.push(
        `窗口截图 (原始 ${width}x${height}, 窗口位置: 左上角在屏幕 (${winLeft}, ${winTop}))`,
      );
      if (willBeResized) {
        extraTextLines.push(
          `⚠ 图片已缩放至 ${displayWidth}x${displayHeight} 显示。`,
          `坐标换算公式: screen_x = ${winLeft} + image_x * ${scaleFactor.toFixed(2)}, screen_y = ${winTop} + image_y * ${scaleFactor.toFixed(2)}`,
          `例：图片中 (100, 50) → click(${winLeft + Math.round(100 * scaleFactor)}, ${winTop + Math.round(50 * scaleFactor)})`,
        );
      } else {
        extraTextLines.push(
          `坐标换算: screen_x = ${winLeft} + image_x, screen_y = ${winTop} + image_y`,
          `例：图片中 (100, 50) → click(${winLeft + 100}, ${winTop + 50})`,
        );
      }
    } else {
      // Fullscreen mode
      extraTextLines.push(
        `屏幕截图 (${width}x${height}${monitorCount > 1 ? `, ${monitorCount}个显示器` : ""})`,
      );

      if (note === "window_not_found") {
        extraTextLines.push(`注意: 未找到窗口 '${window}'，已截取全屏`);
      }

      if (willBeResized) {
        const screenOffsetX = offsetInfo
          ? parseInt((offsetInfo.split(":")[1] ?? "0").split(",")[0] || "0", 10)
          : 0;
        const screenOffsetY = offsetInfo
          ? parseInt((offsetInfo.split(":")[1] ?? "0").split(",")[1] || "0", 10)
          : 0;
        extraTextLines.push(
          `⚠ 图片已缩放至 ${displayWidth}x${displayHeight} 显示。`,
          `坐标换算公式: screen_x = ${screenOffsetX} + image_x * ${scaleFactor.toFixed(2)}, screen_y = ${screenOffsetY} + image_y * ${scaleFactor.toFixed(2)}`,
        );
      } else if (offsetInfo && offsetInfo !== "offset:0,0") {
        extraTextLines.push(`多显示器偏移: ${offsetInfo.split(":")[1]} — click 坐标需加上此偏移`);
      } else {
        extraTextLines.push("提示: 图片中的坐标即为 click 操作的物理像素坐标");
      }
    }

    const extraText = extraTextLines.filter(Boolean).join("\n");

    return await imageResultFromFile({
      label: "desktop_control:screenshot",
      path: tmpPath,
      extraText,
      details: {
        status: "ok",
        action: "screenshot",
        width,
        height,
        mode,
        monitors: monitorCount,
        ...(mode === "window" ? { winLeft, winTop } : {}),
        ...(willBeResized
          ? { scaleFactor: +scaleFactor.toFixed(2), displayWidth, displayHeight }
          : {}),
      },
    });
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

function handleClick(params: Record<string, unknown>): AgentToolResult<unknown> {
  const x = readNumberParam(params, "x", { required: true, integer: true });
  const y = readNumberParam(params, "y", { required: true, integer: true });
  const button = readStringParam(params, "button") ?? "left";
  const isDouble = typeof params.double === "boolean" ? params.double : false;

  const args = ["-Action", "click", "-X", String(x), "-Y", String(y), "-Button", button];
  if (isDouble) args.push("-Double");

  const out = runHelper(args, 5000);
  const parts = out.split("|");

  if (parts[0] !== "ok") {
    return {
      content: [{ type: "text", text: `点击失败: ${out}` }],
      details: { status: "error", action: "click" },
    };
  }

  const desc = isDouble ? "双击" : "单击";
  const btnDesc = button === "left" ? "左键" : button === "right" ? "右键" : "中键";
  return {
    content: [{ type: "text", text: `已${desc}${btnDesc} (${x}, ${y})` }],
    details: { status: "ok", action: "click", x, y, button, double: isDouble },
  };
}

function handleScroll(params: Record<string, unknown>): AgentToolResult<unknown> {
  const x = readNumberParam(params, "x", { required: true, integer: true });
  const y = readNumberParam(params, "y", { required: true, integer: true });
  const amount = readNumberParam(params, "amount", { integer: true }) ?? -3;

  const args = ["-Action", "scroll", "-X", String(x), "-Y", String(y), "-Amount", String(amount)];
  const out = runHelper(args, 5000);
  const parts = out.split("|");

  if (parts[0] !== "ok") {
    return {
      content: [{ type: "text", text: `滚动失败: ${out}` }],
      details: { status: "error", action: "scroll" },
    };
  }

  const direction = amount > 0 ? "上" : "下";
  return {
    content: [
      { type: "text", text: `已在 (${x}, ${y}) 向${direction}滚动 ${Math.abs(amount)} 格` },
    ],
    details: { status: "ok", action: "scroll", x, y, amount },
  };
}

function handleType(params: Record<string, unknown>): AgentToolResult<unknown> {
  const text = readStringParam(params, "text", { required: true });

  const args = ["-Action", "type", "-Text", text];
  const out = runHelper(args, 5000);
  const parts = out.split("|");

  if (parts[0] !== "ok") {
    return {
      content: [{ type: "text", text: `输入失败: ${out}` }],
      details: { status: "error", action: "type" },
    };
  }

  return {
    content: [{ type: "text", text: `已输入文本 (${text.length} 字符)` }],
    details: { status: "ok", action: "type", length: text.length },
  };
}

function handleKey(params: Record<string, unknown>): AgentToolResult<unknown> {
  const keys = readStringParam(params, "keys", { required: true });
  const sendKeysFormat = toSendKeysCombo(keys);

  // Win key combos need keybd_event because SendKeys doesn't support the Windows key
  if (sendKeysFormat.includes("{WIN}")) {
    const combo = keys.toLowerCase();
    const baseParts = combo.split("+").filter((p) => p.trim() !== "win" && p.trim() !== "windows");
    const baseKey = baseParts[baseParts.length - 1]?.trim() || "";
    // Map the base key to a Windows Virtual Key (VK) code.
    // For single letters/digits, VK code = ASCII code of uppercase letter.
    // Named keys need explicit mapping.
    const VK_NAMES: Record<string, string> = {
      tab: "0x09",
      enter: "0x0D",
      return: "0x0D",
      escape: "0x1B",
      esc: "0x1B",
      space: "0x20",
      backspace: "0x08",
      delete: "0x2E",
      del: "0x2E",
      insert: "0x2D",
      home: "0x24",
      end: "0x23",
      pageup: "0x21",
      pagedown: "0x22",
      up: "0x26",
      down: "0x28",
      left: "0x25",
      right: "0x27",
      f1: "0x70",
      f2: "0x71",
      f3: "0x72",
      f4: "0x73",
      f5: "0x74",
      f6: "0x75",
      f7: "0x76",
      f8: "0x77",
      f9: "0x78",
      f10: "0x79",
      f11: "0x7A",
      f12: "0x7B",
    };
    const vkCode =
      VK_NAMES[baseKey] ??
      (baseKey.length === 1
        ? `0x${baseKey.toUpperCase().charCodeAt(0).toString(16).padStart(2, "0")}`
        : null);

    if (baseKey && !vkCode) {
      return {
        content: [
          { type: "text", text: `不支持的 Win 键组合: ${keys} (无法映射 '${baseKey}' 到虚拟键码)` },
        ],
        details: { status: "error", action: "key", error: `unknown vk for '${baseKey}'` },
      };
    }

    // Build as multi-line script — PowerShell here-string "@ MUST be at
    // the start of its own line, so we join with \n instead of "; ".
    const script = [
      'Add-Type @"',
      "using System;",
      "using System.Runtime.InteropServices;",
      "public class WinKeyHelper {",
      '    [DllImport(\"user32.dll\")] public static extern void keybd_event(byte vk, byte scan, int flags, int extra);',
      "    public const int KEYEVENTF_KEYUP = 0x0002;",
      "    public const byte VK_LWIN = 0x5B;",
      "}",
      '"@',
      "[WinKeyHelper]::keybd_event([WinKeyHelper]::VK_LWIN, 0, 0, 0)",
      vkCode ? `[WinKeyHelper]::keybd_event(${vkCode}, 0, 0, 0)` : "",
      "Start-Sleep -Milliseconds 100",
      vkCode ? `[WinKeyHelper]::keybd_event(${vkCode}, 0, [WinKeyHelper]::KEYEVENTF_KEYUP, 0)` : "",
      "[WinKeyHelper]::keybd_event([WinKeyHelper]::VK_LWIN, 0, [WinKeyHelper]::KEYEVENTF_KEYUP, 0)",
      `Write-Output 'ok|key_sent|${psEscape(keys)}'`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const out = psFile(script, 5000);
      const parts = out.split("|");
      if (parts[0] !== "ok") {
        return {
          content: [{ type: "text", text: `快捷键发送失败: ${out}` }],
          details: { status: "error", action: "key" },
        };
      }
      return {
        content: [{ type: "text", text: `已发送快捷键: ${keys}` }],
        details: { status: "ok", action: "key", keys, method: "keybd_event" },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `快捷键发送失败 (Win key): ${msg}` }],
        details: { status: "error", action: "key", error: msg },
      };
    }
  }

  const args = ["-Action", "key", "-Keys", sendKeysFormat];
  const out = runHelper(args, 5000);
  const parts = out.split("|");

  if (parts[0] !== "ok") {
    return {
      content: [{ type: "text", text: `快捷键发送失败: ${out}` }],
      details: { status: "error", action: "key" },
    };
  }

  return {
    content: [{ type: "text", text: `已发送快捷键: ${keys}` }],
    details: { status: "ok", action: "key", keys, sendKeysFormat },
  };
}

function handleListWindows(): AgentToolResult<unknown> {
  const out = runHelper(["-Action", "list_windows"], 8000);
  if (!out) {
    return jsonResult({ windows: [], status: "ok" });
  }

  const windows = out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|||");
      return {
        title: parts[0] || "",
        process: parts[1] || "",
        x: parseInt(parts[2] || "0", 10),
        y: parseInt(parts[3] || "0", 10),
        width: parseInt(parts[4] || "0", 10),
        height: parseInt(parts[5] || "0", 10),
      };
    });

  return jsonResult({ windows, count: windows.length, status: "ok" });
}

function handleFocus(params: Record<string, unknown>): AgentToolResult<unknown> {
  const window = readStringParam(params, "window", { required: true });

  const args = ["-Action", "focus", "-Window", window];
  const out = runHelper(args, 5000);
  const parts = out.split("|");

  if (parts[0] === "error") {
    return {
      content: [{ type: "text", text: `聚焦失败: 未找到匹配 '${window}' 的窗口` }],
      details: { status: "not_found", action: "focus", window },
    };
  }

  const focusedTitle = parts[2] || window;
  return {
    content: [{ type: "text", text: `已聚焦窗口: ${focusedTitle}` }],
    details: { status: "ok", action: "focus", window: focusedTitle },
  };
}

// ─── App search box profiles ────────────────────────────────────────

/**
 * Known app search box positions (relative to window rect).
 * processName → { xRatio, yOffset } where:
 *   searchBox_screen_x = windowRect.Left + windowWidth * xRatio
 *   searchBox_screen_y = windowRect.Top + yOffset
 */
const APP_SEARCH_PROFILES: Record<
  string,
  { xRatio: number; yOffset: number; displayName: string }
> = {
  cloudmusic: { xRatio: 0.39, yOffset: 45, displayName: "网易云音乐" },
};

/**
 * app_search action: Find an app window by process name, focus it,
 * click the search box at a known position, type the query, and press Enter.
 * This avoids the model needing to guess coordinates from screenshots.
 */
function handleAppSearch(params: Record<string, unknown>): AgentToolResult<unknown> {
  const text = readStringParam(params, "text", { required: true });
  const window = readStringParam(params, "window") ?? "";

  // Step 1: Find matching process → window rect
  const findScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class AppSearch {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr h, StringBuilder s, int c);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int f, int dx, int dy, int d, int e);
    [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] p, int s);
    public const int MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const int MOUSEEVENTF_LEFTUP = 0x0004;
    public const int INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_UNICODE = 0x0004;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] public struct INPUT { public int type; public INPUTUNION u; }
    public delegate bool EP(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EP p, IntPtr l);
    public static void SendUnicodeChar(char c) {
        var inputs = new INPUT[2];
        inputs[0].type = INPUT_KEYBOARD; inputs[0].u.ki.wScan = (ushort)c; inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs[1].type = INPUT_KEYBOARD; inputs[1].u.ki.wScan = (ushort)c; inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@
Add-Type -AssemblyName System.Windows.Forms
[AppSearch]::SetProcessDPIAware() > $null

$processFilter = '${psEscape(window)}'
$searchText = '${psEscape(text)}'

# Find window by process name
$targetHwnd = [IntPtr]::Zero
$targetTitle = ""
$targetRect = $null

$callback = [AppSearch+EP]{
    param($hwnd, $lparam)
    if ([AppSearch]::IsWindowVisible($hwnd)) {
        $len = [AppSearch]::GetWindowTextLength($hwnd)
        if ($len -gt 0) {
            $winPid = [uint32]0
            [AppSearch]::GetWindowThreadProcessId($hwnd, [ref]$winPid) > $null
            $procName = ""
            try { $procName = (Get-Process -Id $winPid -ErrorAction SilentlyContinue).ProcessName } catch {}
            if ($procName -and $procName -match $processFilter) {
                $sb = New-Object System.Text.StringBuilder($len + 1)
                [AppSearch]::GetWindowText($hwnd, $sb, $sb.Capacity) > $null
                $r = New-Object AppSearch+RECT
                [AppSearch]::GetWindowRect($hwnd, [ref]$r) > $null
                $w = $r.Right - $r.Left
                $h = $r.Bottom - $r.Top
                if ($w -gt 200 -and $h -gt 200) {
                    $script:targetHwnd = $hwnd
                    $script:targetTitle = $sb.ToString()
                    $script:targetRect = $r
                    return $false
                }
            }
        }
    }
    return $true
}
[AppSearch]::EnumWindows($callback, [IntPtr]::Zero) > $null

if ($targetHwnd -eq [IntPtr]::Zero) {
    Write-Output "error|process_not_found|$processFilter"
    exit
}

$wLeft = $targetRect.Left
$wTop = $targetRect.Top
$wWidth = $targetRect.Right - $targetRect.Left

# Restore if minimized
if ([AppSearch]::IsIconic($targetHwnd)) {
    [AppSearch]::ShowWindow($targetHwnd, 9) > $null
    Start-Sleep -Milliseconds 300
}
[AppSearch]::ShowWindow($targetHwnd, 5) > $null
[AppSearch]::SetForegroundWindow($targetHwnd) > $null
Start-Sleep -Milliseconds 500

Write-Output "ok|found|$targetTitle|x=$wLeft|y=$wTop|w=$wWidth"
`;

  try {
    const findResult = psFile(findScript, 10000);
    const findParts = findResult.split("|");

    if (findParts[0] === "error") {
      return {
        content: [
          {
            type: "text",
            text: `未找到进程 '${window}' 的窗口。请确认应用已打开。`,
          },
        ],
        details: { status: "error", action: "app_search", error: "process_not_found" },
      };
    }

    const winTitle = findParts[2] || "";
    const winLeft = parseInt((findParts[3] || "x=0").split("=")[1] || "0", 10);
    const winTop = parseInt((findParts[4] || "y=0").split("=")[1] || "0", 10);
    const winWidth = parseInt((findParts[5] || "w=0").split("=")[1] || "0", 10);

    // Step 2: Determine search box position from profile
    const profile = APP_SEARCH_PROFILES[window.toLowerCase()];
    if (!profile) {
      return {
        content: [
          {
            type: "text",
            text: `未配置 '${window}' 的搜索框位置。已知应用: ${Object.entries(APP_SEARCH_PROFILES)
              .map(([k, v]) => `${k}(${v.displayName})`)
              .join(", ")}`,
          },
        ],
        details: { status: "error", action: "app_search", error: "no_profile" },
      };
    }

    const searchX = Math.round(winLeft + winWidth * profile.xRatio);
    const searchY = winTop + profile.yOffset;

    // Step 3: Click search box → Ctrl+A → type → Enter
    const searchScript = `
[AppSearch2_Padding]::SetProcessDPIAware() > $null
`;
    // Use the helper for click, then key, then type, then key
    // Click the search box
    runHelper(["-Action", "click", "-X", String(searchX), "-Y", String(searchY)], 5000);

    // Wait a bit for focus
    const sleepScript = "Start-Sleep -Milliseconds 300";
    psFile(sleepScript, 2000);

    // Select all existing text
    runHelper(["-Action", "key", "-Keys", "^a"], 3000);
    psFile("Start-Sleep -Milliseconds 100", 2000);

    // Type the search text
    runHelper(["-Action", "type", "-Text", text], 5000);
    psFile("Start-Sleep -Milliseconds 200", 2000);

    // Press Enter
    runHelper(["-Action", "key", "-Keys", "{ENTER}"], 3000);

    return {
      content: [
        {
          type: "text",
          text: `已在 ${profile.displayName} 中搜索: "${text}"\n窗口: ${winTitle} (${winLeft},${winTop} ${winWidth}px宽)\n搜索框坐标: (${searchX}, ${searchY})`,
        },
      ],
      details: {
        status: "ok",
        action: "app_search",
        app: window,
        query: text,
        windowTitle: winTitle,
        searchBoxX: searchX,
        searchBoxY: searchY,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `应用内搜索失败: ${msg}` }],
      details: { status: "error", action: "app_search", error: msg },
    };
  }
}

// ─── Tool factory ───────────────────────────────────────────────────

export function createDesktopControlTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "desktop_control",
    label: "Desktop Control",
    description: [
      "Control Windows desktop GUI via screenshot, click, type, key, scroll, list/focus windows, app_search.",
      "Use this to interact with apps that cannot be controlled via CLI.",
      "Workflow: screenshot → analyze UI → click/type/key/scroll → screenshot to verify.",
      "",
      "Actions: screenshot, click, type, key, scroll, list_windows, focus, app_search",
      "app_search: Search within a known app by process name. Automatically finds the window, clicks the search box, types the query, and presses Enter.",
      "  Supported apps: cloudmusic (网易云音乐)",
      "Examples:",
      '  desktop_control({action:"screenshot"})',
      '  desktop_control({action:"click", x:400, y:300})',
      '  desktop_control({action:"type", text:"Hello 你好"})',
      '  desktop_control({action:"key", keys:"ctrl+c"})',
      '  desktop_control({action:"app_search", window:"cloudmusic", text:"Starlight"})',
      '  desktop_control({action:"list_windows"})',
      '  desktop_control({action:"focus", window:"ToDesk"})',
    ].join("\n"),
    parameters: DesktopControlSchema,
    execute: async (_toolCallId, args): Promise<AgentToolResult<unknown>> => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      try {
        switch (action) {
          case "screenshot":
            return await handleScreenshot(params);
          case "click":
            return handleClick(params);
          case "type":
            return handleType(params);
          case "key":
            return handleKey(params);
          case "scroll":
            return handleScroll(params);
          case "list_windows":
            return handleListWindows();
          case "focus":
            return handleFocus(params);
          case "app_search":
            return handleAppSearch(params);
          default:
            return {
              content: [{ type: "text", text: `未知操作: ${action}` }],
              details: { status: "error", action, error: "unknown action" },
            };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `桌面控制失败 (${action}): ${msg}` }],
          details: { status: "error", action, error: msg },
        };
      }
    },
  };
}
