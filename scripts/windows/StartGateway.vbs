' ClawdbotCN Gateway Silent Launcher
' Calls start-gateway.bat silently

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
startScript = scriptDir & "\start-gateway.bat"

' Run start-gateway.bat (0 = hidden, False = no wait)
If fso.FileExists(startScript) Then
    WshShell.Run """" & startScript & """", 0, False
End If
