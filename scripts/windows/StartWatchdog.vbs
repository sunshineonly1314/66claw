' ClawdbotCN Watchdog Launcher
' Launch watchdog silently

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
watchdogScript = scriptDir & "\ClawdbotWatchdog.ps1"

If fso.FileExists(watchdogScript) Then
    cmd = "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & watchdogScript & """"
    WshShell.Run cmd, 0, False
End If
