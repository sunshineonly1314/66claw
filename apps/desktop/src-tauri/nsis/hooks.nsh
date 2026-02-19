; ClawdbotCN NSIS Installer Hooks
; Custom pre/post install logic for Tauri 2.x NSIS bundler
; Ref: https://v2.tauri.app/distribute/windows-installer/

!include "LogicLib.nsh"

; ============================================================================
; PREINSTALL: old version detection, kill running process
; ============================================================================
!macro NSIS_HOOK_PREINSTALL

  ; --- 1. Detect old versions with different product names ---
  ; Check for old "OpenClawCN" (Inno Setup) installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenClawCN_is1" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONINFORMATION "检测到旧版本 OpenClawCN，建议先卸载旧版本再安装新版。是否先卸载旧版本？" IDNO skip_old_openclaw
    ExecWait '$0 /SILENT'
    skip_old_openclaw:
  ${EndIf}

  ; Check for old "ClawdbotService" installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClawdbotService_is1" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONINFORMATION "检测到旧版本 ClawdbotService，建议先卸载旧版本再安装新版。是否先卸载旧版本？" IDNO skip_old_service
    ExecWait '$0 /SILENT'
    skip_old_service:
  ${EndIf}

  ; Check for old NSIS-based "Clawdbot" installation (different bundle ID)
  ReadRegStr $0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clawdbot" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONINFORMATION "检测到旧版本 Clawdbot，建议先卸载旧版本再安装新版。是否先卸载旧版本？" IDNO skip_old_clawdbot
    ExecWait '$0'
    skip_old_clawdbot:
  ${EndIf}

  ; --- 2. Kill any running gateway process on port 18789 ---
  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 18789 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"'
  Pop $0
  Pop $1

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
  FileWrite $0 '{"installKind":"installer","updateServer":"https://dl.openclawcn.com","version":"${VERSION}"}'
  FileClose $0
!macroend
