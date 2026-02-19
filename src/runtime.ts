import { isEpipeError } from "./logging/console.js";
import { clearActiveProgressLine } from "./terminal/progress-line.js";
import { restoreTerminalState } from "./terminal/restore.js";

export type RuntimeEnv = {
  log: typeof console.log;
  error: typeof console.error;
  exit: (code: number) => never;
};

function shouldEmitRuntimeLog(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VITEST !== "true") {
    return true;
  }
  if (env.OPENCLAWCN_TEST_RUNTIME_LOG === "1") {
    return true;
  }
  const maybeMockedLog = console.log as unknown as { mock?: unknown };
  return typeof maybeMockedLog.mock === "object";
}

/** 安全地清除进度行并写入控制台，管道断开时静默吞掉 EPIPE */
function safeConsoleWrite(sink: (...args: unknown[]) => void, args: unknown[]): void {
  try {
    clearActiveProgressLine();
    sink(...args);
  } catch (err) {
    if (!isEpipeError(err)) {
      throw err;
    }
  }
}

export const defaultRuntime: RuntimeEnv = {
  log: (...args: Parameters<typeof console.log>) => {
    if (!shouldEmitRuntimeLog()) {
      return;
    }
    safeConsoleWrite(console.log, args);
  },
  error: (...args: Parameters<typeof console.error>) => {
    safeConsoleWrite(console.error, args);
  },
  exit: (code) => {
    restoreTerminalState("runtime exit", { resumeStdinIfPaused: false });
    process.exit(code);
    throw new Error("unreachable"); // satisfies tests when mocked
  },
};

export function createNonExitingRuntime(): RuntimeEnv {
  return {
    log: (...args: Parameters<typeof console.log>) => {
      if (!shouldEmitRuntimeLog()) {
        return;
      }
      safeConsoleWrite(console.log, args);
    },
    error: (...args: Parameters<typeof console.error>) => {
      safeConsoleWrite(console.error, args);
    },
    exit: (code: number): never => {
      throw new Error(`exit ${code}`);
    },
  };
}
