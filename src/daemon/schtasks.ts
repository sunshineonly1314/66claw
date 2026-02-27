import fs from "node:fs/promises";
import path from "node:path";
import type { GatewayServiceRuntime } from "./service-runtime.js";
import { formatGatewayServiceDescription, resolveGatewayWindowsTaskName } from "./constants.js";
import { formatLine } from "./output.js";
import { resolveGatewayStateDir } from "./paths.js";
import { parseKeyValueOutput } from "./runtime-parse.js";
import { execSchtasks } from "./schtasks-exec.js";

function resolveTaskName(env: Record<string, string | undefined>): string {
  const override = env.OPENCLAWCN_WINDOWS_TASK_NAME?.trim();
  if (override) {
    return override;
  }
  return resolveGatewayWindowsTaskName(env.OPENCLAWCN_PROFILE);
}

export function resolveTaskScriptPath(env: Record<string, string | undefined>): string {
  const override = env.OPENCLAWCN_TASK_SCRIPT?.trim();
  if (override) {
    return override;
  }
  const scriptName = env.OPENCLAWCN_TASK_SCRIPT_NAME?.trim() || "gateway.cmd";
  const stateDir = resolveGatewayStateDir(env);
  return path.join(stateDir, scriptName);
}

// [CN-MERGE:dafe52e8cf] Escape CMD set assignment components (%, ^, !, ")
function escapeCmdSetAssignmentComponent(value: string): string {
  return value.replace(/\^/g, "^^").replace(/%/g, "%%").replace(/!/g, "^!").replace(/"/g, '^"');
}

function unescapeCmdSetAssignmentComponent(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value[i + 1];
    if (ch === "^" && (next === "^" || next === '"' || next === "!")) {
      out += next;
      i += 1;
      continue;
    }
    if (ch === "%" && next === "%") {
      out += "%";
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function parseCmdSetAssignment(line: string): { key: string; value: string } | null {
  const raw = line.trim();
  if (!raw) {
    return null;
  }
  const quoted = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2;
  const assignment = quoted ? raw.slice(1, -1) : raw;
  const index = assignment.indexOf("=");
  if (index <= 0) {
    return null;
  }
  const key = assignment.slice(0, index).trim();
  const value = assignment.slice(index + 1).trim();
  if (!key) {
    return null;
  }
  if (!quoted) {
    return { key, value };
  }
  return {
    key: unescapeCmdSetAssignmentComponent(key),
    value: unescapeCmdSetAssignmentComponent(value),
  };
}

function renderCmdSetAssignment(key: string, value: string): string {
  const escapedKey = escapeCmdSetAssignmentComponent(key);
  const escapedValue = escapeCmdSetAssignmentComponent(value);
  return `set "${escapedKey}=${escapedValue}"`;
}

// [CN-MERGE:280c6b117b] Harden script quoting for cmd.exe special chars
function assertNoCmdLineBreak(value: string, field: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${field} cannot contain CR or LF in Windows task scripts.`);
  }
}

function quoteSchtasksArg(value: string): string {
  if (!/[ \t"]/g.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function quoteCmdScriptArg(value: string): string {
  assertNoCmdLineBreak(value, "Command argument");
  if (!value) {
    return '""';
  }
  const escaped = value.replace(/"/g, '\\"').replace(/%/g, "%%").replace(/!/g, "^!");
  if (!/[ \t"&|<>^()%!]/g.test(value)) {
    return escaped;
  }
  return `"${escaped}"`;
}

function unescapeCmdScriptArg(value: string): string {
  return value.replace(/\^!/g, "!").replace(/%%/g, "%");
}

function resolveTaskUser(env: Record<string, string | undefined>): string | null {
  const username = env.USERNAME || env.USER || env.LOGNAME;
  if (!username) {
    return null;
  }
  if (username.includes("\\")) {
    return username;
  }
  const domain = env.USERDOMAIN;
  if (domain) {
    return `${domain}\\${username}`;
  }
  return username;
}

function parseCommandLine(value: string): string[] {
  // `buildTaskScript` escapes quotes (`\"`) and cmd expansions (`%%`, `^!`).
  // Keep all other backslashes literal so drive and UNC paths are preserved.
  const args: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\" && i + 1 < value.length && value[i + 1] === '"') {
      current += value[i + 1];
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) {
    args.push(current);
  }
  return args.map(unescapeCmdScriptArg);
}

export async function readScheduledTaskCommand(env: Record<string, string | undefined>): Promise<{
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
} | null> {
  const scriptPath = resolveTaskScriptPath(env);
  try {
    const content = await fs.readFile(scriptPath, "utf8");
    let workingDirectory = "";
    let commandLine = "";
    const environment: Record<string, string> = {};
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (line.startsWith("@echo")) {
        continue;
      }
      if (line.toLowerCase().startsWith("rem ")) {
        continue;
      }
      if (line.toLowerCase().startsWith("set ")) {
        const assignment = parseCmdSetAssignment(line.slice(4));
        if (assignment) {
          environment[assignment.key] = assignment.value;
        }
        continue;
      }
      if (line.toLowerCase().startsWith("cd /d ")) {
        workingDirectory = line.slice("cd /d ".length).trim().replace(/^"|"$/g, "");
        continue;
      }
      commandLine = line;
      break;
    }
    if (!commandLine) {
      return null;
    }
    return {
      programArguments: parseCommandLine(commandLine),
      ...(workingDirectory ? { workingDirectory } : {}),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
    };
  } catch {
    return null;
  }
}

export type ScheduledTaskInfo = {
  status?: string;
  lastRunTime?: string;
  lastRunResult?: string;
};

export function parseSchtasksQuery(output: string): ScheduledTaskInfo {
  const entries = parseKeyValueOutput(output, ":");
  const info: ScheduledTaskInfo = {};
  const status = entries.status;
  if (status) {
    info.status = status;
  }
  const lastRunTime = entries["last run time"];
  if (lastRunTime) {
    info.lastRunTime = lastRunTime;
  }
  const lastRunResult = entries["last run result"];
  if (lastRunResult) {
    info.lastRunResult = lastRunResult;
  }
  return info;
}

function buildTaskScript({
  description,
  programArguments,
  workingDirectory,
  environment,
}: {
  description?: string;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
}): string {
  const lines: string[] = ["@echo off"];
  const trimmedDescription = description?.trim();
  if (trimmedDescription) {
    assertNoCmdLineBreak(trimmedDescription, "Task description");
    lines.push(`rem ${trimmedDescription}`);
  }
  if (workingDirectory) {
    lines.push(`cd /d ${quoteCmdScriptArg(workingDirectory)}`);
  }
  if (environment) {
    for (const [key, value] of Object.entries(environment)) {
      if (!value) {
        continue;
      }
      assertNoCmdLineBreak(key, "Environment variable name");
      assertNoCmdLineBreak(value, "Environment variable value");
      lines.push(renderCmdSetAssignment(key, value));
    }
  }
  const command = programArguments.map(quoteCmdScriptArg).join(" ");
  lines.push(command);
  return `${lines.join("\r\n")}\r\n`;
}

async function assertSchtasksAvailable() {
  const res = await execSchtasks(["/Query"]);
  if (res.code === 0) {
    return;
  }
  const detail = res.stderr || res.stdout;
  throw new Error(`schtasks unavailable: ${detail || "unknown error"}`.trim());
}

export async function installScheduledTask({
  env,
  stdout,
  programArguments,
  workingDirectory,
  environment,
  description,
}: {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
  description?: string;
}): Promise<{ scriptPath: string }> {
  await assertSchtasksAvailable();
  const scriptPath = resolveTaskScriptPath(env);
  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  const taskDescription =
    description ??
    formatGatewayServiceDescription({
      profile: env.OPENCLAWCN_PROFILE,
      version: environment?.OPENCLAWCN_SERVICE_VERSION ?? env.OPENCLAWCN_SERVICE_VERSION,
    });
  const script = buildTaskScript({
    description: taskDescription,
    programArguments,
    workingDirectory,
    environment,
  });
  await fs.writeFile(scriptPath, script, "utf8");

  const taskName = resolveTaskName(env);
  const quotedScript = quoteSchtasksArg(scriptPath);
  const baseArgs = [
    "/Create",
    "/F",
    "/SC",
    "ONLOGON",
    "/RL",
    "LIMITED",
    "/TN",
    taskName,
    "/TR",
    quotedScript,
  ];
  const taskUser = resolveTaskUser(env);
  let create = await execSchtasks(
    taskUser ? [...baseArgs, "/RU", taskUser, "/NP", "/IT"] : baseArgs,
  );
  if (create.code !== 0 && taskUser) {
    create = await execSchtasks(baseArgs);
  }
  if (create.code !== 0) {
    const detail = create.stderr || create.stdout;
    const hint = /access is denied/i.test(detail)
      ? " Run PowerShell as Administrator or rerun without installing the daemon."
      : "";
    throw new Error(`schtasks create failed: ${detail}${hint}`.trim());
  }

  await execSchtasks(["/Run", "/TN", taskName]);
  // Ensure we don't end up writing to a clack spinner line (wizards show progress without a newline).
  stdout.write("\n");
  stdout.write(`${formatLine("Installed Scheduled Task", taskName)}\n`);
  stdout.write(`${formatLine("Task script", scriptPath)}\n`);
  return { scriptPath };
}

export async function uninstallScheduledTask({
  env,
  stdout,
}: {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
}): Promise<void> {
  await assertSchtasksAvailable();
  const taskName = resolveTaskName(env);
  await execSchtasks(["/Delete", "/F", "/TN", taskName]);

  const scriptPath = resolveTaskScriptPath(env);
  try {
    await fs.unlink(scriptPath);
    stdout.write(`${formatLine("Removed task script", scriptPath)}\n`);
  } catch {
    stdout.write(`Task script not found at ${scriptPath}\n`);
  }
}

function isTaskNotRunning(res: { stdout: string; stderr: string; code: number }): boolean {
  const detail = (res.stderr || res.stdout).toLowerCase();
  return detail.includes("not running");
}

export async function stopScheduledTask({
  stdout,
  env,
}: {
  stdout: NodeJS.WritableStream;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  await assertSchtasksAvailable();
  const taskName = resolveTaskName(env ?? (process.env as Record<string, string | undefined>));
  const res = await execSchtasks(["/End", "/TN", taskName]);
  if (res.code !== 0 && !isTaskNotRunning(res)) {
    throw new Error(`schtasks end failed: ${res.stderr || res.stdout}`.trim());
  }
  stdout.write(`${formatLine("Stopped Scheduled Task", taskName)}\n`);
}

export async function restartScheduledTask({
  stdout,
  env,
}: {
  stdout: NodeJS.WritableStream;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  await assertSchtasksAvailable();
  const taskName = resolveTaskName(env ?? (process.env as Record<string, string | undefined>));
  await execSchtasks(["/End", "/TN", taskName]);
  const res = await execSchtasks(["/Run", "/TN", taskName]);
  if (res.code !== 0) {
    throw new Error(`schtasks run failed: ${res.stderr || res.stdout}`.trim());
  }
  stdout.write(`${formatLine("Restarted Scheduled Task", taskName)}\n`);
}

export async function isScheduledTaskInstalled(args: {
  env?: Record<string, string | undefined>;
}): Promise<boolean> {
  await assertSchtasksAvailable();
  const taskName = resolveTaskName(args.env ?? (process.env as Record<string, string | undefined>));
  const res = await execSchtasks(["/Query", "/TN", taskName]);
  return res.code === 0;
}

export async function readScheduledTaskRuntime(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Promise<GatewayServiceRuntime> {
  try {
    await assertSchtasksAvailable();
  } catch (err) {
    return {
      status: "unknown",
      detail: String(err),
    };
  }
  const taskName = resolveTaskName(env);
  const res = await execSchtasks(["/Query", "/TN", taskName, "/V", "/FO", "LIST"]);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout).trim();
    const missing = detail.toLowerCase().includes("cannot find the file");
    return {
      status: missing ? "stopped" : "unknown",
      detail: detail || undefined,
      missingUnit: missing,
    };
  }
  const parsed = parseSchtasksQuery(res.stdout || "");
  const statusRaw = parsed.status?.toLowerCase();
  const status = statusRaw === "running" ? "running" : statusRaw ? "stopped" : "unknown";
  return {
    status,
    state: parsed.status,
    lastRunTime: parsed.lastRunTime,
    lastRunResult: parsed.lastRunResult,
  };
}
