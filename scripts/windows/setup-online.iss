; ============================================================================
; Clawdbot Windows 瀹夎绋嬪簭 - 鍦ㄧ嚎鐗堬紙闇€涓嬭浇渚濊禆锛?; Built with Inno Setup 6+
; ============================================================================

#define MyAppName "ClawdbotCN"
#define MyAppNameCN "ClawdbotCN 涓枃AI"
#define MyAppVersion "2026.2.3"
#define MyAppPublisher "ClawdbotCN"
#define MyAppURL "https://github.com/clawdbot/clawdbot"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppNameCN}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppNameCN}

; 璺緞閫夋嫨
DisableDirPage=no
UsePreviousAppDir=yes
DirExistsWarning=no
OutputDir=E:\clawdbuild
OutputBaseFilename=ClawdbotCN-Setup-2026.2.3-x64-online

; Multi-threaded compression
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=16
LZMABlockSize=65536

WizardStyle=modern
DisableProgramGroupPage=yes
DisableWelcomePage=no

; Icons and images (place files in assets\ folder)
SetupIconFile=assets\clawdbot.ico
WizardSmallImageFile=assets\setup-logo.bmp
WizardImageFile=assets\setup-banner.bmp

PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

UninstallDisplayIcon={app}\clawdbot.ico
UninstallDisplayName={#MyAppNameCN}

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
chinesesimplified.BeveledLabel=ClawdbotCN 涓枃AI - 鏅鸿兘鍔╂墜锛堝湪绾垮畨瑁呯増锛?chinesesimplified.WelcomeLabel1=娆㈣繋瀹夎 ClawdbotCN 涓枃AI
chinesesimplified.WelcomeLabel2=杩欏皢鍦ㄦ偍鐨勮绠楁満涓婂畨瑁?ClawdbotCN 涓枃AI 鏅鸿兘鍔╂墜銆?n%n瀹夎杩囩▼闇€瑕佽仈缃戜笅杞戒緷璧栧寘銆?n%n寤鸿鍦ㄧ户缁箣鍓嶅叧闂叾浠栧簲鐢ㄧ▼搴忋€?n%n鐐瑰嚮"涓嬩竴姝?缁х画瀹夎銆?chinesesimplified.FinishedHeadingLabel=瀹夎瀹屾垚
chinesesimplified.FinishedLabel=ClawdbotCN 涓枃AI 宸叉垚鍔熷畨瑁呭埌鎮ㄧ殑璁＄畻鏈恒€?n%n鐐瑰嚮"瀹屾垚"閫€鍑哄畨瑁呯▼搴忋€?
[Tasks]
Name: "desktopicon"; Description: "鍒涘缓妗岄潰蹇嵎鏂瑰紡"; GroupDescription: "蹇嵎鏂瑰紡閫夐」:"
Name: "startmenuicon"; Description: "鍒涘缓寮€濮嬭彍鍗曞揩鎹锋柟寮?; GroupDescription: "蹇嵎鏂瑰紡閫夐」:"
Name: "startupicon"; Description: "寮€鏈鸿嚜鍔ㄥ惎鍔?ClawdbotCN锛堟帹鑽愶紝鍚姩鍚庡彲鍦ㄦ墭鐩樻煡鐪嬬姸鎬侊級"; GroupDescription: "鍚姩閫夐」:"

[Dirs]
Name: "{app}\config"; Permissions: users-modify
Name: "{app}\data"; Permissions: users-modify
Name: "{app}\logs"; Permissions: users-modify
Name: "{app}\extensions"

[Files]
; Node.js runtime
Source: "node-portable\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Application core
Source: "..\..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.test.js,*.test.d.ts"
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion

; 鍦ㄧ嚎鐗堜笉鍖呭惈 node_modules锛岄渶瑕佸畨瑁呮椂涓嬭浇

; Assets
Source: "..\..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Skills
Source: "..\..\skills\*"; DestDir: "{app}\skills"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Docs (templates required for workspace)
Source: "..\..\docs\reference\templates\*"; DestDir: "{app}\docs\reference\templates"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Extensions (TypeScript source included, node_modules installed by install-deps.bat)
; Feishu - needs @larksuiteoapi/node-sdk (official Feishu/Lark SDK, ~2MB)
Source: "..\..\extensions\feishu\*"; DestDir: "{app}\extensions\feishu"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"
; DingTalk - needs dingtalk-stream
Source: "..\..\extensions\dingtalk\*"; DestDir: "{app}\extensions\dingtalk"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"
; WeCom
Source: "..\..\extensions\wecom\*"; DestDir: "{app}\extensions\wecom"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"
Source: "..\..\extensions\copilot-proxy\*"; DestDir: "{app}\extensions\copilot-proxy"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"
Source: "..\..\extensions\telegram\*"; DestDir: "{app}\extensions\telegram"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"
Source: "..\..\extensions\discord\*"; DestDir: "{app}\extensions\discord"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"
Source: "..\..\extensions\slack\*"; DestDir: "{app}\extensions\slack"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist; Excludes: "node_modules,*.test.ts"

; Scripts
Source: "start-gateway.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "clawdbot.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "clawdbot-silent.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-deps.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "post-install.bat"; DestDir: "{app}"; Flags: ignoreversion

; Tray application
Source: "ClawdbotTray.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "StartTray.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "StartGateway.vbs"; DestDir: "{app}"; Flags: ignoreversion

; Icon
Source: "assets\clawdbot.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Desktop shortcut - opens browser
Name: "{autodesktop}\{#MyAppNameCN}"; Filename: "{app}\clawdbot-silent.vbs"; Parameters: "--open"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: desktopicon

; Start Menu
Name: "{group}\{#MyAppNameCN}"; Filename: "{app}\clawdbot-silent.vbs"; Parameters: "--open"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: startmenuicon
Name: "{group}\鎵樼洏绠＄悊鍣?; Filename: "{app}\StartTray.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: startmenuicon
Name: "{group}\鍗歌浇 {#MyAppNameCN}"; Filename: "{uninstallexe}"; Tasks: startmenuicon

; Auto-start: launch tray app on login (monitors Gateway status)
Name: "{userstartup}\{#MyAppNameCN}"; Filename: "{app}\StartTray.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\clawdbot.ico"; Tasks: startupicon

[Run]
; Step 1: Install dependencies (visible window so user can see progress)
Filename: "{app}\install-deps.bat"; WorkingDir: "{app}"; StatusMsg: "Installing dependencies (China mirror)..."; Flags: waituntilterminated

; Step 2: Post-install: Start Gateway and open setup wizard
Filename: "{app}\post-install.bat"; WorkingDir: "{app}"; Description: "Run ClawdbotCN now (recommended)"; Flags: postinstall nowait

[UninstallRun]
Filename: "cmd.exe"; Parameters: "/c taskkill /f /im node.exe /fi ""WINDOWTITLE eq *Clawdbot*"" 2>nul"; Flags: runhidden waituntilterminated; RunOnceId: "StopClawdbot"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\config"
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\logs"

[Registry]
Root: HKCU; Subkey: "SOFTWARE\Clawdbot"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "SOFTWARE\Clawdbot"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey

[Code]
const
  MIN_DISK_SPACE_MB = 800;
  MIN_WINDOWS_BUILD = 17763;

function IsPortInUse(Port: Integer): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec('cmd.exe', '/c netstat -an | findstr :' + IntToStr(Port) + ' | findstr LISTENING', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := (ResultCode = 0);
end;

function IsNpmClawdbotInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec('cmd.exe', '/c npm list -g clawdbot 2>nul | findstr clawdbot', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := (ResultCode = 0);
end;

function HasOldConfigDir(): Boolean;
begin
  Result := DirExists(ExpandConstant('{userappdata}\..\.clawdbot'));
end;

function HasOtherInstallation(): Boolean;
var
  InstallPath: String;
begin
  Result := False;
  if RegQueryStringValue(HKEY_CURRENT_USER, 'SOFTWARE\Clawdbot', 'InstallPath', InstallPath) then
    if (InstallPath <> '') and DirExists(InstallPath) then
      Result := True;
end;

function GetFreeDiskSpaceMB(Path: String): Integer;
var
  FreeSpace, TotalSpace: Int64;
begin
  Result := 0;
  if GetSpaceOnDisk64(ExtractFileDrive(Path), FreeSpace, TotalSpace) then
    Result := FreeSpace div (1024 * 1024);
end;

function InitializeSetup(): Boolean;
var
  FreeMB: Integer;
  Version: TWindowsVersion;
  ResultCode: Integer;
begin
  Result := True;

  // 妫€鏌?64 浣嶇郴缁?  if not IsWin64 then
  begin
    MsgBox('鎶辨瓑锛孋lawdbotCN 涓枃AI 闇€瑕?64 浣?Windows 绯荤粺锛? + #13#10 + #13#10 +
           '鎮ㄧ殑绯荤粺鏄?32 浣嶏紝鏃犳硶瀹夎鏈蒋浠躲€?, mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 妫€鏌?Windows 鐗堟湰
  GetWindowsVersionEx(Version);
  if Version.Build < MIN_WINDOWS_BUILD then
  begin
    MsgBox('鎶辨瓑锛屾偍鐨?Windows 鐗堟湰杩囦綆锛? + #13#10 + #13#10 +
           '闇€瑕?Windows 10 1809 鎴栨洿鏂扮増鏈紙Build ' + IntToStr(MIN_WINDOWS_BUILD) + '+锛? + #13#10 +
           '璇锋洿鏂扮郴缁熷悗閲嶈瘯銆?, mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 妫€鏌ョ鐩樼┖闂?  FreeMB := GetFreeDiskSpaceMB(ExpandConstant('{autopf}'));
  if FreeMB < MIN_DISK_SPACE_MB then
  begin
    MsgBox('纾佺洏绌洪棿涓嶈冻锛? + #13#10 + #13#10 +
           '瀹夎闇€瑕佽嚦灏?' + IntToStr(MIN_DISK_SPACE_MB) + ' MB 绌洪棿' + #13#10 +
           '褰撳墠鍙敤: ' + IntToStr(FreeMB) + ' MB' + #13#10 + #13#10 +
           '璇锋竻鐞嗙鐩樼┖闂村悗閲嶈瘯銆?, mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 妫€鏌ョ鍙ｅ崰鐢?- 鑷姩娓呯悊
  if IsPortInUse(18789) then
  begin
    if MsgBox('妫€娴嬪埌绔彛 18789 琚崰鐢紒' + #13#10 + #13#10 +
              '鍙兘鏄箣鍓嶇殑 ClawdbotCN 鏈嶅姟杩樺湪杩愯銆? + #13#10 +
              '鏄惁鍏抽棴璇ユ湇鍔″苟缁х画瀹夎锛?, mbConfirmation, MB_YESNO) = IDYES then
    begin
      Exec('cmd.exe', '/c taskkill /f /im node.exe 2>nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(2000);
    end
    else
    begin
      Result := False;
      Exit;
    end;
  end;

  // 妫€鏌?npm 鍏ㄥ眬瀹夎
  if IsNpmClawdbotInstalled() then
  begin
    if MsgBox('妫€娴嬪埌閫氳繃 npm 鍏ㄥ眬瀹夎鐨?Clawdbot锛? + #13#10 + #13#10 +
              '涓洪伩鍏嶅啿绐侊紝寤鸿鍏堣繍琛屼互涓嬪懡浠ゅ嵏杞斤細' + #13#10 +
              '  npm uninstall -g clawdbot' + #13#10 + #13#10 +
              '鏄惁浠嶈缁х画瀹夎锛?, mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  // 妫€鏌ュ凡鏈夊畨瑁?  if HasOtherInstallation() then
  begin
    MsgBox('妫€娴嬪埌宸叉湁 ClawdbotCN 瀹夎銆? + #13#10 + #13#10 +
           '灏嗕负鎮ㄦ洿鏂板埌鏈€鏂扮増鏈紝閰嶇疆鏂囦欢浼氫繚鐣欍€?, mbInformation, MB_OK);
  end;

  // 妫€鏌ユ棫閰嶇疆鐩綍
  if HasOldConfigDir() then
  begin
    MsgBox('鎻愮ず锛氭娴嬪埌宸叉湁閰嶇疆鏂囦欢' + #13#10 + #13#10 +
           '鎮ㄤ箣鍓嶄娇鐢ㄨ繃 ClawdbotCN锛岄厤缃枃浠跺皢琚繚鐣欍€? + #13#10 +
           '濡傞渶鍏ㄦ柊瀹夎锛岃鎵嬪姩鍒犻櫎 %USERPROFILE%\.clawdbot 鐩綍銆?, mbInformation, MB_OK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
    Exec('cmd.exe', '/c taskkill /f /im node.exe /fi "WINDOWTITLE eq *Clawdbot*" 2>nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('cmd.exe', '/c taskkill /f /im node.exe /fi "WINDOWTITLE eq *Clawdbot*" 2>nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
  end;
end;





