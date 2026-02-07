// ClawdbotCN Native Service Application
// Compile: csc.exe /target:winexe /out:ClawdbotService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll ClawdbotService.cs
// 
// Features:
// - System tray icon with context menu
// - Gateway process management (completely hidden, no console window)
// - Health check and auto-restart (Watchdog)
// - Single exe, no external dependencies
// - Uses .NET Framework 4.x (built into Windows)

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace ClawdbotCN
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            // Single instance check
            bool createdNew;
            using (var mutex = new Mutex(true, "ClawdbotCN_Service_Mutex", out createdNew))
            {
                if (!createdNew)
                {
                    // Already running, check if gateway is healthy before opening browser
                    if (IsGatewayHealthyQuick())
                    {
                        OpenBrowser("http://localhost:18789/");
                    }
                    else
                    {
                        // Gateway not running, show message
                        MessageBox.Show(
                            "ClawdbotCN \u5DF2\u5728\u8FD0\u884C\uFF0C\u4F46\u670D\u52A1\u672A\u54CD\u5E94\u3002\n\n" +
                            "\u8BF7\u68C0\u67E5\u7CFB\u7EDF\u6258\u76D8\u56FE\u6807\u72B6\u6001\u3002",  // ClawdbotCN 已在运行，但服务未响应。请检查系统托盘图标状态。
                            "ClawdbotCN AI",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning
                        );
                    }
                    return;
                }
                
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                
                var service = new ClawdbotService();
                
                // Handle command line args
                if (args.Length > 0)
                {
                    string cmd = args[0].ToLower().TrimStart('-', '/');
                    switch (cmd)
                    {
                        case "open":
                            service.QueueStartGatewayAndOpenBrowser();
                            break;
                        case "setup":
                            service.QueueStartGatewayAndOpenSetup();
                            break;
                        case "background":
                            // Just start gateway, no browser
                            break;
                    }
                }
                
                Application.Run();
            }
        }
        
        static bool IsGatewayHealthyQuick()
        {
            try
            {
                // Use 127.0.0.1 instead of localhost to avoid IPv6/DNS resolution issues on Windows
                var request = WebRequest.Create("http://127.0.0.1:18789/api/health") as HttpWebRequest;
                request.Timeout = 3000;
                request.Method = "GET";
                request.KeepAlive = false;  // Avoid stale connection reuse after gateway restart
                using (var response = request.GetResponse() as HttpWebResponse)
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch (WebException ex)
            {
                // If we got an HTTP response at all, the server is alive
                var httpResponse = ex.Response as HttpWebResponse;
                if (httpResponse != null)
                {
                    int statusCode = (int)httpResponse.StatusCode;
                    return statusCode >= 200 && statusCode < 500;
                }
                return false;
            }
            catch { return false; }
        }
        
        static void OpenBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch { }
        }
    }
    
    class ClawdbotService : IDisposable
    {
        private NotifyIcon trayIcon;
        private ContextMenuStrip contextMenu;
        private System.Windows.Forms.Timer healthTimer;
        private System.Windows.Forms.Timer watchdogTimer;
        private Process gatewayProcess;
        
        private string installDir;
        private string nodePath;
        private string entryPath;
        private string configDir;
        private string logDir;
        
        private int port = 18789;
        private string token = "clawdbot2026";
        
        private int restartCount = 0;
        private DateTime lastRestartTime = DateTime.MinValue;
        private bool isStarting = false;
        private int consecutiveUnhealthyCount = 0;
        
        // Thread-safe log writer
        private object logLock = new object();
        
        // Menu items
        private ToolStripMenuItem menuStatus;
        private ToolStripMenuItem menuOpen;
        private ToolStripMenuItem menuStart;
        private ToolStripMenuItem menuStop;
        private ToolStripMenuItem menuRestart;
        
        public ClawdbotService()
        {
            // Initialize paths
            installDir = Path.GetDirectoryName(Application.ExecutablePath);
            nodePath = Path.Combine(installDir, "node", "node.exe");
            entryPath = Path.Combine(installDir, "dist", "entry.js");
            // Use isolated config directory (%APPDATA%\ClawdbotCN) to avoid conflicts with open-source clawdbot
            configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ClawdbotCN");
            logDir = Path.Combine(installDir, "logs");
            
            Directory.CreateDirectory(logDir);
            Directory.CreateDirectory(configDir);
            
            // 清理旧日志
            CleanOldLogs();
            
            // 记录启动信息
            LogStartupInfo();
            
            // Create tray icon
            CreateTrayIcon();
            
            // Start health check timer (every 5 seconds)
            healthTimer = new System.Windows.Forms.Timer();
            healthTimer.Interval = 5000;
            healthTimer.Tick += HealthTimer_Tick;
            healthTimer.Start();
            
            // Start watchdog timer (every 15 seconds)
            watchdogTimer = new System.Windows.Forms.Timer();
            watchdogTimer.Interval = 15000;
            watchdogTimer.Tick += WatchdogTimer_Tick;
            watchdogTimer.Start();
            
            // Initial startup - always try to start gateway in background thread
            // The gateway might not be running even if IsGatewayRunning() returns false
            Thread bgThread = new Thread(() => {
                Thread.Sleep(500); // Brief wait for UI to initialize
                Log("Initial startup thread running...");
                if (!IsGatewayRunning())
                {
                    Log("Gateway not running, starting...");
                    StartGatewayInternal();
                }
                else
                {
                    Log("Gateway already running");
                }
                UpdateStatusSafe();
            });
            bgThread.IsBackground = true;
            bgThread.Start();
            
            UpdateStatus();
        }
        
        private void CreateTrayIcon()
        {
            contextMenu = new ContextMenuStrip();
            
            // 状态 (禁用，仅显示)
            menuStatus = new ToolStripMenuItem("\u72B6\u6001: \u68C0\u67E5\u4E2D...");  // 状态: 检查中...
            menuStatus.Enabled = false;
            contextMenu.Items.Add(menuStatus);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // 打开控制台 (粗体，主要操作)
            menuOpen = new ToolStripMenuItem("\u6253\u5F00\u63A7\u5236\u53F0");  // 打开控制台
            menuOpen.Font = new Font(menuOpen.Font, FontStyle.Bold);
            menuOpen.Click += (s, e) => { LogInfo("[User Action] Open Console"); OpenConsole(); };
            contextMenu.Items.Add(menuOpen);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // 启动服务
            menuStart = new ToolStripMenuItem("\u542F\u52A8\u670D\u52A1");  // 启动服务
            menuStart.Click += (s, e) => { LogInfo("[User Action] Start Service"); StartGateway(); };
            contextMenu.Items.Add(menuStart);
            
            // 停止服务
            menuStop = new ToolStripMenuItem("\u505C\u6B62\u670D\u52A1");  // 停止服务
            menuStop.Click += (s, e) => { LogInfo("[User Action] Stop Service"); StopGateway(); };
            contextMenu.Items.Add(menuStop);
            
            // 重启服务
            menuRestart = new ToolStripMenuItem("\u91CD\u542F\u670D\u52A1");  // 重启服务
            menuRestart.Click += (s, e) => { LogInfo("[User Action] Restart Service"); RestartGateway(); };
            contextMenu.Items.Add(menuRestart);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // 帮助子菜单
            var menuHelp = new ToolStripMenuItem("\u5E2E\u52A9");  // 帮助
            
            var menuLogs = new ToolStripMenuItem("\u67E5\u770B\u65E5\u5FD7");  // 查看日志
            menuLogs.Click += (s, e) => OpenLogs();
            menuHelp.DropDownItems.Add(menuLogs);
            
            var menuDiagnose = new ToolStripMenuItem("\u8BCA\u65AD\u95EE\u9898");  // 诊断问题
            menuDiagnose.Click += (s, e) => { LogInfo("[User Action] Run Diagnose"); RunDiagnose(); };
            menuHelp.DropDownItems.Add(menuDiagnose);
            
            contextMenu.Items.Add(menuHelp);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // 退出
            var menuExit = new ToolStripMenuItem("\u9000\u51FA");  // 退出
            menuExit.Click += (s, e) => { LogInfo("[User Action] Exit Application"); ExitApplication(); };
            contextMenu.Items.Add(menuExit);
            
            // 创建托盘图标
            trayIcon = new NotifyIcon();
            trayIcon.ContextMenuStrip = contextMenu;
            trayIcon.Text = "ClawdbotCN AI";
            trayIcon.DoubleClick += (s, e) => OpenConsole();
            
            // 加载图标
            string iconPath = Path.Combine(installDir, "clawdbot.ico");
            if (File.Exists(iconPath))
            {
                trayIcon.Icon = new Icon(iconPath);
            }
            else
            {
                trayIcon.Icon = SystemIcons.Application;
            }
            
            trayIcon.Visible = true;
            
            // 显示启动通知
            trayIcon.ShowBalloonTip(2000, "ClawdbotCN AI", "\u670D\u52A1\u5DF2\u542F\u52A8\uFF0C\u53CC\u51FB\u6253\u5F00\u63A7\u5236\u53F0", ToolTipIcon.Info);  // 服务已启动，双击打开控制台
        }
        
        private void HealthTimer_Tick(object sender, EventArgs e)
        {
            UpdateStatus();
            
            // 每小时报告
            LogHourlyReport();
        }
        
        private void WatchdogTimer_Tick(object sender, EventArgs e)
        {
            // Watchdog: auto-restart if gateway crashed
            bool isRunning = IsGatewayRunning();
            bool isHealthy = isRunning && IsGatewayHealthy();
            
            // Log detailed status periodically (every 5 minutes)
            if (DateTime.Now.Minute % 5 == 0 && DateTime.Now.Second < 15)
            {
                string memInfo = "N/A";
                string cpuTime = "N/A";
                if (gatewayProcess != null && !gatewayProcess.HasExited)
                {
                    try
                    {
                        gatewayProcess.Refresh();
                        memInfo = string.Format("{0:N0} MB", gatewayProcess.WorkingSet64 / 1024 / 1024);
                        cpuTime = gatewayProcess.TotalProcessorTime.ToString(@"hh\:mm\:ss");
                    }
                    catch { }
                }
                LogDebug(string.Format("Watchdog heartbeat: Running={0}, Healthy={1}, Memory={2}, CPU={3}, Restarts={4}", 
                    isRunning, isHealthy, memInfo, cpuTime, totalRestarts));
            }
            
            if (!isStarting && !isRunning)
            {
                hourlyErrors++;  // 统计错误
                
                // Try to get crash info
                string crashInfo = "";
                int exitCode = -1;
                if (gatewayProcess != null)
                {
                    try
                    {
                        if (gatewayProcess.HasExited)
                        {
                            exitCode = gatewayProcess.ExitCode;
                            crashInfo = string.Format(" (ExitCode: {0} [{1}], ExitTime: {2})", 
                                exitCode, GetExitCodeDescription(exitCode), 
                                gatewayProcess.ExitTime.ToString("HH:mm:ss"));
                        }
                    }
                    catch { }
                }
                
                LogWarn("Watchdog: Gateway not running, attempting restart..." + crashInfo);
                
                // Rate limit: max 5 restarts in 5 minutes
                if ((DateTime.Now - lastRestartTime).TotalMinutes > 5)
                {
                    restartCount = 0;
                }
                
                if (restartCount < 5)
                {
                    restartCount++;
                    totalRestarts++;  // 总重启计数
                    lastRestartTime = DateTime.Now;
                    
                    LogInfo(string.Format("Watchdog: Restart #{0} (total: {1})", restartCount, totalRestarts));
                    
                    // Clean up before restart
                    CleanupBeforeRestart();
                    
                    StartGateway();
                    
                    trayIcon.ShowBalloonTip(3000, "ClawdbotCN AI", 
                        string.Format("\u670D\u52A1\u5DF2\u81EA\u52A8\u91CD\u542F (#{0})", totalRestarts), ToolTipIcon.Warning);  // 服务已自动重启
                }
                else
                {
                    LogError("Watchdog: Too many restart attempts (5 in 5 min), pausing for 5 minutes...");
                    trayIcon.ShowBalloonTip(5000, "ClawdbotCN AI", 
                        "\u670D\u52A1\u53CD\u590D\u5D29\u6E83\uFF0C\u8BF7\u67E5\u770B logs \u6587\u4EF6\u5939", ToolTipIcon.Error);  // 服务反复崩溃，请查看 logs 文件夹
                }
            }
            else if (isRunning && !isHealthy)
            {
                // Gateway is running (port LISTENING) but health endpoint not responding.
                // Common causes: still starting up, event loop blocked, or localhost DNS issue.
                consecutiveUnhealthyCount++;
                
                if (consecutiveUnhealthyCount <= 2)
                {
                    // First few checks: likely still starting up, log at debug level
                    LogDebug(string.Format("Watchdog: Gateway running but health check failed (attempt {0}/8, may still be starting)", 
                        consecutiveUnhealthyCount));
                }
                else
                {
                    Log(string.Format("Watchdog: Gateway running but not healthy (attempt {0}/8)", consecutiveUnhealthyCount));
                }
                
                // Give it 8 checks before force restart (8 * 15s = 120s)
                // Gateway startup can take 30-60s on slow machines (license check, plugin init, etc.)
                if (consecutiveUnhealthyCount >= 8)
                {
                    LogWarn("Watchdog: Gateway unresponsive for 120+ seconds, force restarting...");
                    consecutiveUnhealthyCount = 0;
                    RestartGateway();
                    
                    trayIcon.ShowBalloonTip(3000, "ClawdbotCN AI", 
                        "\u670D\u52A1\u65E0\u54CD\u5E94\uFF0C\u5DF2\u5F3A\u5236\u91CD\u542F", ToolTipIcon.Warning);  // 服务无响应，已强制重启
                }
            }
            else
            {
                consecutiveUnhealthyCount = 0;
            }
        }
        
        private void CleanupBeforeRestart()
        {
            // Clean lock file
            string lockFile = Path.Combine(configDir, "gateway.lock");
            if (File.Exists(lockFile))
            {
                try 
                { 
                    File.Delete(lockFile);
                    Log("Cleaned up stale lock file");
                } 
                catch (Exception ex)
                {
                    Log("Failed to delete lock file: " + ex.Message);
                }
            }
            
            // Kill any orphan processes on port
            KillProcessOnPort(port);
        }
        
        private void UpdateStatus()
        {
            bool running = IsGatewayRunning();
            bool healthy = running && IsGatewayHealthy();
            
            if (healthy)
            {
                menuStatus.Text = "\u72B6\u6001: \u8FD0\u884C\u4E2D";  // 状态: 运行中
                trayIcon.Text = "ClawdbotCN AI - \u8FD0\u884C\u4E2D";  // 运行中
                menuStart.Enabled = false;
                menuStop.Enabled = true;
                menuRestart.Enabled = true;
                menuOpen.Enabled = true;
            }
            else if (running)
            {
                menuStatus.Text = "\u72B6\u6001: \u542F\u52A8\u4E2D...";  // 状态: 启动中...
                trayIcon.Text = "ClawdbotCN AI - \u542F\u52A8\u4E2D...";  // 启动中...
                menuStart.Enabled = false;
                menuStop.Enabled = true;
                menuRestart.Enabled = true;
                menuOpen.Enabled = false;
            }
            else
            {
                menuStatus.Text = "\u72B6\u6001: \u5DF2\u505C\u6B62";  // 状态: 已停止
                trayIcon.Text = "ClawdbotCN AI - \u5DF2\u505C\u6B62";  // 已停止
                menuStart.Enabled = true;
                menuStop.Enabled = false;
                menuRestart.Enabled = false;
                menuOpen.Enabled = false;
            }
        }
        
        private bool IsGatewayRunning()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "netstat",
                    Arguments = "-ano",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };
                
                using (var process = Process.Start(psi))
                {
                    string output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit();
                    
                    // Check each line for BOTH port AND LISTENING on the SAME line
                    string portPattern = ":" + port;
                    foreach (string line in output.Split('\n'))
                    {
                        if (line.Contains(portPattern) && line.Contains("LISTENING"))
                        {
                            return true;
                        }
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }
        
        private bool IsGatewayHealthy()
        {
            try
            {
                // Use 127.0.0.1 instead of localhost to avoid IPv6/DNS resolution delays on Windows.
                // Some Windows machines resolve "localhost" to ::1 (IPv6) first, which can timeout
                // when IPv6 loopback is blocked by firewall or misconfigured.
                var request = WebRequest.Create("http://127.0.0.1:" + port + "/api/health") as HttpWebRequest;
                request.Timeout = 5000;
                request.Method = "GET";
                request.KeepAlive = false;  // Prevent stale connection reuse after gateway restart
                
                using (var response = request.GetResponse() as HttpWebResponse)
                {
                    int statusCode = (int)response.StatusCode;
                    return statusCode >= 200 && statusCode < 400;
                }
            }
            catch (WebException ex)
            {
                // .NET throws WebException for non-2xx status codes.
                // Check if we got an actual HTTP response (server is alive but returned error).
                var httpResponse = ex.Response as HttpWebResponse;
                if (httpResponse != null)
                {
                    int statusCode = (int)httpResponse.StatusCode;
                    // 3xx redirects and 401/403 mean the server IS alive and responding
                    if (statusCode >= 300 && statusCode < 500)
                    {
                        return true;
                    }
                }
                return false;
            }
            catch
            {
                return false;
            }
        }
        
        // Public method for UI (runs in background)
        public void StartGateway()
        {
            ThreadPool.QueueUserWorkItem(state => {
                StartGatewayInternal();
                UpdateStatusSafe();
            });
        }
        
        // Internal method (can be called from any thread)
        private void StartGatewayInternal()
        {
            if (isStarting) return;
            isStarting = true;
            
            LogInfo("Starting Gateway...");
            LogDebug("Node path: " + nodePath);
            LogDebug("Entry path: " + entryPath);
            LogDebug("Port: " + port);
            
            try
            {
                // Check if Node.js exists
                if (!File.Exists(nodePath))
                {
                    LogError("Node.js not found at: " + nodePath);
                    hourlyErrors++;
                    ShowBalloonSafe("ClawdbotCN AI", 
                        "Node.js \u672A\u627E\u5230\uFF01\u8BF7\u91CD\u65B0\u5B89\u88C5", ToolTipIcon.Error, 5000);  // Node.js 未找到！请重新安装
                    return;
                }
                
                // Check if entry.js exists
                if (!File.Exists(entryPath))
                {
                    LogError("entry.js not found at: " + entryPath);
                    hourlyErrors++;
                    ShowBalloonSafe("ClawdbotCN AI", 
                        "\u5E94\u7528\u6587\u4EF6\u7F3A\u5931\uFF01\u8BF7\u91CD\u65B0\u5B89\u88C5", ToolTipIcon.Error, 5000);  // 应用文件缺失！请重新安装
                    return;
                }
                
                // Clean up stale lock file
                string lockFile = Path.Combine(configDir, "gateway.lock");
                if (File.Exists(lockFile))
                {
                    try
                    {
                        File.Delete(lockFile);
                        LogDebug("Removed stale lock file");
                    }
                    catch (Exception ex)
                    {
                        LogWarn("Could not delete lock file: " + ex.Message);
                    }
                }
                
                // Kill any existing process on port
                KillProcessOnPort(port);
                Thread.Sleep(1000);
                
                // Ensure config file exists
                EnsureConfig();
                
                // Auto-fix config issues (e.g., missing plugins from previous installs)
                RunDoctorFix(nodePath, entryPath);
                
                // Start Gateway process (completely hidden)
                var psi = new ProcessStartInfo
                {
                    FileName = nodePath,
                    Arguments = "\"" + entryPath + "\" gateway run --port " + port + " --allow-unconfigured",
                    WorkingDirectory = installDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,  // KEY: No console window!
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                
                // Set environment variables
                // Use isolated config directory to avoid conflicts with open-source clawdbot
                string clawdbotCNConfigDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "ClawdbotCN"
                );
                
                // 迁移旧版配置目录的设备ID（如果存在）
                // 这解决了用户在命令行版和安装版之间切换导致设备ID不一致的问题
                MigrateDeviceIdIfNeeded(clawdbotCNConfigDir);
                
                psi.EnvironmentVariables["CLAWDBOT_STATE_DIR"] = clawdbotCNConfigDir;
                psi.EnvironmentVariables["CLAWDBOT_BUNDLED_PLUGINS_DIR"] = Path.Combine(installDir, "extensions");
                psi.EnvironmentVariables["CLAWDBOT_BUNDLED_SKILLS_DIR"] = Path.Combine(installDir, "skills");
                psi.EnvironmentVariables["CLAWDBOT_GATEWAY_TOKEN"] = token;
                psi.EnvironmentVariables["CLAWDBOT_REGION"] = "cn";
                // Ensure system PATH is available
                psi.EnvironmentVariables["PATH"] = Environment.GetEnvironmentVariable("PATH") + ";" + 
                    Path.Combine(installDir, "node");
                
                gatewayProcess = Process.Start(psi);
                
                // Handle process exit with detailed logging
                gatewayProcess.EnableRaisingEvents = true;
                gatewayProcess.Exited += (s, e) => {
                    int exitCode = -1;
                    DateTime exitTime = DateTime.Now;
                    long memoryMB = 0;
                    TimeSpan runtime = TimeSpan.Zero;
                    
                    try
                    {
                        exitCode = gatewayProcess.ExitCode;
                        exitTime = gatewayProcess.ExitTime;
                        runtime = exitTime - gatewayProcess.StartTime;
                    }
                    catch { }
                    
                    string exitReason = GetExitCodeDescription(exitCode);
                    hourlyErrors++;
                    LogError(string.Format("Gateway CRASHED: ExitCode={0} ({1}), Runtime={2:hh\\:mm\\:ss}", 
                        exitCode, exitReason, runtime));
                    
                    // Log last few lines of gateway output for debugging
                    try
                    {
                        string outputLog = Path.Combine(logDir, "gateway-output.log");
                        if (File.Exists(outputLog))
                        {
                            string[] lines = File.ReadAllLines(outputLog);
                            int startLine = Math.Max(0, lines.Length - 10);
                            LogInfo("Last gateway output before crash:");
                            for (int i = startLine; i < lines.Length; i++)
                            {
                                LogInfo("  > " + lines[i]);
                            }
                        }
                    }
                    catch { }
                    
                    UpdateStatusSafe();
                };
                
                // Redirect output to log file
                string outputLogFile = Path.Combine(logDir, "gateway-output.log");
                gatewayProcess.OutputDataReceived += (s, e) => {
                    if (e.Data != null) AppendLog(outputLogFile, e.Data);
                };
                gatewayProcess.ErrorDataReceived += (s, e) => {
                    if (e.Data != null) AppendLog(outputLogFile, "[ERR] " + e.Data);
                };
                gatewayProcess.BeginOutputReadLine();
                gatewayProcess.BeginErrorReadLine();
                
                LogInfo("Gateway process started (PID: " + gatewayProcess.Id + ")");
                
                // Wait for startup (non-blocking for this thread, but blocks caller)
                // Gateway may take up to 30-60s on first launch (license check, plugin init, etc.)
                // Don't worry if this times out - the watchdog will continue monitoring
                for (int i = 0; i < 60; i++)
                {
                    Thread.Sleep(1000);
                    
                    // Check if process already exited (real crash)
                    if (gatewayProcess.HasExited)
                    {
                        LogError("Gateway process exited during startup (ExitCode: " + gatewayProcess.ExitCode + ")");
                        break;
                    }
                    
                    if (IsGatewayHealthy())
                    {
                        LogInfo("Gateway is healthy after " + (i + 1) + " seconds");
                        consecutiveUnhealthyCount = 0;  // Reset watchdog counter on successful startup
                        break;
                    }
                    if (i == 59)
                    {
                        LogWarn("Gateway startup timeout (60 seconds) - watchdog will continue monitoring");
                    }
                }
            }
            catch (Exception ex)
            {
                LogError("Failed to start Gateway: " + ex.Message);
                hourlyErrors++;
                ShowBalloonSafe("ClawdbotCN AI", 
                    "\u542F\u52A8\u5931\u8D25: " + ex.Message, ToolTipIcon.Error, 5000);  // 启动失败:
            }
            finally
            {
                isStarting = false;
            }
        }
        
        public void StopGateway()
        {
            ThreadPool.QueueUserWorkItem(state => {
                StopGatewayInternal();
                UpdateStatusSafe();
            });
        }
        
        private void StopGatewayInternal()
        {
            LogInfo("Stopping Gateway...");
            
            try
            {
                if (gatewayProcess != null && !gatewayProcess.HasExited)
                {
                    int pid = gatewayProcess.Id;
                    gatewayProcess.Kill();
                    bool exited = gatewayProcess.WaitForExit(5000);
                    if (exited)
                    {
                        LogInfo("Gateway process " + pid + " stopped gracefully");
                    }
                    else
                    {
                        LogWarn("Gateway process " + pid + " did not exit within 5 seconds");
                    }
                }
            }
            catch (Exception ex)
            {
                LogWarn("Error stopping Gateway: " + ex.Message);
            }
            
            KillProcessOnPort(port);
            
            // Clean lock file
            string lockFile = Path.Combine(configDir, "gateway.lock");
            if (File.Exists(lockFile))
            {
                try { File.Delete(lockFile); } catch { }
            }
            
            LogInfo("Gateway stopped");
        }
        
        public void RestartGateway()
        {
            ThreadPool.QueueUserWorkItem(state => {
                StopGatewayInternal();
                Thread.Sleep(2000);
                StartGatewayInternal();
                UpdateStatusSafe();
            });
        }
        
        private void KillProcessOnPort(int targetPort)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "netstat",
                    Arguments = "-ano",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };
                
                using (var process = Process.Start(psi))
                {
                    string output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit();
                    
                    foreach (string line in output.Split('\n'))
                    {
                        if (line.Contains(":" + targetPort) && line.Contains("LISTENING"))
                        {
                            string[] parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            if (parts.Length > 4)
                            {
                                int pid;
                                if (int.TryParse(parts[parts.Length - 1], out pid))
                                {
                                    try
                                    {
                                        Process.GetProcessById(pid).Kill();
                                        Log("Killed process " + pid + " on port " + targetPort);
                                    }
                                    catch { }
                                }
                            }
                        }
                    }
                }
            }
            catch { }
        }
        
        private void EnsureConfig()
        {
            string configFile = Path.Combine(configDir, "clawdbot.json");
            if (!File.Exists(configFile))
            {
                string config = "{\n  \"gateway\": {\n    \"mode\": \"local\",\n    \"bind\": \"loopback\",\n    \"port\": 18789\n  }\n}";
                File.WriteAllText(configFile, config);
                Log("Created default config file");
            }
        }
        
        // Auto-fix config issues (missing plugins, invalid settings, etc.)
        private void RunDoctorFix(string nodePath, string entryPath)
        {
            try
            {
                LogDebug("Running doctor --fix to clean up config...");
                var psi = new ProcessStartInfo
                {
                    FileName = nodePath,
                    Arguments = "\"" + entryPath + "\" doctor --fix",
                    WorkingDirectory = installDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                
                // Use isolated config directory
                string clawdbotCNConfigDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "ClawdbotCN"
                );
                
                // 迁移旧版配置目录的设备ID（如果存在）
                MigrateDeviceIdIfNeeded(clawdbotCNConfigDir);
                
                psi.EnvironmentVariables["CLAWDBOT_STATE_DIR"] = clawdbotCNConfigDir;
                psi.EnvironmentVariables["CLAWDBOT_BUNDLED_PLUGINS_DIR"] = Path.Combine(installDir, "extensions");
                psi.EnvironmentVariables["CLAWDBOT_REGION"] = "cn";
                
                var process = Process.Start(psi);
                if (process != null)
                {
                    // Wait max 10 seconds for doctor to complete
                    bool completed = process.WaitForExit(10000);
                    if (completed && process.ExitCode == 0)
                    {
                        LogDebug("Doctor --fix completed successfully");
                    }
                    else if (!completed)
                    {
                        LogWarn("Doctor --fix timed out, killing...");
                        try { process.Kill(); } catch { }
                    }
                    else
                    {
                        LogDebug("Doctor --fix exited with code: " + process.ExitCode);
                    }
                }
            }
            catch (Exception ex)
            {
                LogWarn("Doctor --fix failed: " + ex.Message);
            }
        }
        
        // Queue methods for background execution (avoids blocking UI thread)
        public void QueueStartGatewayAndOpenBrowser()
        {
            ThreadPool.QueueUserWorkItem(state => StartGatewayAndOpenBrowserAsync());
        }
        
        public void QueueStartGatewayAndOpenSetup()
        {
            ThreadPool.QueueUserWorkItem(state => StartGatewayAndOpenSetupAsync());
        }
        
        private void StartGatewayAndOpenBrowserAsync()
        {
            // 立即打开加载页面，让用户知道程序在运行
            // Open loading page immediately so user knows something is happening
            OpenLoadingPage();
            
            bool wasRunning = IsGatewayRunning();
            
            if (!wasRunning)
            {
                StartGatewayInternal();
            }
            
            // 后台继续监控，不阻塞
            // Loading page will poll and redirect when ready
            Log("Loading page opened, Gateway starting in background");
            
            // Update UI on main thread
            UpdateStatusSafe();
        }
        
        // 打开加载页面
        private void OpenLoadingPage()
        {
            // 检查安装标识
            string installMarker = Path.Combine(installDir, "install.json");
            bool isFirstLaunch = false;
            bool hasHistoryConfig = false;
            
            if (File.Exists(installMarker))
            {
                try
                {
                    string markerContent = File.ReadAllText(installMarker);
                    isFirstLaunch = markerContent.Contains("\"firstLaunch\":true") 
                                 || markerContent.Contains("\"firstLaunch\": true");
                }
                catch { }
            }
            
            // 检查用户配置
            string configFile = Path.Combine(configDir, "clawdbot.json");
            if (File.Exists(configFile))
            {
                try
                {
                    string content = File.ReadAllText(configFile);
                    hasHistoryConfig = content.Contains("\"apiKey\"") 
                        || content.Contains("\"auth\":")
                        || content.Contains("\"profiles\":");
                }
                catch { }
            }
            
            // 如果是首次启动，标记完成
            if (isFirstLaunch)
            {
                MarkFirstLaunchComplete();
            }
            
            // 打开本地加载页面
            string loadingPage = Path.Combine(installDir, "assets", "loading.html");
            if (File.Exists(loadingPage))
            {
                string url = "file:///" + loadingPage.Replace("\\", "/") 
                    + "?port=" + port 
                    + "&token=" + token
                    + (isFirstLaunch && hasHistoryConfig ? "&hasHistory=1" : "");
                Log("Opening loading page: " + url);
                OpenUrl(url);
            }
            else
            {
                // 如果加载页面不存在，fallback 到直接打开（旧行为）
                Log("Loading page not found, falling back to direct open");
                OpenConsoleDirect();
            }
        }
        
        // 直接打开控制台（不等待）
        private void OpenConsoleDirect()
        {
            string configFile = Path.Combine(configDir, "clawdbot.json");
            bool setupComplete = false;
            
            if (File.Exists(configFile))
            {
                try
                {
                    string content = File.ReadAllText(configFile);
                    setupComplete = content.Contains("\"apiKey\"") 
                        || content.Contains("\"auth\":")
                        || content.Contains("\"profiles\":");
                }
                catch { }
            }
            
            if (setupComplete)
            {
                OpenUrl("http://localhost:" + port + "/?token=" + token);
            }
            else
            {
                OpenUrl("http://localhost:" + port + "/setup?token=" + token);
            }
        }
        
        private void StartGatewayAndOpenSetupAsync()
        {
            if (!IsGatewayRunning())
            {
                StartGatewayInternal();
            }
            
            // Wait for gateway to be healthy (max 30 seconds)
            for (int i = 0; i < 30; i++)
            {
                if (IsGatewayHealthy()) break;
                Thread.Sleep(1000);
            }
            
            OpenUrl("http://localhost:" + port + "/setup");
            UpdateStatusSafe();
        }
        
        // Thread-safe UI helpers
        private void ShowBalloonSafe(string title, string text, ToolTipIcon icon, int timeout)
        {
            if (trayIcon.ContextMenuStrip != null && trayIcon.ContextMenuStrip.InvokeRequired)
            {
                trayIcon.ContextMenuStrip.BeginInvoke(new Action(() => {
                    trayIcon.ShowBalloonTip(timeout, title, text, icon);
                }));
            }
            else
            {
                trayIcon.ShowBalloonTip(timeout, title, text, icon);
            }
        }
        
        private void UpdateStatusSafe()
        {
            if (contextMenu != null && contextMenu.InvokeRequired)
            {
                contextMenu.BeginInvoke(new Action(() => UpdateStatus()));
            }
            else
            {
                UpdateStatus();
            }
        }
        
        private void OpenConsole()
        {
            // 检查安装标识和用户配置，决定跳转逻辑
            // Check install marker and user config to determine navigation
            
            string installMarker = Path.Combine(installDir, "install.json");
            string configFile = Path.Combine(configDir, "clawdbot.json");
            
            bool isFirstLaunch = false;      // 本次安装后首次启动
            bool hasHistoryConfig = false;   // 用户有历史配置
            
            // 1. 检查安装标识
            if (File.Exists(installMarker))
            {
                try
                {
                    string markerContent = File.ReadAllText(installMarker);
                    isFirstLaunch = markerContent.Contains("\"firstLaunch\":true") 
                                 || markerContent.Contains("\"firstLaunch\": true");
                }
                catch { }
            }
            
            // 2. 检查用户是否有历史配置
            if (File.Exists(configFile))
            {
                try
                {
                    string content = File.ReadAllText(configFile);
                    // Check for various signs of completed setup:
                    hasHistoryConfig = content.Contains("\"apiKey\"") 
                        || content.Contains("\"baseUrl\"")
                        || content.Contains("\"auth\":")           // Auth section configured
                        || content.Contains("\"profiles\":")       // Profile configured
                        || content.Contains("\"moonshot\"")
                        || content.Contains("\"zhipu\"")
                        || content.Contains("\"deepseek\"")
                        || content.Contains("\"qwen\"")
                        || content.Contains("\"aliyun-bailian\"")  // Alibaba Cloud
                        || content.Contains("\"baidu\"")           // Baidu
                        || content.Contains("\"minimax\"")         // Minimax
                        || content.Contains("\"openai\"")
                        || content.Contains("\"anthropic\"")
                        || content.Contains("\"azure\"")           // Azure OpenAI
                        || content.Contains("\"google\"")          // Google AI
                        || content.Contains("\"ollama\"")          // Ollama local
                        || (content.Contains("\"models\"") && content.Contains("\"name\""));
                }
                catch { }
            }
            
            Log("OpenConsole: isFirstLaunch=" + isFirstLaunch + ", hasHistoryConfig=" + hasHistoryConfig);
            
            // 3. 决定跳转逻辑
            if (isFirstLaunch)
            {
                // 本次安装后首次启动
                // 更新安装标识，标记已启动过
                MarkFirstLaunchComplete();
                
                if (hasHistoryConfig)
                {
                    // 有历史配置 → 跳转到 setup 并传递参数，让前端显示"检测到历史配置"
                    OpenUrl("http://localhost:" + port + "/setup?hasHistory=1&token=" + token);
                }
                else
                {
                    // 无历史配置 → 正常 setup 流程
                    OpenUrl("http://localhost:" + port + "/setup?token=" + token);
                }
            }
            else
            {
                // 非首次启动
                if (hasHistoryConfig)
                {
                    // 有配置 → 直接进入 chat
                    OpenUrl("http://localhost:" + port + "/?token=" + token);
                }
                else
                {
                    // 无配置（可能用户手动删除了配置） → 跳转 setup
                    OpenUrl("http://localhost:" + port + "/setup?token=" + token);
                }
            }
        }
        
        // 标记首次启动已完成
        private void MarkFirstLaunchComplete()
        {
            try
            {
                string installMarker = Path.Combine(installDir, "install.json");
                if (File.Exists(installMarker))
                {
                    string content = File.ReadAllText(installMarker);
                    // 将 firstLaunch 改为 false
                    content = content.Replace("\"firstLaunch\":true", "\"firstLaunch\":false");
                    content = content.Replace("\"firstLaunch\": true", "\"firstLaunch\": false");
                    
                    // 添加首次启动时间
                    if (!content.Contains("\"firstLaunchTime\""))
                    {
                        content = content.Replace("}", ",\n  \"firstLaunchTime\": \"" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\"\n}");
                    }
                    
                    File.WriteAllText(installMarker, content);
                    Log("Marked first launch complete");
                }
            }
            catch (Exception ex)
            {
                LogWarn("Failed to mark first launch complete: " + ex.Message);
            }
        }
        
        private void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Log("Failed to open browser: " + ex.Message);
            }
        }
        
        private void OpenLogs()
        {
            try
            {
                Process.Start("explorer.exe", logDir);
            }
            catch { }
        }
        
        private void RunDiagnose()
        {
            // Note: Diagnose intentionally shows a window so user can see the output
            // This is triggered only when user clicks "Diagnose" menu item
            string diagFile = Path.Combine(installDir, "diagnose.bat");
            if (File.Exists(diagFile))
            {
                Process.Start(new ProcessStartInfo(diagFile) { UseShellExecute = true });
            }
        }
        
        private void ExitApplication()
        {
            LogInfo("========================================");
            LogInfo("ClawdbotCN Service Shutting Down");
            LogInfo("========================================");
            LogInfo("Total Restarts This Session: " + totalRestarts);
            LogInfo("Total Errors This Hour: " + hourlyErrors);
            
            healthTimer.Stop();
            watchdogTimer.Stop();
            
            trayIcon.Visible = false;
            trayIcon.Dispose();
            
            LogInfo("Shutdown complete");
            Application.Exit();
        }
        
        // ==================== 日志系统 ====================
        // 日志级别：DEBUG < INFO < WARN < ERROR
        private const int LOG_DEBUG = 0;
        private const int LOG_INFO = 1;
        private const int LOG_WARN = 2;
        private const int LOG_ERROR = 3;
        
        private int logLevel = LOG_INFO;  // 默认 INFO 级别
        private const long MAX_LOG_SIZE = 5 * 1024 * 1024;  // 5MB 单文件上限
        private const int MAX_LOG_FILES = 5;  // 保留最近 5 个日志文件
        
        // 简化日志方法
        private void Log(string message) { LogInfo(message); }
        
        private void LogDebug(string message)
        {
            if (logLevel <= LOG_DEBUG)
                WriteLog("DEBUG", message);
        }
        
        private void LogInfo(string message)
        {
            if (logLevel <= LOG_INFO)
                WriteLog("INFO", message);
        }
        
        private void LogWarn(string message)
        {
            if (logLevel <= LOG_WARN)
                WriteLog("WARN", message);
        }
        
        private void LogError(string message)
        {
            WriteLog("ERROR", message);
            // 错误同时写入 error.log
            WriteToFile(Path.Combine(logDir, "error.log"), "ERROR", message);
        }
        
        private void WriteLog(string level, string message)
        {
            WriteToFile(Path.Combine(logDir, "service.log"), level, message);
        }
        
        private void WriteToFile(string logFile, string level, string message)
        {
            lock (logLock)
            {
                try
                {
                    // 格式: [2026-02-02 15:30:45] [INFO] Message
                    string line = string.Format("[{0}] [{1}] {2}\r\n", 
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), level, message);
                    File.AppendAllText(logFile, line);
                    
                    // 日志轮转检查
                    RotateLogIfNeeded(logFile);
                }
                catch { }
            }
        }
        
        private void AppendLog(string logFile, string message)
        {
            lock (logLock)
            {
                try
                {
                    string line = "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message + "\r\n";
                    File.AppendAllText(logFile, line);
                    RotateLogIfNeeded(logFile);
                }
                catch { }
            }
        }
        
        // 日志轮转：超过大小则重命名为 .1, .2, ...
        private void RotateLogIfNeeded(string logFile)
        {
            try
            {
                var fi = new FileInfo(logFile);
                if (!fi.Exists || fi.Length < MAX_LOG_SIZE) return;
                
                // 删除最旧的日志
                string oldestLog = logFile + "." + MAX_LOG_FILES;
                if (File.Exists(oldestLog)) File.Delete(oldestLog);
                
                // 依次重命名 .4 -> .5, .3 -> .4, ...
                for (int i = MAX_LOG_FILES - 1; i >= 1; i--)
                {
                    string src = logFile + "." + i;
                    string dst = logFile + "." + (i + 1);
                    if (File.Exists(src))
                    {
                        if (File.Exists(dst)) File.Delete(dst);
                        File.Move(src, dst);
                    }
                }
                
                // 当前日志 -> .1
                string firstBackup = logFile + ".1";
                if (File.Exists(firstBackup)) File.Delete(firstBackup);
                File.Move(logFile, firstBackup);
                
                // 创建新日志文件
                File.WriteAllText(logFile, string.Format(
                    "[{0}] [INFO] === Log rotated (previous: {1}) ===\r\n",
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), firstBackup));
            }
            catch { }
        }
        
        // ==================== 运维日志 ====================
        
        // 启动时记录系统信息
        private void LogStartupInfo()
        {
            LogInfo("========================================");
            LogInfo("ClawdbotCN Service Starting");
            LogInfo("========================================");
            LogInfo("Version: " + GetVersion());
            LogInfo("Install Dir: " + installDir);
            LogInfo("Config Dir: " + configDir);
            LogInfo("OS: " + Environment.OSVersion.ToString());
            LogInfo("CLR: " + Environment.Version.ToString());
            LogInfo("Machine: " + Environment.MachineName);
            LogInfo("User: " + Environment.UserName);
            LogInfo("Processors: " + Environment.ProcessorCount);
            LogInfo("64-bit OS: " + Environment.Is64BitOperatingSystem);
            LogInfo("64-bit Process: " + Environment.Is64BitProcess);
            
            // 内存信息
            try
            {
                long totalMem = GC.GetTotalMemory(false) / 1024 / 1024;
                LogInfo("Initial Memory: " + totalMem + " MB");
            }
            catch { }
            
            LogInfo("----------------------------------------");
        }
        
        private string GetVersion()
        {
            try
            {
                string pkgFile = Path.Combine(installDir, "package.json");
                if (File.Exists(pkgFile))
                {
                    string content = File.ReadAllText(pkgFile);
                    int idx = content.IndexOf("\"version\"");
                    if (idx >= 0)
                    {
                        int start = content.IndexOf("\"", idx + 10) + 1;
                        int end = content.IndexOf("\"", start);
                        return content.Substring(start, end - start);
                    }
                }
            }
            catch { }
            return "unknown";
        }
        
        // 定期状态报告（每小时）
        private DateTime lastHourlyReport = DateTime.MinValue;
        private int totalRestarts = 0;
        private int hourlyErrors = 0;
        
        private void LogHourlyReport()
        {
            if ((DateTime.Now - lastHourlyReport).TotalHours < 1) return;
            lastHourlyReport = DateTime.Now;
            
            string memInfo = "N/A";
            string uptime = "N/A";
            
            if (gatewayProcess != null && !gatewayProcess.HasExited)
            {
                try
                {
                    gatewayProcess.Refresh();
                    memInfo = string.Format("{0:N0} MB", gatewayProcess.WorkingSet64 / 1024 / 1024);
                    uptime = (DateTime.Now - gatewayProcess.StartTime).ToString(@"d\.hh\:mm\:ss");
                }
                catch { }
            }
            
            LogInfo("=== Hourly Status Report ===");
            LogInfo("Gateway Status: " + (IsGatewayRunning() ? "Running" : "Stopped"));
            LogInfo("Gateway Memory: " + memInfo);
            LogInfo("Gateway Uptime: " + uptime);
            LogInfo("Total Restarts: " + totalRestarts);
            LogInfo("Errors This Hour: " + hourlyErrors);
            LogInfo("Service Memory: " + (GC.GetTotalMemory(false) / 1024 / 1024) + " MB");
            LogInfo("============================");
            
            hourlyErrors = 0;  // 重置小时错误计数
        }
        
        /// <summary>
        /// 同步配置目录间的设备ID，确保一致性
        /// 
        /// 问题背景：
        /// - ClawdbotCN 安装版使用 %APPDATA%\ClawdbotCN 作为配置目录
        /// - 命令行/开发版使用 ~/.clawdbot 作为配置目录
        /// - 如果用户在两种模式间切换，会生成不同的设备ID，导致触发设备切换流程
        /// 
        /// 解决方案：
        /// 1. 如果当前目录已有设备ID，以当前目录为准（因为这是用户当前使用的）
        /// 2. 如果当前目录没有但旧版目录有，则迁移过来
        /// 3. 同步到所有目录，保持一致
        /// </summary>
        private void MigrateDeviceIdIfNeeded(string currentConfigDir)
        {
            try
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string legacyConfigDir = Path.Combine(userProfile, ".clawdbot");
                string legacyDeviceIdFile = Path.Combine(legacyConfigDir, ".device_id");
                string currentDeviceIdFile = Path.Combine(currentConfigDir, ".device_id");
                
                string deviceIdToUse = null;
                
                // 1. 优先使用当前目录的设备ID（如果存在）
                if (File.Exists(currentDeviceIdFile))
                {
                    string currentId = File.ReadAllText(currentDeviceIdFile).Trim();
                    if (!string.IsNullOrEmpty(currentId) && currentId.Length >= 16)
                    {
                        deviceIdToUse = currentId;
                        LogDebug("Using existing device ID from current config");
                    }
                }
                
                // 2. 如果当前目录没有，尝试从旧版目录迁移
                if (deviceIdToUse == null && File.Exists(legacyDeviceIdFile))
                {
                    string legacyId = File.ReadAllText(legacyDeviceIdFile).Trim();
                    if (!string.IsNullOrEmpty(legacyId) && legacyId.Length >= 16)
                    {
                        deviceIdToUse = legacyId;
                        
                        // 确保当前目录存在
                        if (!Directory.Exists(currentConfigDir))
                        {
                            Directory.CreateDirectory(currentConfigDir);
                        }
                        
                        // 复制到当前目录
                        File.WriteAllText(currentDeviceIdFile, deviceIdToUse);
                        Log("Migrated device ID from legacy config (~/.clawdbot)");
                    }
                }
                
                // 3. 双向同步：确保两个目录的设备ID一致
                if (deviceIdToUse != null)
                {
                    // 同步到旧版目录
                    if (File.Exists(legacyDeviceIdFile))
                    {
                        string legacyId = File.ReadAllText(legacyDeviceIdFile).Trim();
                        if (legacyId != deviceIdToUse)
                        {
                            File.WriteAllText(legacyDeviceIdFile, deviceIdToUse);
                            Log("Synced device ID to legacy config (~/.clawdbot)");
                        }
                    }
                    else if (Directory.Exists(legacyConfigDir))
                    {
                        // 旧版目录存在但没有设备ID文件，创建一个
                        File.WriteAllText(legacyDeviceIdFile, deviceIdToUse);
                        LogDebug("Created device ID in legacy config for consistency");
                    }
                }
            }
            catch (Exception ex)
            {
                LogDebug("Device ID sync skipped: " + ex.Message);
            }
        }
        
        // 清理旧日志（保留最近 7 天）
        private void CleanOldLogs()
        {
            try
            {
                string[] logFiles = Directory.GetFiles(logDir, "*.log*");
                DateTime cutoff = DateTime.Now.AddDays(-7);
                
                foreach (string file in logFiles)
                {
                    FileInfo fi = new FileInfo(file);
                    if (fi.LastWriteTime < cutoff)
                    {
                        File.Delete(file);
                        LogDebug("Cleaned old log: " + fi.Name);
                    }
                }
            }
            catch { }
        }
        
        private string GetExitCodeDescription(int exitCode)
        {
            switch (exitCode)
            {
                case 0: return "Normal exit";
                case 1: return "General error";
                case 2: return "Misuse of command";
                case 126: return "Command not executable";
                case 127: return "Command not found";
                case 128: return "Invalid exit argument";
                case 130: return "Ctrl+C (SIGINT)";
                case 137: return "SIGKILL (Out of memory?)";
                case 139: return "Segmentation fault";
                case 143: return "SIGTERM";
                case -1: return "Unknown";
                case -1073741819: return "Access Violation (0xC0000005)";
                case -1073741571: return "Stack Overflow (0xC00000FD)";
                case -1073740791: return "Heap Corruption (0xC0000374)";
                case -1073740940: return "Status No Memory (0xC0000017)";
                default:
                    if (exitCode > 128 && exitCode < 256)
                        return "Signal " + (exitCode - 128);
                    return "Unknown (" + exitCode + ")";
            }
        }
        
        public void Dispose()
        {
            if (healthTimer != null) healthTimer.Dispose();
            if (watchdogTimer != null) watchdogTimer.Dispose();
            if (trayIcon != null) trayIcon.Dispose();
        }
    }
}
