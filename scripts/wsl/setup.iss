; Clawdbot WSL Windows Installer
; 一键安装 Clawdbot 到 WSL2 环境
; 使用 Inno Setup 6+ 构建

#define MyAppName "Clawdbot WSL"
#define MyAppVersion "2026.1.29"
#define MyAppPublisher "Clawdbot"
#define MyAppURL "https://github.com/clawdbot/clawdbot"

[Setup]
; 基本信息
AppId={{B2C3D4E5-F6A7-8901-BCDE-F12345678901}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; 输出设置
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\..\buildout\wsl
OutputBaseFilename=Clawdbot-WSL-Setup-v{#MyAppVersion}

; 压缩设置
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; 外观设置
WizardStyle=modern
DisableProgramGroupPage=yes
DisableWelcomePage=no
ShowLanguageDialog=auto

; 权限设置 - 需要管理员权限安装 WSL
PrivilegesRequired=admin

; 架构
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; 卸载设置
UninstallDisplayName={#MyAppName}

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
chinesesimplified.WelcomeLabel1=欢迎安装 {#MyAppName}
chinesesimplified.WelcomeLabel2=本向导将引导您完成 {#MyAppName} 的安装。%n%n{#MyAppName} 将在 WSL2 (Windows Subsystem for Linux) 中运行，提供最佳的兼容性和性能。%n%n安装过程会自动配置 WSL2 环境（如果尚未安装）。
chinesesimplified.FinishedLabel=安装完成！%n%n双击桌面上的「{#MyAppName}」图标启动程序，配置页面将在 Windows 浏览器中自动打开。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标:"; Flags: checked
Name: "startupicon"; Description: "开机自动启动"; GroupDescription: "附加选项:"; Flags: unchecked

[Files]
; WSL 部署包
Source: "..\..\build\wsl-standalone\clawdbot\*"; DestDir: "{app}\wsl-package"; Flags: ignoreversion recursesubdirs createallsubdirs

; Windows 启动脚本
Source: "launchers\start-clawdbot.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "launchers\start-clawdbot.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "launchers\stop-clawdbot.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "launchers\setup-wsl.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "launchers\deploy-to-wsl.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "launchers\check-wsl.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\logs"; Permissions: users-modify

[Icons]
; 开始菜单
Name: "{group}\{#MyAppName}"; Filename: "{app}\start-clawdbot.vbs"; WorkingDir: "{app}"; Comment: "启动 Clawdbot (WSL)"
Name: "{group}\停止 {#MyAppName}"; Filename: "{app}\stop-clawdbot.bat"; WorkingDir: "{app}"; Comment: "停止 Clawdbot"
Name: "{group}\{#MyAppName} 控制台"; Filename: "http://localhost:18789/"; Comment: "打开 Clawdbot Web 控制台"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"

; 桌面图标
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start-clawdbot.vbs"; WorkingDir: "{app}"; Tasks: desktopicon; Comment: "启动 Clawdbot (WSL)"

; 开机启动
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\start-clawdbot.vbs"; WorkingDir: "{app}"; Tasks: startupicon

[Run]
; 安装完成后检查并配置 WSL
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\setup-wsl.ps1"""; StatusMsg: "检查 WSL2 环境..."; Flags: runhidden waituntilterminated
; 部署到 WSL
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\deploy-to-wsl.ps1"" -PackagePath ""{app}\wsl-package"""; StatusMsg: "部署 Clawdbot 到 WSL..."; Flags: runhidden waituntilterminated
; 启动服务并打开浏览器
Filename: "{app}\start-clawdbot.vbs"; Description: "启动 Clawdbot 并打开配置页面"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; 卸载前停止服务
Filename: "{app}\stop-clawdbot.bat"; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"

[Code]
var
  NeedRestart: Boolean;

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
  WslStatus: AnsiString;
begin
  Result := True;
  NeedRestart := False;
  
  // 检查 Windows 版本
  if not IsWin64 then
  begin
    MsgBox('Clawdbot WSL 需要 64 位 Windows 10/11。', mbError, MB_OK);
    Result := False;
    Exit;
  end;
end;

function NeedReboot(): Boolean;
begin
  Result := NeedRestart;
end;
