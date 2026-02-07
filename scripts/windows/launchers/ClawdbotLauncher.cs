// ClawdbotCN Silent Launcher
// Compiled to .exe for Windows 11+ VBScript-free compatibility
// Compile: csc.exe /target:winexe /out:ClawdbotLauncher.exe ClawdbotLauncher.cs

using System;
using System.Diagnostics;
using System.IO;

class ClawdbotLauncher
{
    static int Main(string[] args)
    {
        try
        {
            string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
            string installDir = Path.GetDirectoryName(exePath);
            
            // Determine launch mode from args or exe name
            string mode = "open";  // default: open browser
            string[] passArgs = new string[0];
            
            if (args.Length > 0)
            {
                mode = args[0].ToLower().TrimStart('-');
                if (args.Length > 1)
                {
                    passArgs = new string[args.Length - 1];
                    Array.Copy(args, 1, passArgs, 0, args.Length - 1);
                }
            }
            
            switch (mode)
            {
                case "open":
                case "launch":
                    // Launch clawdbot.bat --open (default desktop shortcut action)
                    LaunchBat(installDir, "clawdbot.bat", "--open");
                    break;
                    
                case "tray":
                    // Launch tray application + watchdog
                    LaunchPowerShell(installDir, "ClawdbotTray.ps1");
                    LaunchPowerShell(installDir, "ClawdbotWatchdog.ps1");
                    break;
                    
                case "watchdog":
                    // Launch watchdog only
                    LaunchPowerShell(installDir, "ClawdbotWatchdog.ps1");
                    break;
                    
                case "gateway":
                    // Launch gateway
                    LaunchBat(installDir, "start-gateway.bat", "");
                    break;
                    
                case "setup":
                    // Launch setup wizard
                    LaunchBat(installDir, "clawdbot.bat", "--setup");
                    break;
                    
                case "cli":
                    // Launch CLI with arguments (visible window)
                    LaunchBatVisible(installDir, "clawdbot.bat", string.Join(" ", passArgs));
                    break;
                    
                default:
                    // Pass through to clawdbot.bat
                    LaunchBat(installDir, "clawdbot.bat", string.Join(" ", args));
                    break;
            }
            
            return 0;
        }
        catch (Exception ex)
        {
            // Log error silently
            try
            {
                string logDir = Path.Combine(
                    Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location),
                    "logs"
                );
                Directory.CreateDirectory(logDir);
                File.AppendAllText(
                    Path.Combine(logDir, "launcher-error.log"),
                    "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + ex.Message + "\n" + ex.StackTrace + "\n\n"
                );
            }
            catch { }
            return 1;
        }
    }
    
    static void LaunchBat(string workDir, string batFile, string arguments)
    {
        string batPath = Path.Combine(workDir, batFile);
        if (!File.Exists(batPath))
        {
            LogError("File not found: " + batPath);
            return;
        }
        
        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "cmd.exe";
        psi.Arguments = "/c \"" + batPath + "\" " + arguments;
        psi.WorkingDirectory = workDir;
        psi.WindowStyle = ProcessWindowStyle.Hidden;
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        
        Process.Start(psi);
    }
    
    static void LogError(string message)
    {
        try
        {
            string logDir = Path.Combine(
                Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location),
                "logs"
            );
            Directory.CreateDirectory(logDir);
            File.AppendAllText(
                Path.Combine(logDir, "launcher.log"),
                "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message + "\n"
            );
        }
        catch { }
    }
    
    static void LaunchBatVisible(string workDir, string batFile, string arguments)
    {
        string batPath = Path.Combine(workDir, batFile);
        if (!File.Exists(batPath))
        {
            LogError("File not found: " + batPath);
            return;
        }
        
        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "cmd.exe";
        psi.Arguments = "/c \"" + batPath + "\" " + arguments;
        psi.WorkingDirectory = workDir;
        psi.UseShellExecute = true;
        
        Process.Start(psi);
    }
    
    static void LaunchPowerShell(string workDir, string ps1File)
    {
        string ps1Path = Path.Combine(workDir, ps1File);
        if (!File.Exists(ps1Path))
        {
            LogError("PowerShell script not found: " + ps1Path);
            return;
        }
        
        LogError("Starting PowerShell: " + ps1Path);
        
        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "powershell.exe";
        psi.Arguments = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"" + ps1Path + "\"";
        psi.WorkingDirectory = workDir;
        psi.WindowStyle = ProcessWindowStyle.Hidden;
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        
        Process.Start(psi);
    }
}
