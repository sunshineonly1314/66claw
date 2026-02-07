' ClawdbotCN Tray Launcher
' Launch tray app silently (no PowerShell window)

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
trayScript = scriptDir & "\ClawdbotTray.ps1"

' Check if tray script exists
If fso.FileExists(trayScript) Then
    ' Launch PowerShell tray app silently
    ' -WindowStyle Hidden hides window
    ' -ExecutionPolicy Bypass allows script execution
    cmd = "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & trayScript & """"
    WshShell.Run cmd, 0, False
End If
