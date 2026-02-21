Set objShell = CreateObject("WScript.Shell")
Set objArgs = WScript.Arguments

If objArgs.Count < 1 Then
    WScript.Quit 1
End If

Dim exe, args, i
exe = objArgs(0)
args = ""
For i = 1 To objArgs.Count - 1
    If i > 1 Then args = args & " "
    args = args & objArgs(i)
Next

' 0 = 隐藏窗口, False = 不等待进程结束
objShell.Run Chr(34) & exe & Chr(34) & " " & args, 0, False
