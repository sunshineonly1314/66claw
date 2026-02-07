' ClawdbotCN Silent Launcher
' Launch clawdbot.bat without showing command window

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Get arguments
args = ""
For i = 0 To WScript.Arguments.Count - 1
    args = args & " " & WScript.Arguments(i)
Next

' Run clawdbot.bat (0 = hidden window)
batPath = scriptDir & "\clawdbot.bat"
WshShell.Run """" & batPath & """" & args, 0, False
