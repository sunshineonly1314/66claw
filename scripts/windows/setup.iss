; ClawdbotCN Windows Installer
; Built with Inno Setup 6+

#define MyAppName "ClawdbotCN"
#define MyAppNameCN "ClawdbotCN AI"
#define MyAppVersion "2026.2.0"
#define MyAppPublisher "ClawdbotCN"
#define MyAppURL "https://github.com/clawdbot/clawdbot"
#define MyAppUpdateServer "https://dl.obplugins.cn"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppNameCN}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppNameCN}
OutputDir=E:\clawdbuild
OutputBaseFilename=ClawdbotCN-Setup-2026.2.0-x64
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
SetupIconFile=assets\clawdbot.ico
WizardSmallImageFile=assets\setup-logo.bmp
WizardImageFile=assets\setup-banner.bmp
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\clawdbot.ico
UninstallDisplayName={#MyAppNameCN}

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{code:GetDesktopIconDesc}"; GroupDescription: "{code:GetShortcutsGroup}"
Name: "startmenuicon"; Description: "{code:GetStartMenuDesc}"; GroupDescription: "{code:GetShortcutsGroup}"
Name: "startupicon"; Description: "{code:GetStartupDesc}"; GroupDescription: "{code:GetStartupGroup}"

[Dirs]
Name: "{app}\config"; Permissions: users-modify
Name: "{app}\data"; Permissions: users-modify
Name: "{app}\logs"; Permissions: users-modify
Name: "{app}\tools"; Permissions: users-modify

[Files]
Source: "node-portable\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "E:\clawdbuild\test-prod-deps\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\..\skills\*"; DestDir: "{app}\skills"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; MCP marketplace index (bundled fallback for Extensions/Capability Store UI)
Source: "..\..\data\*"; DestDir: "{app}\data"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; All extensions (33 plugins — wildcard to prevent future omissions)
; Exclude node_modules (Inno Setup 32-bit OOM with feishu's 817-file dep tree under LZMA2)
; Extensions with deps (feishu, dingtalk, etc.) install them on first run via postinstall
; Exclude .turbo (dev-only build cache)
Source: "..\..\extensions\*"; DestDir: "{app}\extensions"; Excludes: "node_modules\*,.turbo\*"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; Templates - bot default role config (CN build uses Chinese templates)
Source: "..\..\docs-cn\reference\templates\*"; DestDir: "{app}\docs\reference\templates"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "start-gateway.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "clawdbot.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "diagnose.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "view-logs.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "native\ClawdbotService.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\clawdbot.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\loading.html"; DestDir: "{app}\assets"; Flags: ignoreversion
; Pre-bundled tool binaries for CN users (GitHub not directly accessible)
; B-class tools: steipete/tap + other brew-only tools with Windows binaries
; Manually maintained in scripts\windows\bundled-bins\ (~36MB total)
; skipifsourcedoesntexist: safe for dev builds without bundled-bins
Source: "bundled-bins\camsnap.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "bundled-bins\sag.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "bundled-bins\gog.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "bundled-bins\goplaces.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "bundled-bins\openhue.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "bundled-bins\spogo.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "bundled-bins\jira.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
; README, LICENSE, CHANGELOG (distribution compliance)
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\CHANGELOG.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
; pnpm patches (required by proper-lockfile@4.1.2)
Source: "..\..\patches\*"; DestDir: "{app}\patches"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; postinstall scripts (referenced by package.json)
Source: "..\..\scripts\postinstall.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\scripts\format-staged.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\scripts\setup-git-hooks.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
; git hooks (optional)
Source: "..\..\git-hooks\*"; DestDir: "{app}\git-hooks"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

[Icons]
Name: "{autodesktop}\{#MyAppNameCN}"; Filename: "{app}\ClawdbotService.exe"; Parameters: "open"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: desktopicon
Name: "{group}\{#MyAppNameCN}"; Filename: "{app}\ClawdbotService.exe"; Parameters: "open"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: startmenuicon
Name: "{group}\{code:GetViewLogsText}"; Filename: "{app}\view-logs.bat"; WorkingDir: "{app}"; Tasks: startmenuicon
Name: "{group}\{code:GetUninstallText}"; Filename: "{uninstallexe}"; Tasks: startmenuicon
Name: "{userstartup}\{#MyAppNameCN}"; Filename: "{app}\ClawdbotService.exe"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: startupicon

[Run]
Filename: "{app}\ClawdbotService.exe"; Parameters: "open"; WorkingDir: "{app}"; Description: "{code:GetLaunchDesc}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Step 1: Kill ClawdbotService.exe
Filename: "cmd.exe"; Parameters: "/c taskkill /f /im ClawdbotService.exe 2>nul"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "KillService"
; Step 2: Kill node.exe processes started by ClawdbotCN (not all node.exe to avoid affecting Cursor IDE etc)
; Uses PowerShell Get-Process (wmic removed in Win11 24H2+)
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""Get-Process node -EA SilentlyContinue | Where-Object {{ $_.Path -like '*ClawdbotCN*' -or $_.Path -like '*clawdbot*' }} | Stop-Process -Force -EA SilentlyContinue"""; Flags: runhidden waituntilterminated; RunOnceId: "KillNodeProcesses"
; Step 3: Kill any process occupying port 18789
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""netstat -ano | Select-String ':18789\s' | Select-String 'LISTENING' | ForEach-Object {{ $p = ($_ -split '\s+')[-1]; if ($p -match '^\d+$' -and [int]$p -gt 0) {{ Stop-Process -Id ([int]$p) -Force -EA SilentlyContinue }} }}"""; Flags: runhidden waituntilterminated; RunOnceId: "KillPort18789"

[InstallDelete]
; Clean stale node_modules from previous version on upgrade (prevents version conflicts)
Type: filesandordirs; Name: "{app}\node_modules"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\config"
; {app}\data is intentionally NOT deleted on uninstall — it contains user sessions,
; agent workspace, and config that the user may want to keep for reinstall/recovery.
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\tools"
Type: filesandordirs; Name: "{app}\patches"
Type: filesandordirs; Name: "{app}\scripts"
Type: filesandordirs; Name: "{app}\git-hooks"
; install.json is created programmatically by [Code], not via [Files], so must be explicitly listed
Type: files; Name: "{app}\install.json"
Type: files; Name: "{app}\README.md"
Type: files; Name: "{app}\CHANGELOG.md"
Type: files; Name: "{app}\LICENSE"

[Registry]
Root: HKCU; Subkey: "SOFTWARE\ClawdbotCN"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey

[Code]
function GetDesktopIconDesc(Param: String): String;
begin
  Result := #$521B#$5EFA#$684C#$9762#$5FEB#$6377#$65B9#$5F0F;
end;

function GetStartMenuDesc(Param: String): String;
begin
  Result := #$521B#$5EFA#$5F00#$59CB#$83DC#$5355#$5FEB#$6377#$65B9#$5F0F;
end;

function GetStartupDesc(Param: String): String;
begin
  Result := #$5F00#$673A#$81EA#$52A8#$542F#$52A8#$FF08#$63A8#$8350#$FF09;
end;

function GetShortcutsGroup(Param: String): String;
begin
  Result := #$5FEB#$6377#$65B9#$5F0F#$003A;
end;

function GetStartupGroup(Param: String): String;
begin
  Result := #$542F#$52A8#$9009#$9879#$003A;
end;

function GetLaunchDesc(Param: String): String;
begin
  Result := #$7ACB#$5373#$542F#$52A8' ClawdbotCN AI';
end;

function GetViewLogsText(Param: String): String;
begin
  Result := #$67E5#$770B#$65E5#$5FD7;
end;

function GetUninstallText(Param: String): String;
begin
  Result := #$5378#$8F7D' {#MyAppNameCN}';
end;

function InitializeSetup(): Boolean;
var
  OldConfigDir: String;
  FreeMB, TotalMB: Cardinal;
  DrivePath: String;
  ResultCode: Integer;
begin
  Result := True;

  // Check for 64-bit Windows
  if not IsWin64 then
  begin
    MsgBox('ClawdbotCN AI '#$9700#$8981' 64 '#$4F4D' Windows '#$7CFB#$7EDF#$FF01, mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // Check disk space on target drive (require at least 1 GB free)
  DrivePath := ExtractFileDrive(ExpandConstant('{autopf}')) + '\';
  if GetSpaceOnDisk(DrivePath, True, FreeMB, TotalMB) then
  begin
    if FreeMB < 1024 then
    begin
      MsgBox(#$78C1#$76D8#$7A7A#$95F4#$4E0D#$8DB3#$FF01 + #13#10 + #13#10
        + #$9700#$8981#$81F3#$5C11 + ' 1 GB ' + #$53EF#$7528#$7A7A#$95F4#$FF0C
        + #$5F53#$524D#$53EA#$6709 + ' ' + IntToStr(FreeMB) + ' MB' + #13#10 + #13#10
        + #$8BF7#$91CA#$653E#$78C1#$76D8#$7A7A#$95F4#$540E#$91CD#$8BD5#$3002,
        mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;

  // Check if port 18789 is already in use (warning, not blocking)
  Exec('cmd.exe', '/c netstat -an 2>nul | findstr ":18789 " | findstr "LISTENING" >nul 2>&1',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if ResultCode = 0 then
  begin
    // SuppressibleMsgBox: auto-selects IDYES under /SUPPRESSMSGBOXES (silent install)
    if SuppressibleMsgBox(#$7AEF#$53E3 + ' 18789 ' + #$5DF2#$88AB#$5360#$7528#$FF01 + #13#10 + #13#10
      + 'ClawdbotCN ' + #$9700#$8981#$4F7F#$7528#$6B64#$7AEF#$53E3#$3002 + #13#10
      + #$5B89#$88C5#$7A0B#$5E8F#$5C06#$5728#$5B89#$88C5#$65F6#$81EA#$52A8#$5173#$95ED#$5360#$7528#$8FDB#$7A0B#$3002 + #13#10 + #13#10
      + #$662F#$5426#$7EE7#$7EED#$5B89#$88C5#$FF1F,
      mbConfirmation, MB_YESNO, IDYES) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  // Check if old clawdbot config exists (from open-source version)
  OldConfigDir := GetEnv('USERPROFILE') + '\.clawdbot';
  if DirExists(OldConfigDir) then
  begin
    // SuppressibleMsgBox: auto-selects IDOK under /SUPPRESSMSGBOXES (silent install)
    if SuppressibleMsgBox(
      'Detected previous Clawdbot installation.' + #13#10 + #13#10 +
      'ClawdbotCN will use an isolated config directory.' + #13#10 +
      'Your original data will not be affected.' + #13#10 + #13#10 +
      'Old config: ' + OldConfigDir + #13#10 +
      'New config: %APPDATA%\ClawdbotCN' + #13#10 + #13#10 +
      'Click OK to continue, Cancel to exit.',
      mbInformation, MB_OKCANCEL, IDOK) = IDCANCEL then
    begin
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  InstallMarker: String;
  MarkerContent: String;
  InstallDir: String;
begin
  if CurStep = ssInstall then
  begin
    // Get installation directory
    InstallDir := ExpandConstant('{app}');

    // Step 1: Kill ClawdbotService.exe first
    Exec('cmd.exe', '/c taskkill /f /im ClawdbotService.exe 2>nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Step 2: Kill node.exe processes started from installation directory
    // Uses PowerShell Get-Process (wmic removed in Win11 24H2+)
    Exec('powershell.exe', '-NoProfile -Command "Get-Process node -EA SilentlyContinue | Where-Object { $_.Path -like ''*ClawdbotCN*'' -or $_.Path -like ''*clawdbot*'' } | Stop-Process -Force -EA SilentlyContinue"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Step 3: Kill ANY process occupying port 18789 (catches processes missed by name/path matching)
    Exec('powershell.exe', '-NoProfile -Command "netstat -ano | Select-String '':18789\s'' | Select-String ''LISTENING'' | ForEach-Object { $p = ($_ -split ''\s+'')[-1]; if ($p -match ''^\d+$'' -and [int]$p -gt 0) { Stop-Process -Id ([int]$p) -Force -EA SilentlyContinue } }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Step 4: Delay to ensure processes are fully terminated and port is released
    Sleep(2000);
  end;

  if CurStep = ssPostInstall then
  begin
    // Create install marker (preserve firstLaunch=false on upgrade)
    InstallMarker := ExpandConstant('{app}\install.json');
    if FileExists(InstallMarker) then
    begin
      // Upgrade: update version but do NOT reset firstLaunch
      MarkerContent := '{' + #13#10 +
        '  "version": "{#MyAppVersion}",' + #13#10 +
        '  "installTime": "' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '",' + #13#10 +
        '  "firstLaunch": false,' + #13#10 +
        '  "updateServer": "{#MyAppUpdateServer}"' + #13#10 +
        '}';
    end
    else
    begin
      // Fresh install
      MarkerContent := '{' + #13#10 +
        '  "version": "{#MyAppVersion}",' + #13#10 +
        '  "installTime": "' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '",' + #13#10 +
        '  "firstLaunch": true,' + #13#10 +
        '  "updateServer": "{#MyAppUpdateServer}"' + #13#10 +
        '}';
    end;
    SaveStringToFile(InstallMarker, MarkerContent, False);

    // Show antivirus whitelist guidance (first install only)
    // On upgrade (firstLaunch=false), user presumably already handled this.
    if not FileExists(InstallMarker) or (Pos('"firstLaunch": true', MarkerContent) > 0) then
    begin
      MsgBox(
        '' + #$5B89#$88C5#$5B8C#$6210#$FF01 + #13#10 + #13#10 +
        '' + #$5982#$679C#$542F#$52A8#$65F6#$9047#$5230#$95EE#$9898#$FF0C#$8BF7#$5C06#$4EE5#$4E0B#$76EE#$5F55#$6DFB#$52A0#$5230#$6740#$6BD2#$8F6F#$4EF6#$4FE1#$4EFB#$5217#$8868#$FF1A + #13#10 +
        ExpandConstant('{app}') + #13#10 + #13#10 +
        '' + #$5E38#$89C1#$6740#$6BD2#$8F6F#$4EF6#$8BBE#$7F6E#$65B9#$6CD5#$FF1A + #13#10 +
        '' + #$2022 + ' 360' + #$5B89#$5168#$536B#$58EB#$FF1A#$8BBE#$7F6E + ' '#$2192 + ' '#$5B89#$5168#$9632#$62A4 + ' '#$2192 + ' '#$4FE1#$4EFB#$5217#$8868 + #13#10 +
        '' + #$2022 + ' '#$706B#$7ED2#$FF1A#$4FE1#$4EFB#$533A + ' '#$2192 + ' '#$6DFB#$52A0#$6587#$4EF6#$5939 + #13#10 +
        '' + #$2022 + ' Windows Defender'#$FF1A#$75C5#$6BD2#$9632#$62A4#$8BBE#$7F6E + ' '#$2192 + ' '#$6392#$9664#$9879 + #13#10 +
        '' + #$2022 + ' '#$817E#$8BAF#$7535#$8111#$7BA1#$5BB6#$FF1A#$5DE5#$5177#$7BB1 + ' '#$2192 + ' '#$4FE1#$4EFB#$7BA1#$7406,
        mbInformation, MB_OK);
    end;
  end;
end;
