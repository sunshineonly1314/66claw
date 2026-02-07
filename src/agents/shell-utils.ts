import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function resolvePowerShellPath(): string {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  if (systemRoot) {
    const candidate = path.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  return "powershell.exe";
}

export function getShellConfig(): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    // Use PowerShell instead of cmd.exe on Windows.
    // Problem: Many Windows system utilities (ipconfig, systeminfo, etc.) write
    // directly to the console via WriteConsole API, bypassing stdout pipes.
    // When Node.js spawns cmd.exe with piped stdio, these utilities produce no output.
    // PowerShell properly captures and redirects their output to stdout.
    //
    // ClawdbotCN: Force UTF-8 output encoding for PowerShell.
    // On Chinese Windows, PowerShell defaults to GBK (CP936) for console output.
    // Node.js reads piped output as UTF-8, causing garbled characters (锟斤拷).
    // Prepending the encoding prefix ensures all output is UTF-8 encoded.
    return {
      shell: resolvePowerShellPath(),
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        // Set both stdout and stderr encoding to UTF-8.
        // $OutputEncoding affects stdout piped data; [Console]::OutputEncoding affects native exe output.
        // Also set $ErrorView to 'NormalView' to prevent ANSI-colored error formatting in PS 7+.
        "[Console]::OutputEncoding = [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; if ($PSVersionTable.PSVersion.Major -ge 7) { $ErrorView = 'NormalView' };",
      ],
    };
  }

  const envShell = process.env.SHELL?.trim();
  const shellName = envShell ? path.basename(envShell) : "";
  // Fish rejects common bashisms used by tools, so prefer bash when detected.
  if (shellName === "fish") {
    const bash = resolveShellFromPath("bash");
    if (bash) return { shell: bash, args: ["-c"] };
    const sh = resolveShellFromPath("sh");
    if (sh) return { shell: sh, args: ["-c"] };
  }
  const shell = envShell && envShell.length > 0 ? envShell : "sh";
  return { shell, args: ["-c"] };
}

function resolveShellFromPath(name: string): string | undefined {
  const envPath = process.env.PATH ?? "";
  if (!envPath) return undefined;
  const entries = envPath.split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // ignore missing or non-executable entries
    }
  }
  return undefined;
}

export function sanitizeBinaryOutput(text: string): string {
  // Strip ANSI escape sequences (CSI, OSC, SS2/SS3, DCS, etc.) that pollute output
  // on Windows terminals. These come from PowerShell color codes, window title
  // sequences, cursor positioning, progress bars, etc.
  // Patterns covered:
  //   CSI:  \x1b[ ... <letter>        (e.g. \x1b[91m, \x1b[2J, \x1b[?25h)
  //   OSC:  \x1b] ... (BEL or ST)     (e.g. \x1b]0;title\x07)
  //   SS2/SS3: \x1bN, \x1bO           (single-shift)
  //   DCS:  \x1bP ... ST              (device control strings)
  //   Simple: \x1b followed by a single char in [()#=><] range
  const withoutAnsi = text.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires matching control chars
    /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[NOPno].*?(?:\x1b\\|\x07)?|[()#=><][A-Za-z0-9]?|.)/g,
    "",
  );
  const scrubbed = withoutAnsi.replace(/[\p{Format}\p{Surrogate}]/gu, "");
  if (!scrubbed) return scrubbed;
  const chunks: string[] = [];
  for (const char of scrubbed) {
    const code = char.codePointAt(0);
    if (code == null) continue;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      chunks.push(char);
      continue;
    }
    if (code < 0x20) continue;
    chunks.push(char);
  }
  return chunks.join("");
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
        stdio: "ignore",
        detached: true,
      });
    } catch {
      // ignore errors if taskkill fails
    }
    return;
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // process already dead
    }
  }
}
