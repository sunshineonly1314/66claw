import { execFileSync } from "node:child_process";
import { resolveLsofCommandSync } from "../infra/ports-lsof.js";

export type PortProcess = { pid: number; command?: string };

export type ForceFreePortResult = {
  killed: PortProcess[];
  waitedMs: number;
  escalatedToSigkill: boolean;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function parseLsofOutput(output: string): PortProcess[] {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const results: PortProcess[] = [];
  let current: Partial<PortProcess> = {};
  for (const line of lines) {
    if (line.startsWith("p")) {
      if (current.pid) results.push(current as PortProcess);
      current = { pid: Number.parseInt(line.slice(1), 10) };
    } else if (line.startsWith("c")) {
      current.command = line.slice(1);
    }
  }
  if (current.pid) results.push(current as PortProcess);
  return results;
}

/**
 * Parse Windows netstat -ano output to find listeners on a port.
 * netstat output format:
 *   TCP    0.0.0.0:18789    0.0.0.0:0    LISTENING    12345
 *   TCP    [::]:18789       [::]:0       LISTENING    12345
 */
function parseNetstatOutput(output: string, port: number): PortProcess[] {
  const results = new Map<number, PortProcess>();
  const portStr = `:${port}`;
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.includes("LISTENING")) continue;
    if (!trimmed.includes(portStr)) continue;
    // Verify the port is an exact match (not a substring like :1878 in :18789)
    const parts = trimmed.split(/\s+/);
    // parts: [protocol, local_addr, foreign_addr, state, pid]
    if (parts.length < 5) continue;
    const localAddr = parts[1] ?? "";
    // Extract the port from the local address (handles both IPv4 and IPv6)
    const lastColon = localAddr.lastIndexOf(":");
    if (lastColon === -1) continue;
    const parsedPort = Number.parseInt(localAddr.slice(lastColon + 1), 10);
    if (parsedPort !== port) continue;
    const pid = Number.parseInt(parts[parts.length - 1] ?? "", 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    if (!results.has(pid)) {
      // Try to get process name
      let command: string | undefined;
      try {
        const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
          encoding: "utf-8",
          timeout: 3000,
        });
        const match = out.match(/"([^"]+)"/);
        if (match) command = match[1];
      } catch {
        // ignore
      }
      results.set(pid, { pid, command });
    }
  }
  return Array.from(results.values());
}

/**
 * List processes listening on a TCP port. Works on both Unix (lsof) and Windows (netstat).
 */
export function listPortListeners(port: number): PortProcess[] {
  if (process.platform === "win32") {
    try {
      const out = execFileSync("netstat", ["-ano", "-p", "TCP"], {
        encoding: "utf-8",
        timeout: 5000,
      });
      return parseNetstatOutput(out, port);
    } catch {
      return [];
    }
  }
  try {
    const lsof = resolveLsofCommandSync();
    const out = execFileSync(lsof, ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-FpFc"], {
      encoding: "utf-8",
    });
    return parseLsofOutput(out);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      throw new Error("lsof not found; required for --force");
    }
    if (status === 1) return []; // no listeners
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function forceFreePort(port: number): PortProcess[] {
  const listeners = listPortListeners(port);
  for (const proc of listeners) {
    try {
      if (process.platform === "win32") {
        // On Windows, process.kill(pid, "SIGTERM") doesn't gracefully stop Node processes.
        // Use taskkill which sends WM_CLOSE for graceful shutdown.
        execFileSync("taskkill", ["/PID", String(proc.pid)], {
          timeout: 5000,
          encoding: "utf-8",
        });
      } else {
        process.kill(proc.pid, "SIGTERM");
      }
    } catch (err) {
      // Process may have already exited between listing and killing (race condition).
      const code = (err as { code?: string; status?: number }).code;
      const status = (err as { status?: number }).status;
      if (code === "ESRCH" || status === 128) continue;
      throw new Error(
        `failed to kill pid ${proc.pid}${proc.command ? ` (${proc.command})` : ""}: ${String(err)}`,
      );
    }
  }
  return listeners;
}

function killPids(listeners: PortProcess[], signal: NodeJS.Signals) {
  for (const proc of listeners) {
    try {
      if (process.platform === "win32") {
        // On Windows, SIGKILL equivalent is taskkill /F (force kill).
        // Without /F, taskkill sends WM_CLOSE for graceful shutdown.
        const args = ["/PID", String(proc.pid)];
        if (signal === "SIGKILL") args.push("/F");
        execFileSync("taskkill", args, { timeout: 5000, encoding: "utf-8" });
      } else {
        process.kill(proc.pid, signal);
      }
    } catch (err) {
      // On Windows, taskkill exits with code 128 if process already exited (race).
      // On Unix, ESRCH means process not found. Both are safe to ignore.
      const code = (err as { code?: string; status?: number }).code;
      const status = (err as { status?: number }).status;
      if (code === "ESRCH" || status === 128) continue;
      throw new Error(
        `failed to kill pid ${proc.pid}${proc.command ? ` (${proc.command})` : ""}: ${String(err)}`,
      );
    }
  }
}

export async function forceFreePortAndWait(
  port: number,
  opts: {
    /** Total wait budget across signals. */
    timeoutMs?: number;
    /** Poll interval for checking whether lsof reports listeners. */
    intervalMs?: number;
    /** How long to wait after SIGTERM before escalating to SIGKILL. */
    sigtermTimeoutMs?: number;
  } = {},
): Promise<ForceFreePortResult> {
  const timeoutMs = Math.max(opts.timeoutMs ?? 1500, 0);
  const intervalMs = Math.max(opts.intervalMs ?? 100, 1);
  const sigtermTimeoutMs = Math.min(Math.max(opts.sigtermTimeoutMs ?? 600, 0), timeoutMs);

  const killed = forceFreePort(port);
  if (killed.length === 0) {
    return { killed, waitedMs: 0, escalatedToSigkill: false };
  }

  let waitedMs = 0;
  const triesSigterm = intervalMs > 0 ? Math.ceil(sigtermTimeoutMs / intervalMs) : 0;
  for (let i = 0; i < triesSigterm; i++) {
    if (listPortListeners(port).length === 0) {
      return { killed, waitedMs, escalatedToSigkill: false };
    }
    await sleep(intervalMs);
    waitedMs += intervalMs;
  }

  if (listPortListeners(port).length === 0) {
    return { killed, waitedMs, escalatedToSigkill: false };
  }

  const remaining = listPortListeners(port);
  killPids(remaining, "SIGKILL");

  const remainingBudget = Math.max(timeoutMs - waitedMs, 0);
  const triesSigkill = intervalMs > 0 ? Math.ceil(remainingBudget / intervalMs) : 0;
  for (let i = 0; i < triesSigkill; i++) {
    if (listPortListeners(port).length === 0) {
      return { killed, waitedMs, escalatedToSigkill: true };
    }
    await sleep(intervalMs);
    waitedMs += intervalMs;
  }

  const still = listPortListeners(port);
  if (still.length === 0) {
    return { killed, waitedMs, escalatedToSigkill: true };
  }

  throw new Error(
    `port ${port} still has listeners after --force: ${still.map((p) => p.pid).join(", ")}`,
  );
}
