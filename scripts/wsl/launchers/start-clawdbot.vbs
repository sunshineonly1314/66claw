' Clawdbot WSL 启动脚本 (VBS 版本)
' 在后台启动 Clawdbot，无控制台窗口

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取脚本所在目录
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 创建日志目录
logDir = scriptPath & "\logs"
If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If

' 日志文件路径
logFile = logDir & "\clawdbot-wsl.log"

' 启动命令 - 后台运行 WSL 中的 Clawdbot
' 使用 start-daemon.sh 在后台启动，然后打开浏览器
startCmd = "wsl -d Ubuntu -e bash -c ""cd ~/clawdbot && ./start-daemon.sh"""

' 执行启动命令
WshShell.Run startCmd, 0, True

' 等待服务启动
WScript.Sleep 3000

' 打开浏览器
WshShell.Run "http://localhost:18789/setup", 1, False

' 显示通知
MsgBox "Clawdbot 已在后台启动！" & vbCrLf & vbCrLf & _
       "访问地址: http://localhost:18789" & vbCrLf & _
       "配置向导: http://localhost:18789/setup" & vbCrLf & vbCrLf & _
       "使用「停止 Clawdbot」可停止服务。", _
       vbInformation, "Clawdbot WSL"
