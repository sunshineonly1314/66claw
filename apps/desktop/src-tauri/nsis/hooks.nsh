; ClawdbotCN NSIS Installer Hooks
; Custom pre/post install logic for Tauri 2.x NSIS bundler
; Ref: https://v2.tauri.app/distribute/windows-installer/

!include "LogicLib.nsh"

; ============================================================================
; PREINSTALL: kill running processes, old version detection
; ============================================================================
!macro NSIS_HOOK_PREINSTALL

  ; --- 1. Kill ALL ClawdbotCN-related processes before file operations ---
  ; This prevents "file in use" errors for node.exe, mcp-index.db, etc.
  ; Must run BEFORE Tauri's own CheckIfAppIsRunning (which only kills the main .exe).
  ;
  ; Strategy:
  ;   a) Kill ClawdbotCN.exe (Tauri productName) and clawdbot-desktop.exe (Cargo binary name)
  ;   b) Kill any node.exe whose executable path is inside the install directory
  ;   c) Kill gateway process on port 18789 (may be started standalone)
  ;   d) Release file handles: close any process holding mcp-index.db or other data files
  ;   e) Wait + verify file handles are released, retry if needed

  ; a) Kill ClawdbotCN main process — try BOTH possible process names
  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-Process -Name ClawdbotCN,clawdbot-desktop -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1

  ; b) Kill node.exe processes running from ClawdbotCN install directory
  ;    This catches the bundled node.exe that serves as the backend runtime.
  ;    Only kills node.exe whose path contains "ClawdbotCN" — won't affect other Node apps.
  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-Process -Name node -EA 0 | ? { $$_.Path -match ''ClawdbotCN'' } | Stop-Process -Force -EA 0"'
  Pop $0
  Pop $1

  ; c) Kill any process listening on gateway port 18789 (may be a standalone gateway)
  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 18789 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }"'
  Pop $0
  Pop $1

  ; Pass $INSTDIR via env var so paths containing single quotes don't break PowerShell parsing
  System::Call 'kernel32::SetEnvironmentVariableW(w "_CLAWDBOT_INSTDIR", w "$INSTDIR") i'

  ; d) Also kill any process holding files in the install directory
  ;    Handles edge case: mcp-index.db locked by orphaned node.exe or SQLite WAL
  nsExec::ExecToStack 'powershell -NoProfile -Command "\
    $$installDir = [System.IO.Path]::Combine($$env:LOCALAPPDATA, ''ClawdbotCN'');\
    if (-not (Test-Path $$installDir)) { $$installDir = $$env:_CLAWDBOT_INSTDIR };\
    Get-Process node -EA 0 | Where-Object { $$_.Path -and $$_.Path.StartsWith($$installDir) } | Stop-Process -Force -EA 0;\
    Get-Process clawdbot-desktop -EA 0 | Where-Object { $$_.Path -and $$_.Path.StartsWith($$installDir) } | Stop-Process -Force -EA 0;\
  "'
  Pop $0
  Pop $1

  ; e) Wait for OS to release file handles, then verify
  ;    SQLite WAL/SHM files need time to flush after process kill
  Sleep 2000

  ; Verify critical files are not locked — retry kill if still busy
  nsExec::ExecToStack 'powershell -NoProfile -Command "\
    $$instDir = $$env:_CLAWDBOT_INSTDIR;\
    $$dbPath = [System.IO.Path]::Combine($$instDir, ''resources'', ''data'', ''mcp-index.db'');\
    if (Test-Path $$dbPath) {\
      try {\
        $$s = [System.IO.File]::Open($$dbPath, ''Open'', ''ReadWrite'', ''None'');\
        $$s.Close();\
      } catch {\
        Write-Host ''mcp-index.db still locked, force killing all node processes in install dir...'';\
        Get-Process node -EA 0 | Where-Object { $$_.Path -match ''ClawdbotCN'' } | Stop-Process -Force -EA 0;\
        Start-Sleep -Seconds 2;\
      }\
    }\
  "'
  Pop $0
  Pop $1

  ; --- 2. Detect old versions with different product names ---
  ; In silent mode (/S), auto-uninstall old versions without prompting.
  ; In interactive mode, ask the user first.

  ; Check for old "OpenClawCN" (Inno Setup) installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenClawCN_is1" "UninstallString"
  ${If} $0 != ""
    IfSilent auto_uninstall_openclaw 0
    MessageBox MB_YESNO|MB_ICONINFORMATION "检测到旧版本 OpenClawCN，建议先卸载旧版本再安装新版。$\n是否先卸载旧版本？" IDNO skip_old_openclaw
    auto_uninstall_openclaw:
    ExecWait '$0 /SILENT'
    skip_old_openclaw:
  ${EndIf}

  ; Check for old "ClawdbotService" installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClawdbotService_is1" "UninstallString"
  ${If} $0 != ""
    IfSilent auto_uninstall_service 0
    MessageBox MB_YESNO|MB_ICONINFORMATION "检测到旧版本 ClawdbotService，建议先卸载旧版本再安装新版。$\n是否先卸载旧版本？" IDNO skip_old_service
    auto_uninstall_service:
    ExecWait '$0 /SILENT'
    skip_old_service:
  ${EndIf}

  ; Check for old NSIS-based "Clawdbot" installation (different bundle ID)
  ReadRegStr $0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clawdbot" "UninstallString"
  ${If} $0 != ""
    IfSilent auto_uninstall_clawdbot 0
    MessageBox MB_YESNO|MB_ICONINFORMATION "检测到旧版本 Clawdbot，建议先卸载旧版本再安装新版。$\n是否先卸载旧版本？" IDNO skip_old_clawdbot
    auto_uninstall_clawdbot:
    ExecWait '$0 /S'
    skip_old_clawdbot:
  ${EndIf}

!macroend

; ============================================================================
; POSTINSTALL: write install.json for auto-update system + shortcuts
; ============================================================================
!macro NSIS_HOOK_POSTINSTALL
  ; Tauri handles registry keys and shortcuts automatically.
  ;
  ; Write install.json so the auto-update system can:
  ;   1. Detect this as an "installer" deployment (installer-updater.ts::detectInstallKind)
  ;   2. Read the update server URL (installer-updater.ts::resolveUpdateServerUrl)
  ;
  ; The ${VERSION} macro is provided by Tauri NSIS bundler from tauri.conf.json.
  FileOpen $0 "$INSTDIR\resources\install.json" w
  FileWrite $0 '{"installKind":"installer","updateServer":"https://www.obplugins.cn","version":"${VERSION}"}'
  FileClose $0

  ; Pass $INSTDIR via env var so paths containing single quotes don't break PowerShell parsing
  System::Call 'kernel32::SetEnvironmentVariableW(w "_CLAWDBOT_INSTDIR", w "$INSTDIR") i'

  ; --- Add Windows Defender exclusion for the install directory ---
  ; The bundled node.exe is unsigned and may be flagged as a threat by Windows Defender,
  ; preventing it from running. We add an exclusion for the entire install directory
  ; so that node.exe (the gateway runtime) can start without being blocked.
  ; This requires administrator privileges — Tauri NSIS installer runs elevated.
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "\
    try {\
      Add-MpPreference -ExclusionPath $$env:_CLAWDBOT_INSTDIR -ErrorAction Stop;\
      Write-Host (''Defender exclusion added: '' + $$env:_CLAWDBOT_INSTDIR);\
    } catch {\
      Write-Host (''Defender exclusion skipped: '' + $$_.Exception.Message);\
    }\
  "'
  Pop $0
  Pop $1

  ; --- Generate openclawcn.cmd CLI wrapper ---
  ; Allows users to run "openclawcn doctor", "openclawcn status", etc. from cmd/PowerShell.
  ; Uses %~dp0 (directory of the .cmd file itself) so it works regardless of install path.
  FileOpen $0 "$INSTDIR\openclawcn.cmd" w
  FileWrite $0 '@echo off$\r$\n"%~dp0resources\node\node.exe" "%~dp0resources\dist\entry.js" %*$\r$\n'
  FileClose $0

  ; --- Add $INSTDIR to user PATH for CLI access ---
  ; Uses PowerShell to safely modify HKCU\Environment\Path (no EnvVarUpdate.nsh — avoids
  ; known PATH corruption bugs). Checks for duplicates before appending.
  ; Broadcasts WM_SETTINGCHANGE so new terminals pick up the change immediately.
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "\
    $$instDir = $$env:_CLAWDBOT_INSTDIR;\
    $$regKey = ''HKCU:\Environment'';\
    $$curPath = (Get-ItemProperty -Path $$regKey -Name Path -EA 0).Path;\
    if (-not $$curPath) { $$curPath = '''' };\
    $$entries = $$curPath -split '';'' | Where-Object { $$_ -ne '''' };\
    $$already = $$entries | Where-Object { $$_ -eq $$instDir };\
    if (-not $$already) {\
      if ($$curPath -and $$curPath.Length -gt 0) {\
        $$newPath = $$curPath.TrimEnd('';'') + '';'' + $$instDir;\
      } else {\
        $$newPath = $$instDir;\
      };\
      Set-ItemProperty -Path $$regKey -Name Path -Value $$newPath -Type ExpandString;\
      Write-Host (''PATH updated: added '' + $$instDir);\
    } else {\
      Write-Host ''PATH already contains install dir, skipping'';\
    };\
  "'
  Pop $0
  Pop $1

  ; Broadcast WM_SETTINGCHANGE so open Explorer/terminals refresh PATH
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "\
    if (-not ([System.Management.Automation.PSTypeName]''NativeMethods'').Type) {\
      Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition ''\
        [DllImport(\\\"user32.dll\\\", SetLastError = true, CharSet = CharSet.Auto)]\
        public static extern IntPtr SendMessageTimeout(\
          IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,\
          uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'';\
    };\
    $$HWND_BROADCAST = [IntPtr]0xffff;\
    $$WM_SETTINGCHANGE = 0x1a;\
    $$result = [UIntPtr]::Zero;\
    [Win32.NativeMethods]::SendMessageTimeout($$HWND_BROADCAST, $$WM_SETTINGCHANGE, [UIntPtr]::Zero, ''Environment'', 2, 5000, [ref]$$result) | Out-Null;\
    Write-Host ''Environment change broadcasted'';\
  "'
  Pop $0
  Pop $1
!macroend

; ============================================================================
; PREUNINSTALL: clean up PATH and CLI wrapper before file removal
; ============================================================================
!macro NSIS_HOOK_PREUNINSTALL

  ; Pass $INSTDIR via env var so paths containing single quotes don't break PowerShell parsing
  System::Call 'kernel32::SetEnvironmentVariableW(w "_CLAWDBOT_INSTDIR", w "$INSTDIR") i'

  ; --- Remove $INSTDIR from user PATH ---
  ; Reverses the POSTINSTALL PATH addition. Uses exact-match removal to avoid
  ; corrupting other PATH entries that may contain similar substrings.
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "\
    $$instDir = $$env:_CLAWDBOT_INSTDIR;\
    $$regKey = ''HKCU:\Environment'';\
    $$curPath = (Get-ItemProperty -Path $$regKey -Name Path -EA 0).Path;\
    if ($$curPath) {\
      $$entries = $$curPath -split '';'' | Where-Object { $$_ -ne '''' -and $$_ -ne $$instDir };\
      $$newPath = $$entries -join '';'';\
      if ($$newPath) {\
        Set-ItemProperty -Path $$regKey -Name Path -Value $$newPath -Type ExpandString;\
      } else {\
        Remove-ItemProperty -Path $$regKey -Name Path -EA 0;\
      };\
      Write-Host (''PATH cleaned: removed '' + $$instDir);\
    };\
  "'
  Pop $0
  Pop $1

  ; --- Remove openclawcn.cmd ---
  Delete "$INSTDIR\openclawcn.cmd"

  ; Broadcast WM_SETTINGCHANGE
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "\
    if (-not ([System.Management.Automation.PSTypeName]''NativeMethods'').Type) {\
      Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition ''\
        [DllImport(\\\"user32.dll\\\", SetLastError = true, CharSet = CharSet.Auto)]\
        public static extern IntPtr SendMessageTimeout(\
          IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,\
          uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'';\
    };\
    $$HWND_BROADCAST = [IntPtr]0xffff;\
    $$WM_SETTINGCHANGE = 0x1a;\
    $$result = [UIntPtr]::Zero;\
    [Win32.NativeMethods]::SendMessageTimeout($$HWND_BROADCAST, $$WM_SETTINGCHANGE, [UIntPtr]::Zero, ''Environment'', 2, 5000, [ref]$$result) | Out-Null;\
    Write-Host ''Environment change broadcasted'';\
  "'
  Pop $0
  Pop $1
!macroend
