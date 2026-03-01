import { inspectPortUsage } from "./ports-inspect.js";
import { runCommandWithTimeout } from "../process/exec.js";

/**
 * Kill any process occupying the given port, including its process tree.
 *
 * - Windows: `taskkill /F /T /PID <pid>` (force kill entire tree)
 * - macOS/Linux: `kill -9 -<pid>` (process group) + `kill -9 <pid>` (fallback)
 *
 * Returns true if a process was found and a kill was attempted.
 */
export async function killPortOccupant(port: number): Promise<boolean> {
  const usage = await inspectPortUsage(port);
  if (usage.status !== "busy" || usage.listeners.length === 0) {
    return false;
  }

  const myPid = process.pid;
  let killed = false;

  for (const listener of usage.listeners) {
    const pid = listener.pid;
    if (!pid || pid === 0 || pid === 1 || pid === myPid) {
      continue;
    }

    const label = listener.command || listener.commandLine || `PID ${pid}`;
    console.log(`[PortKill] Found process ${pid} (${label}) occupying port ${port}, killing...`);

    try {
      if (process.platform === "win32") {
        await runCommandWithTimeout(["taskkill", "/F", "/T", "/PID", String(pid)], {
          timeoutMs: 5_000,
        });
      } else {
        // Kill process group first (catches child processes)
        await runCommandWithTimeout(["kill", "-9", `-${pid}`], { timeoutMs: 5_000 }).catch(
          () => {},
        );
        // Fallback: kill the process directly
        await runCommandWithTimeout(["kill", "-9", String(pid)], { timeoutMs: 5_000 }).catch(
          () => {},
        );
      }
      killed = true;
    } catch {
      console.warn(`[PortKill] Failed to kill process ${pid} on port ${port}`);
    }
  }

  if (killed) {
    // Wait for OS to release the port
    await new Promise((r) => setTimeout(r, 1500));
  }

  return killed;
}
