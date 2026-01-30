; Clawdbot Windows Installer
; 使用 Inno Setup 6+ 构建
; 文档: https://jrsoftware.org/ishelp/

#define MyAppName "Clawdbot"
#define MyAppVersion "2026.1.25"
#define MyAppPublisher "Clawdbot"
#define MyAppURL "https://github.com/clawdbot/clawdbot"
#define MyAppExeName "start.bat"

[Setup]
; 基本信息
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; 输出设置
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\..\installer
OutputBaseFilename=ClawdbotSetup-{#MyAppVersion}-x64

; 压缩设置
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4

; 外观设置
WizardStyle=modern
DisableProgramGroupPage=yes
DisableWelcomePage=no
ShowLanguageDialog=auto

; 权限设置
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; 架构
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; 卸载设置
UninstallDisplayIcon={app}\node\node.exe
UninstallDisplayName={#MyAppName}

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
chinesesimplified.WelcomeLabel1=欢迎安装 {#MyAppName}
chinesesimplified.WelcomeLabel2=本向导将引导您完成 {#MyAppName} 的安装。%n%n{#MyAppName} 是一个强大的 AI 助手，支持飞书、钉钉等多种通讯渠道。%n%n建议关闭其他应用程序后继续。
chinesesimplified.FinishedLabel=安装完成！%n%n双击桌面上的「{#MyAppName}」图标启动程序，然后在浏览器中完成配置。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标:"; Flags: checked
Name: "startupicon"; Description: "开机自动启动"; GroupDescription: "附加选项:"; Flags: unchecked

[Files]
; Node.js 运行时
Source: "node-portable\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; 应用程序文件
Source: "..\..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; node_modules (生产依赖)
Source: "..\..\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; 配置文件
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion

; ========== 常用插件 (Extensions) ==========
; 中国区渠道插件
Source: "..\..\extensions\feishu\*"; DestDir: "{app}\extensions\feishu"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\dingtalk\*"; DestDir: "{app}\extensions\dingtalk"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\wecom\*"; DestDir: "{app}\extensions\wecom"; Flags: ignoreversion recursesubdirs createallsubdirs

; 认证插件
Source: "..\..\extensions\qwen-portal-auth\*"; DestDir: "{app}\extensions\qwen-portal-auth"; Flags: ignoreversion recursesubdirs createallsubdirs

; 国际渠道插件
Source: "..\..\extensions\telegram\*"; DestDir: "{app}\extensions\telegram"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\discord\*"; DestDir: "{app}\extensions\discord"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\slack\*"; DestDir: "{app}\extensions\slack"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\whatsapp\*"; DestDir: "{app}\extensions\whatsapp"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\signal\*"; DestDir: "{app}\extensions\signal"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\extensions\googlechat\*"; DestDir: "{app}\extensions\googlechat"; Flags: ignoreversion recursesubdirs createallsubdirs

; 启动脚本
Source: "start-gateway.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "clawdbot.bat"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\config"; Permissions: users-modify
Name: "{app}\data"; Permissions: users-modify
Name: "{app}\logs"; Permissions: users-modify

[Icons]
; 开始菜单
Name: "{group}\{#MyAppName}"; Filename: "{app}\start-gateway.bat"; WorkingDir: "{app}"; Comment: "启动 Clawdbot Gateway"
Name: "{group}\{#MyAppName} 控制台"; Filename: "http://localhost:18789/"; Comment: "打开 Clawdbot Web 控制台"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"

; 桌面图标
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start-gateway.bat"; WorkingDir: "{app}"; Tasks: desktopicon; Comment: "启动 Clawdbot Gateway"

; 开机启动
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\start-gateway.bat"; WorkingDir: "{app}"; Tasks: startupicon; Parameters: "--silent"

[Run]
; 安装完成后打开配置页面
Filename: "http://localhost:18789/setup"; Description: "打开配置向导"; Flags: postinstall shellexec skipifsilent checked
Filename: "{app}\start-gateway.bat"; Description: "启动 Clawdbot Gateway"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\config"
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\logs"

[Code]
// 检查端口是否被占用
function IsPortInUse(Port: Integer): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec('cmd.exe', '/c netstat -an | findstr :' + IntToStr(Port) + ' | findstr LISTENING', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := (ResultCode = 0);
  end;
end;

// 安装前检查
function InitializeSetup(): Boolean;
begin
  Result := True;
  
  // 检查默认端口
  if IsPortInUse(18789) then
  begin
    if MsgBox('检测到端口 18789 已被占用。' + #13#10 + #13#10 + 
              '这可能是因为 Clawdbot 已在运行，或有其他程序占用该端口。' + #13#10 + #13#10 +
              '是否仍要继续安装？', mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
    end;
  end;
end;

// 卸载前停止服务
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    // 尝试停止运行中的 Clawdbot 进程
    Exec('cmd.exe', '/c taskkill /f /im node.exe /fi "WINDOWTITLE eq Clawdbot*"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
