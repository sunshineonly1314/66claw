import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

/** Check if an executable exists on the system PATH (Windows). */
function winWhich(exe: string): boolean {
  try {
    const result = execFileSync("where", [exe], {
      encoding: "utf-8",
      timeout: 3000,
      windowsHide: true,
    });
    return Boolean(result.trim());
  } catch {
    return false;
  }
}

/** Check if an executable exists on the system PATH (Unix). */
function unixWhich(exe: string): boolean {
  try {
    const result = execFileSync("which", [exe], {
      encoding: "utf-8",
      timeout: 3000,
    });
    return Boolean(result.trim());
  } catch {
    return false;
  }
}

/**
 * Launch a terminal with elevated (admin) privileges on Windows.
 *
 * Uses `Start-Process -Verb RunAs` which triggers a UAC prompt,
 * letting the user confirm elevation.
 */
function resolveWindowsPowerShell(): string {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const psPath = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return fs.existsSync(psPath) ? psPath : "powershell.exe";
}

function launchWindowsElevated(cwd?: string): { terminal: string } {
  // Detect best available terminal: wt.exe → pwsh.exe → powershell.exe
  let target: string;
  const targetArgParts: string[] = [];

  if (winWhich("wt.exe")) {
    target = "wt.exe";
    if (cwd) targetArgParts.push("-d", `"${cwd}"`);
  } else if (winWhich("pwsh.exe")) {
    target = "pwsh.exe";
    targetArgParts.push("-NoExit");
    if (cwd) targetArgParts.push("-WorkingDirectory", `"${cwd}"`);
  } else {
    target = resolveWindowsPowerShell();
    targetArgParts.push("-NoExit");
    if (cwd) {
      const escaped = cwd.replace(/'/g, "''");
      targetArgParts.push("-Command", `"Set-Location '${escaped}'"`);
    }
  }

  // Start-Process -Verb RunAs triggers UAC elevation prompt
  const psCommand =
    targetArgParts.length > 0
      ? `Start-Process -FilePath '${target}' -ArgumentList ${targetArgParts.map((a) => `'${a.replace(/'/g, "''")}'`).join(",")} -Verb RunAs`
      : `Start-Process -FilePath '${target}' -Verb RunAs`;

  const shell = resolveWindowsPowerShell();
  const child = spawn(shell, ["-NoProfile", "-Command", psCommand], {
    detached: true,
    stdio: "ignore",
    windowsHide: true, // hide the launcher PowerShell window itself
  });
  child.unref();
  return { terminal: target };
}

/**
 * Launch a terminal on macOS or Linux (no special elevation —
 * users can `sudo` inside the terminal as needed).
 */
function launchUnixTerminal(cwd?: string): { terminal: string } {
  if (process.platform === "darwin") {
    const args = ["-a", "Terminal"];
    if (cwd) args.push(cwd);
    const child = spawn("open", args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { terminal: "Terminal.app" };
  }

  // Linux: try common terminal emulators
  const candidates = [
    "gnome-terminal",
    "konsole",
    "xfce4-terminal",
    "x-terminal-emulator",
    "xterm",
  ];
  for (const exe of candidates) {
    if (unixWhich(exe)) {
      const args: string[] = [];
      if (cwd) {
        if (exe === "gnome-terminal") args.push(`--working-directory=${cwd}`);
        else if (exe === "konsole") args.push("--workdir", cwd);
      }
      const child = spawn(exe, args, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return { terminal: exe };
    }
  }

  // Last resort
  const child = spawn("xterm", [], { detached: true, stdio: "ignore" });
  child.unref();
  return { terminal: "xterm" };
}

export const terminalHandlers: GatewayRequestHandlers = {
  "terminal.open": ({ params, respond }) => {
    const cwd = typeof params.cwd === "string" ? params.cwd.trim() : undefined;
    if (cwd && !fs.existsSync(cwd)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `directory not found: ${cwd}`),
      );
      return;
    }

    try {
      const result =
        process.platform === "win32" ? launchWindowsElevated(cwd) : launchUnixTerminal(cwd);
      respond(true, { ok: true, ...result }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to open terminal: ${String(err)}`),
      );
    }
  },
};
