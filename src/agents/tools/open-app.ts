import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

const OpenAppSchema = Type.Object({
  name: Type.String({
    description:
      "App name keyword (Chinese or English), e.g. 'Chrome', '网易云音乐', 'WeChat'",
  }),
  action: Type.Optional(
    Type.Union([Type.Literal("launch"), Type.Literal("find")], {
      description: "launch (default) = find and open; find = find only, return path",
    }),
  ),
  url: Type.Optional(
    Type.String({
      description:
        "URL to open (browser apps only). The browser launches directly to this URL. Example: 'https://www.xiaohongshu.com'",
    }),
  ),
});

// ─── Internal types ────────────────────────────────────────────────

interface AppMatch {
  appName: string;
  exePath: string;
  source: "registry" | "app_paths" | "shortcut" | "filesystem" | "uwp";
  /** UWP shell launch URI, present only for source=uwp */
  uwpUri?: string;
}

// ─── Common app name aliases (小白用户友好) ────────────────────────
// Maps common Chinese names / nicknames to the actual search keyword
// so users can say "打开微信" and it still works even if the app
// registers as "WeChat" in the registry.
const APP_ALIASES: Record<string, string[]> = {
  // ─── 即时通讯 ───
  "微信": ["WeChat", "微信"],
  "wechat": ["WeChat", "微信"],
  "qq": ["QQ", "Tencent"],
  "tim": ["TIM", "Tencent"],
  "钉钉": ["DingDing", "钉钉", "DingTalk"],
  "dingtalk": ["DingDing", "钉钉", "DingTalk"],
  "飞书": ["Feishu", "飞书", "Lark"],
  "lark": ["Feishu", "飞书", "Lark"],
  "企业微信": ["WXWork", "企业微信", "WeCom"],
  "wecom": ["WXWork", "企业微信", "WeCom"],
  "telegram": ["Telegram"],
  "discord": ["Discord"],
  "slack": ["Slack"],
  "teams": ["Microsoft Teams", "Teams"],
  // ─── 浏览器 ───
  "谷歌浏览器": ["Chrome", "Google Chrome"],
  "谷歌": ["Chrome", "Google Chrome"],
  "chrome": ["Chrome", "Google Chrome"],
  "edge": ["Microsoft Edge", "msedge"],
  "微软浏览器": ["Microsoft Edge", "msedge"],
  "火狐": ["Firefox", "火狐"],
  "火狐浏览器": ["Firefox", "火狐"],
  "firefox": ["Firefox"],
  "360浏览器": ["360se", "360浏览器", "360Browser"],
  "360安全浏览器": ["360se", "360浏览器", "360Browser"],
  // ─── 音乐/视频 ───
  "网易云": ["CloudMusic", "网易云音乐", "Netease"],
  "网易云音乐": ["CloudMusic", "网易云音乐", "Netease"],
  "cloudmusic": ["CloudMusic", "网易云音乐", "Netease"],
  "qq音乐": ["QQMusic", "QQ音乐"],
  "qqmusic": ["QQMusic", "QQ音乐"],
  "酷狗": ["KuGou", "酷狗", "KuGouMusic"],
  "酷狗音乐": ["KuGou", "酷狗", "KuGouMusic"],
  "酷我音乐": ["KwMusic", "酷我音乐", "KuwoMusic"],
  "b站": ["bilibili", "哔哩哔哩"],
  "bilibili": ["bilibili", "哔哩哔哩"],
  "哔哩哔哩": ["bilibili", "哔哩哔哩"],
  "爱奇艺": ["iQIYI", "爱奇艺", "QIYIVideo"],
  "优酷": ["Youku", "优酷"],
  "腾讯视频": ["Tencent Video", "腾讯视频", "TencentVideo"],
  "potplayer": ["PotPlayer"],
  "vlc": ["VLC", "VideoLAN"],
  // ─── 办公/效率 ───
  "记事本": ["Notepad", "notepad"],
  "notepad": ["Notepad", "notepad"],
  "计算器": ["Calculator", "calc"],
  "画图": ["mspaint", "Paint"],
  "word": ["WINWORD", "Microsoft Word", "Word"],
  "excel": ["EXCEL", "Microsoft Excel", "Excel"],
  "powerpoint": ["POWERPNT", "Microsoft PowerPoint", "PowerPoint"],
  "ppt": ["POWERPNT", "Microsoft PowerPoint", "PowerPoint"],
  "wps": ["WPS Office", "wps", "kingsoft"],
  "有道词典": ["YoudaoDict", "有道词典", "Youdao"],
  "百度网盘": ["BaiduNetdisk", "百度网盘", "BaiduYunGuanjia"],
  "坚果云": ["nutstore", "坚果云", "Nutstore"],
  "notion": ["Notion"],
  "obsidian": ["Obsidian"],
  "typora": ["Typora"],
  // ─── 开发工具 ───
  "vscode": ["Visual Studio Code", "Code"],
  "vs code": ["Visual Studio Code", "Code"],
  "visual studio code": ["Visual Studio Code", "Code"],
  "cursor": ["Cursor"],
  "trae": ["Trae"],
  "windsurf": ["Windsurf"],
  "idea": ["IntelliJ IDEA", "idea64", "idea"],
  "pycharm": ["PyCharm", "pycharm64"],
  "webstorm": ["WebStorm", "webstorm64"],
  "goland": ["GoLand", "goland64"],
  "sublime": ["Sublime Text", "sublime_text"],
  "notepad++": ["Notepad++", "notepad++"],
  "postman": ["Postman"],
  "git": ["Git", "git-bash", "GitBash"],
  "终端": ["Windows Terminal", "wt", "WindowsTerminal"],
  "terminal": ["Windows Terminal", "wt", "WindowsTerminal"],
  "cmd": ["cmd"],
  "powershell": ["powershell", "pwsh"],
  // ─── 系统工具 ───
  "文件管理器": ["explorer", "Explorer"],
  "资源管理器": ["explorer", "Explorer"],
  "任务管理器": ["Taskmgr", "Task Manager"],
  "控制面板": ["control", "Control Panel"],
  "设置": ["SystemSettings", "ms-settings"],
  "截图工具": ["SnippingTool", "Snipping Tool"],
  "截图": ["SnippingTool", "Snipping Tool"],
  // ─── 远程/工具 ───
  "todesk": ["ToDesk"],
  "向日葵": ["sunlogin", "向日葵", "SunloginClient"],
  "teamviewer": ["TeamViewer"],
  "远程桌面": ["mstsc", "Remote Desktop"],
  // ─── 游戏 ───
  "steam": ["Steam"],
  "epic": ["EpicGamesLauncher", "Epic Games"],
  "wegame": ["WeGame", "TencentWeGame"],
};

// ─── Browser detection (for URL passthrough) ─────────────────────

const BROWSER_ALIAS_KEYS = new Set([
  "谷歌浏览器", "谷歌", "chrome",
  "edge", "微软浏览器",
  "火狐", "火狐浏览器", "firefox",
  "360浏览器", "360安全浏览器",
]);

const BROWSER_EXE_NAMES = new Set([
  "chrome", "msedge", "firefox", "360se", "brave", "opera", "vivaldi", "iexplore",
]);

/** Check if the resolved app looks like a browser (by alias key or exe name). */
function isBrowserApp(inputName: string, match: AppMatch): boolean {
  if (BROWSER_ALIAS_KEYS.has(inputName.toLowerCase().trim())) return true;
  const exe = path.basename(match.exePath, ".exe").toLowerCase();
  return BROWSER_EXE_NAMES.has(exe);
}

// ─── Non-app exe blacklist (防止启动卸载程序等) ───────────────────

const NON_APP_EXES = new Set([
  "uninstall", "uninst", "uninst000", "unins000", "unins001",
  "update", "updater", "autoupdate", "update_notifier",
  "crashpad_handler", "crash_reporter", "crashreporter",
  "helper", "setup", "installer", "repair",
  "elevate", "launcher", // generic launchers that aren't the app itself
  "7z", "7za", // archive tools inside app directories
  "node", "python", "python3", "pythonw", // runtime exe inside app bundles
  "gpu_process", "renderer", "utility", // Electron sub-processes
]);

function isNonAppExe(exeName: string): boolean {
  const base = path.basename(exeName, ".exe").toLowerCase();
  return NON_APP_EXES.has(base);
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Resolve PowerShell exe path. */
function resolvePsExe(): string {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const psExe = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return fs.existsSync(psExe) ? psExe : "powershell.exe";
}

/**
 * Run a PowerShell snippet synchronously and return UTF-8 stdout.
 * Uses execFileSync to bypass cmd.exe (prevents command injection).
 */
function ps(script: string, timeoutMs = 8000): string {
  const prefix =
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
    "$OutputEncoding = [System.Text.Encoding]::UTF8; ";
  return execFileSync(resolvePsExe(), [
    "-NoProfile", "-NonInteractive", "-Command", prefix + script,
  ], {
    encoding: "utf-8",
    timeout: timeoutMs,
    windowsHide: true,
  }).trim();
}

/** Sanitize keyword for embedding in PowerShell single-quoted strings.
 *  Single-quoted strings in PowerShell don't interpret $ or `, only '' for literal '.
 *  However when used inside -like patterns via double-quoted contexts,
 *  we must also neutralize backtick (`) and dollar ($) to prevent evaluation. */
function psEscape(s: string): string {
  return s.replace(/'/g, "''").replace(/`/g, "``").replace(/\$/g, "`$");
}

/** Case-insensitive substring match (works for CJK). */
function fuzzyMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Split PowerShell output handling both \r\n and \n. */
function splitLines(output: string): string[] {
  return output.split(/\r?\n/).filter(Boolean);
}

/**
 * Expand user input into a list of keywords to try.
 * The original keyword is always first; aliases expand search coverage.
 */
function expandKeywords(input: string): string[] {
  const lower = input.toLowerCase().trim();
  const aliases = APP_ALIASES[lower];
  if (aliases) {
    // Put original input first, then aliases (deduped)
    const seen = new Set<string>([lower]);
    const result = [input];
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(alias);
      }
    }
    return result;
  }
  return [input];
}

// ─── Layer 0: App Paths registry (fastest, most direct) ────────────

function searchAppPaths(keyword: string): AppMatch | null {
  try {
    const script = [
      "$paths = Get-ChildItem",
      "  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',",
      "  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'",
      "  -ErrorAction SilentlyContinue;",
      `$match = $paths | Where-Object { $_.PSChildName -like '*${psEscape(keyword)}*' } | Select-Object -First 1;`,
      "if ($match) { Write-Output ($match.PSChildName + '|||' + $match.GetValue('')) }",
    ].join(" ");

    const out = ps(script);
    if (!out) return null;

    const parts = out.split("|||").map((s) => s?.trim());
    const exeName = parts[0] || "";
    const exePath = (parts[1] || "").replace(/^"|"$/g, "");

    if (exePath && exePath.toLowerCase().endsWith(".exe") && fs.existsSync(exePath)) {
      return {
        appName: path.basename(exeName, ".exe"),
        exePath,
        source: "app_paths",
      };
    }
  } catch {
    // App Paths query failed; fall through
  }
  return null;
}

// ─── Layer 1: Registry Uninstall search ────────────────────────────

function searchRegistry(keyword: string): AppMatch | null {
  try {
    const script = [
      "$paths = @(",
      "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
      ");",
      "$items = Get-ItemProperty $paths -ErrorAction SilentlyContinue |",
      `  Where-Object { $_.DisplayName -and $_.DisplayName -like '*${psEscape(keyword)}*' } |`,
      "  Select-Object -First 5 DisplayName,DisplayIcon,InstallLocation;",
      "foreach ($i in $items) {",
      "  Write-Output (($i.DisplayName,$i.DisplayIcon,$i.InstallLocation) -join '|||')",
      "}",
    ].join(" ");

    const out = ps(script);
    if (!out) return null;

    for (const line of splitLines(out)) {
      const parts = line.split("|||");
      if (parts.length < 1) continue;
      const displayName = parts[0]?.trim() || "";
      const displayIcon = parts[1]?.trim() || "";
      const installLocation = parts[2]?.trim() || "";

      if (!fuzzyMatch(displayName, keyword)) continue;

      // Try DisplayIcon first (strip ,0 icon-index suffix and quotes)
      if (displayIcon) {
        const iconPath = displayIcon.replace(/,\d+$/, "").replace(/^"|"$/g, "");
        if (
          iconPath.toLowerCase().endsWith(".exe") &&
          !isNonAppExe(iconPath) &&
          fs.existsSync(iconPath)
        ) {
          return { appName: displayName, exePath: iconPath, source: "registry" };
        }
      }

      // Try InstallLocation + scan for exe
      if (installLocation && fs.existsSync(installLocation)) {
        const exe = findExeInDir(installLocation, keyword, 1);
        if (exe) {
          return { appName: displayName, exePath: exe, source: "registry" };
        }
        // Fallback: first non-blacklisted .exe at root of InstallLocation
        const anyExe = findSafeExeInDir(installLocation);
        if (anyExe) {
          return { appName: displayName, exePath: anyExe, source: "registry" };
        }
      }
    }
  } catch {
    // Registry query failed or timed out; fall through to next layer
  }
  return null;
}

// ─── Layer 2: Start Menu + Desktop shortcut search ─────────────────

function searchShortcuts(keyword: string): AppMatch | null {
  try {
    const dirs = [
      path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
      path.join(
        process.env.ProgramData || "C:\\ProgramData",
        "Microsoft", "Windows", "Start Menu", "Programs",
      ),
      path.join(process.env.USERPROFILE || "", "Desktop"),
      path.join(process.env.PUBLIC || "C:\\Users\\Public", "Desktop"),
    ].filter((d) => {
      try { return d && fs.existsSync(d); } catch { return false; }
    });

    if (dirs.length === 0) return null;

    const dirsLiteral = dirs.map((d) => `'${psEscape(d)}'`).join(",");
    const script = [
      "$sh = New-Object -ComObject WScript.Shell;",
      `$lnks = Get-ChildItem ${dirsLiteral} -Include '*.lnk' -Recurse -ErrorAction SilentlyContinue |`,
      `  Where-Object { $_.BaseName -like '*${psEscape(keyword)}*' } | Select-Object -First 5;`,
      "foreach ($l in $lnks) {",
      "  try { $t = $sh.CreateShortcut($l.FullName).TargetPath } catch { $t = '' };",
      "  Write-Output ($l.BaseName + '|||' + $t)",
      "}",
    ].join(" ");

    const out = ps(script);
    if (!out) return null;

    for (const line of splitLines(out)) {
      const parts = line.split("|||");
      const baseName = parts[0]?.trim() || "";
      const targetPath = parts[1]?.trim() || "";
      if (!targetPath) continue;
      if (
        targetPath.toLowerCase().endsWith(".exe") &&
        !isNonAppExe(targetPath) &&
        fs.existsSync(targetPath)
      ) {
        return {
          appName: baseName || keyword,
          exePath: targetPath,
          source: "shortcut",
        };
      }
    }
  } catch {
    // Shortcut search failed; fall through
  }
  return null;
}

// ─── Layer 3: Filesystem scan (with performance guard) ─────────────

/** Max directories to visit during filesystem scan to prevent stalls. */
const FS_SCAN_DIR_LIMIT = 300;

function searchFilesystem(keyword: string): AppMatch | null {
  const roots: Array<{ dir: string; depth: number }> = [
    { dir: "C:\\Program Files", depth: 3 },
    { dir: "C:\\Program Files (x86)", depth: 3 },
    { dir: process.env.LOCALAPPDATA || "", depth: 2 },
  ];

  const counter = { count: 0 };
  for (const { dir, depth } of roots) {
    if (!dir || !fs.existsSync(dir)) continue;
    const exe = walkForExe(dir, keyword, 0, depth, counter);
    if (exe) {
      const appName = path.basename(exe, ".exe");
      return { appName, exePath: exe, source: "filesystem" };
    }
  }
  return null;
}

/** Recursively find an .exe whose name matches keyword (up to maxDepth). */
function findExeInDir(dir: string, keyword: string, maxDepth: number): string | null {
  const counter = { count: 0 };
  return walkForExe(dir, keyword, 0, maxDepth, counter);
}

function walkForExe(
  dir: string,
  keyword: string,
  depth: number,
  maxDepth: number,
  counter: { count: number },
): string | null {
  if (depth > maxDepth || counter.count >= FS_SCAN_DIR_LIMIT) return null;
  counter.count++;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  // Check files at current depth first
  for (const e of entries) {
    if (
      e.isFile() &&
      e.name.toLowerCase().endsWith(".exe") &&
      !isNonAppExe(e.name) &&
      fuzzyMatch(e.name, keyword)
    ) {
      return path.join(dir, e.name);
    }
  }

  // Recurse into directories; prioritize those whose name matches keyword
  const dirs = entries.filter((e) => e.isDirectory());
  const sorted = dirs.sort((a, b) => {
    const aMatch = fuzzyMatch(a.name, keyword) ? 0 : 1;
    const bMatch = fuzzyMatch(b.name, keyword) ? 0 : 1;
    return aMatch - bMatch;
  });

  for (const e of sorted) {
    if (counter.count >= FS_SCAN_DIR_LIMIT) break;
    const result = walkForExe(path.join(dir, e.name), keyword, depth + 1, maxDepth, counter);
    if (result) return result;
  }
  return null;
}

/** Return the first non-blacklisted .exe in a directory (non-recursive). */
function findSafeExeInDir(dir: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith(".exe") && !isNonAppExe(e.name)) {
        return path.join(dir, e.name);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Layer 4: UWP / Store apps ─────────────────────────────────────

function searchUwpApps(keyword: string): AppMatch | null {
  try {
    // Search by Name, manifest DisplayName, AND executable path/name.
    // Many Store apps have cryptic package Names (e.g. "1F8B0F94.122165AE053F"
    // for 网易云音乐), so matching only Name is insufficient.
    const script = [
      `$kw = '${psEscape(keyword)}';`,
      "$allPkgs = Get-AppxPackage | Where-Object { -not $_.IsFramework };",
      "foreach ($pkg in $allPkgs) {",
      "  try {",
      "    $m = Get-AppxPackageManifest $pkg;",
      "    $dn = [string]$m.Package.Properties.DisplayName;",
      "    $apps = $m.Package.Applications.Application;",
      "    $exeStr = ($apps | ForEach-Object { $_.Executable }) -join ',';",
      '    if ($pkg.Name -like "*$kw*" -or $dn -like "*$kw*" -or $exeStr -like "*$kw*") {',
      "      $appId = if ($apps -is [array]) { $apps[0].Id } else { $apps.Id };",
      "      if (-not $appId) { $appId = 'App' };",
      "      Write-Output ($dn + '|||' + $pkg.PackageFamilyName + '|||' + $appId);",
      "      break",
      "    }",
      "  } catch {}",
      "}",
    ].join(" ");

    const out = ps(script, 15000); // Manifest scan may take longer
    if (!out) return null;

    const parts = out.split("|||").map((s) => s?.trim());
    const displayName = parts[0] || "";
    const familyName = parts[1] || "";
    const appId = parts[2] || "App";
    if (!familyName) return null;

    const uwpUri = `shell:appsFolder\\${familyName}!${appId}`;
    return {
      appName: displayName || keyword,
      exePath: uwpUri,
      source: "uwp",
      uwpUri,
    };
  } catch {
    // UWP query failed; fall through
  }
  return null;
}

// ─── Core search orchestrator ──────────────────────────────────────

/**
 * Run all search layers with expanded keywords.
 * For each keyword variant, run the 5-layer search; return first match.
 */
function findApp(input: string): AppMatch | null {
  const keywords = expandKeywords(input);

  for (const keyword of keywords) {
    const match =
      searchAppPaths(keyword) ??
      searchRegistry(keyword) ??
      searchShortcuts(keyword) ??
      searchFilesystem(keyword) ??
      searchUwpApps(keyword);
    if (match) return match;
  }
  return null;
}

// ─── Launch ────────────────────────────────────────────────────────

function launchApp(match: AppMatch, url?: string): void {
  if (match.source === "uwp" && match.uwpUri) {
    // UWP apps: if URL provided, open via explorer.exe with the URL directly
    const target = url ?? match.uwpUri;
    const child = spawn("explorer.exe", [target], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
  } else {
    const args = url ? [url] : [];
    const child = spawn(match.exePath, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
  }
}

// ─── Tool factory ──────────────────────────────────────────────────

export function createOpenAppTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "open_app",
    label: "Open App",
    description: [
      "Find and launch a desktop application on Windows by name.",
      "Searches App Paths, registry, Start Menu / Desktop shortcuts, filesystem, and UWP Store apps.",
      "Supports both Chinese and English app names, including common aliases.",
      "Pass optional `url` to open a browser directly to a URL (e.g., open_app({name:'Chrome', url:'https://www.xiaohongshu.com'})).",
      "Examples: open_app({name:'Chrome'}), open_app({name:'Chrome', url:'https://baidu.com'}), open_app({name:'网易云音乐'}), open_app({name:'WeChat',action:'find'})",
    ].join("\n"),
    parameters: OpenAppSchema,
    execute: async (_toolCallId, args): Promise<AgentToolResult<unknown>> => {
      const params = args as Record<string, unknown>;
      const name = readStringParam(params, "name", { required: true });
      const action = readStringParam(params, "action") ?? "launch";
      const url = readStringParam(params, "url");

      const match = findApp(name);

      if (!match) {
        return {
          content: [
            {
              type: "text",
              text: `未找到匹配 '${name}' 的应用。建议检查应用是否已安装。\nNo application matching '${name}' was found. Please check if the application is installed.`,
            },
          ],
          details: { status: "not_found", keyword: name },
        };
      }

      if (action === "find") {
        return {
          content: [
            {
              type: "text",
              text: `找到应用: ${match.appName}\n路径: ${match.exePath}\n(来源: ${match.source})`,
            },
          ],
          details: {
            status: "found",
            appName: match.appName,
            exePath: match.exePath,
            source: match.source,
          },
        };
      }

      // action === "launch" (default)
      // Only pass URL to browser apps
      const effectiveUrl = url && isBrowserApp(name, match) ? url : undefined;

      try {
        launchApp(match, effectiveUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `找到应用但启动失败: ${match.appName}\n路径: ${match.exePath}\n错误: ${msg}`,
            },
          ],
          details: {
            status: "launch_error",
            appName: match.appName,
            exePath: match.exePath,
            source: match.source,
            error: msg,
          },
        };
      }

      const urlHint = effectiveUrl
        ? `\n正在打开: ${effectiveUrl}`
        : url
          ? `\n注意: ${match.appName} 不是浏览器应用，已忽略 url 参数。`
          : "";

      return {
        content: [
          {
            type: "text",
            text: `已启动: ${match.appName}\n路径: ${match.exePath}\n(来源: ${match.source})${urlHint}`,
          },
        ],
        details: {
          status: "launched",
          appName: match.appName,
          exePath: match.exePath,
          source: match.source,
          ...(effectiveUrl ? { url: effectiveUrl } : {}),
        },
      };
    },
  };
}
