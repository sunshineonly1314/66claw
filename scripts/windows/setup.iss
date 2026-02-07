; ClawdbotCN Windows Installer
; Built with Inno Setup 6+

#define MyAppName "ClawdbotCN"
#define MyAppNameCN "ClawdbotCN AI"
#define MyAppVersion "2026.2.7"
#define MyAppPublisher "ClawdbotCN"
#define MyAppURL "https://github.com/clawdbot/clawdbot"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppNameCN}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppNameCN}
OutputDir=E:\clawdbuild
OutputBaseFilename=ClawdbotCN-Setup-2026.2.7-x64
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

[Files]
Source: "node-portable\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "E:\clawdbuild\test-prod-deps\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\..\skills\*"; DestDir: "{app}\skills"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; Feishu extension
Source: "..\..\extensions\feishu\*"; DestDir: "{app}\extensions\feishu"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; DingTalk 闁圭粯甯婂▎?- 闂傚洠鍋撻悷?dingtalk-stream
Source: "..\..\extensions\dingtalk\*"; DestDir: "{app}\extensions\dingtalk"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; WeCom extension
Source: "..\..\extensions\wecom\*"; DestDir: "{app}\extensions\wecom"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\..\extensions\telegram\*"; DestDir: "{app}\extensions\telegram"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\..\extensions\discord\*"; DestDir: "{app}\extensions\discord"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\..\extensions\slack\*"; DestDir: "{app}\extensions\slack"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; Templates - bot default role config
Source: "..\..\docs\reference\templates\*"; DestDir: "{app}\docs\reference\templates"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "start-gateway.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "clawdbot.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "diagnose.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "view-logs.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "native\ClawdbotService.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\clawdbot.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\loading.html"; DestDir: "{app}\assets"; Flags: ignoreversion

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
Filename: "cmd.exe"; Parameters: "/c taskkill /f /im ClawdbotService.exe 2>nul"; Flags: runhidden waituntilterminated skipifdoesntexist
; Step 2: Kill node.exe processes started by ClawdbotCN (not all node.exe to avoid affecting Cursor IDE etc)
Filename: "cmd.exe"; Parameters: "/c wmic process where ""name='node.exe' and commandline like '%ClawdbotCN%'"" call terminate 2>nul"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "cmd.exe"; Parameters: "/c wmic process where ""name='node.exe' and commandline like '%clawdbot%'"" call terminate 2>nul"; Flags: runhidden waituntilterminated skipifdoesntexist

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\config"
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\logs"

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
begin
  Result := True;
  
  // Check for 64-bit Windows
  if not IsWin64 then
  begin
    MsgBox('ClawdbotCN AI '#$9700#$8981' 64 '#$4F4D' Windows '#$7CFB#$7EDF#$FF01, mbError, MB_OK);
    Result := False;
    Exit;
  end;
  
  // Check if old clawdbot config exists (from open-source version)
  OldConfigDir := GetEnv('USERPROFILE') + '\.clawdbot';
  if DirExists(OldConfigDir) then
  begin
    // Show info message - user can choose to continue or cancel
    if MsgBox(
      'Detected previous Clawdbot installation.' + #13#10 + #13#10 +
      'ClawdbotCN will use an isolated config directory.' + #13#10 +
      'Your original data will not be affected.' + #13#10 + #13#10 +
      'Old config: ' + OldConfigDir + #13#10 +
      'New config: %APPDATA%\ClawdbotCN' + #13#10 + #13#10 +
      'Click OK to continue, Cancel to exit.',
      mbInformation, MB_OKCANCEL) = IDCANCEL then
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
    // Uses WMIC to find and kill node.exe with matching path
    Exec('cmd.exe', '/c wmic process where "name=''node.exe'' and commandline like ''%ClawdbotCN%''" call terminate 2>nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('cmd.exe', '/c wmic process where "name=''node.exe'' and commandline like ''%clawdbot%''" call terminate 2>nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // Step 3: Small delay to ensure processes are fully terminated
    Sleep(500);
  end;
  
  if CurStep = ssPostInstall then
  begin
    // Create install marker
    InstallMarker := ExpandConstant('{app}\install.json');
    MarkerContent := '{' + #13#10 +
      '  "version": "{#MyAppVersion}",' + #13#10 +
      '  "installTime": "' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '",' + #13#10 +
      '  "firstLaunch": true' + #13#10 +
      '}';
    SaveStringToFile(InstallMarker, MarkerContent, False);
  end;
end;











































