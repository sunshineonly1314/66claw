import type { startGatewayServer } from "../../gateway/server.js";
import { acquireGatewayLock, GatewayLockError } from "../../infra/gateway-lock.js";
import {
  consumeGatewaySigusr1RestartAuthorization,
  isGatewaySigusr1RestartExternallyAllowed,
} from "../../infra/restart.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { defaultRuntime } from "../../runtime.js";

const gatewayLog = createSubsystemLogger("gateway");

/**
 * Graceful shutdown timeout in milliseconds.
 * The gateway close handler (server-close.ts) drains WebSocket connections
 * and HTTP servers with 2s timeouts each. 15s gives enough headroom for
 * channel plugins, MCP servers, and other cleanup that may run in parallel.
 * If shutdown is still stuck after this, we force-exit with code 124.
 */
const SHUTDOWN_TIMEOUT_MS = 15_000;

type GatewayRunSignalAction = "stop" | "restart";

export async function runGatewayLoop(params: {
  start: () => Promise<Awaited<ReturnType<typeof startGatewayServer>>>;
  runtime: typeof defaultRuntime;
}) {
  const lock = await acquireGatewayLock();
  let server: Awaited<ReturnType<typeof startGatewayServer>> | null = null;
  let shuttingDown = false;
  let restartResolver: (() => void) | null = null;

  // ── Global safety net ──
  // Catch any unhandled promise rejection that slips through individual
  // try-catch blocks.  Without this, Node 22+ terminates with exit code 1
  // and the watchdog has no context on what went wrong.
  const onUnhandledRejection = (reason: unknown) => {
    gatewayLog.error(
      `unhandled promise rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
    );
  };
  process.on("unhandledRejection", onUnhandledRejection);

  const onUncaughtException = (err: Error) => {
    gatewayLog.error(`uncaught exception: ${err.stack ?? err.message}`);
    // Give log output a moment to flush before exiting
    setTimeout(() => params.runtime.exit(1), 500).unref?.();
  };
  process.on("uncaughtException", onUncaughtException);

  const cleanupSignals = () => {
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGUSR1", onSigusr1);
    process.removeListener("unhandledRejection", onUnhandledRejection);
    process.removeListener("uncaughtException", onUncaughtException);
  };

  const request = (action: GatewayRunSignalAction, signal: string) => {
    if (shuttingDown) {
      gatewayLog.info(`received ${signal} during shutdown; ignoring`);
      return;
    }
    shuttingDown = true;
    const isRestart = action === "restart";
    gatewayLog.info(`received ${signal}; ${isRestart ? "restarting" : "shutting down"}`);

    const forceExitTimer = setTimeout(() => {
      gatewayLog.error(
        `shutdown timed out after ${SHUTDOWN_TIMEOUT_MS / 1000}s; exiting without full cleanup`,
      );
      cleanupSignals();
      // Use non-zero exit code (124 = timeout convention) so the watchdog
      // recognizes this was not a clean shutdown.
      params.runtime.exit(124);
    }, SHUTDOWN_TIMEOUT_MS);
    // Don't let this timer keep the process alive if everything else
    // cleans up before the timeout fires.
    forceExitTimer.unref?.();

    void (async () => {
      try {
        await server?.close({
          reason: isRestart ? "gateway restarting" : "gateway stopping",
          restartExpectedMs: isRestart ? 1500 : null,
        });
      } catch (err) {
        gatewayLog.error(`shutdown error: ${String(err)}`);
      } finally {
        clearTimeout(forceExitTimer);
        server = null;
        if (isRestart) {
          shuttingDown = false;
          restartResolver?.();
        } else {
          cleanupSignals();
          params.runtime.exit(0);
        }
      }
    })();
  };

  const onSigterm = () => {
    gatewayLog.info("signal SIGTERM received");
    request("stop", "SIGTERM");
  };
  const onSigint = () => {
    gatewayLog.info("signal SIGINT received");
    request("stop", "SIGINT");
  };
  const onSigusr1 = () => {
    gatewayLog.info("signal SIGUSR1 received");
    const authorized = consumeGatewaySigusr1RestartAuthorization();
    if (!authorized && !isGatewaySigusr1RestartExternallyAllowed()) {
      gatewayLog.warn(
        "SIGUSR1 restart ignored (not authorized; enable commands.restart or use gateway tool).",
      );
      return;
    }
    request("restart", "SIGUSR1");
  };

  process.on("SIGTERM", onSigterm);
  process.on("SIGINT", onSigint);
  process.on("SIGUSR1", onSigusr1);

  try {
    // Keep process alive; SIGUSR1 triggers an in-process restart (no supervisor required).
    // SIGTERM/SIGINT still exit after a graceful shutdown.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        server = await params.start();
      } catch (startErr) {
        // Fatal errors that cannot be resolved by retrying — propagate
        // immediately so the caller (run.ts) can display diagnostics.
        if (startErr instanceof GatewayLockError) {
          throw startErr;
        }
        const errCode = (startErr as NodeJS.ErrnoException)?.code;
        if (errCode === "EADDRINUSE") {
          // Port temporarily occupied — retry after a short delay
          gatewayLog.error(
            `gateway start failed (EADDRINUSE): ${startErr instanceof Error ? startErr.message : String(startErr)}`,
          );
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        // All other startup errors are considered fatal
        throw startErr;
      }
      await new Promise<void>((resolve) => {
        restartResolver = resolve;
      });
    }
  } finally {
    await lock?.release();
    cleanupSignals();
  }
}
