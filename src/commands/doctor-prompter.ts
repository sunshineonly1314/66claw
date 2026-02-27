import { confirm, select } from "@clack/prompts";
import type { RuntimeEnv } from "../runtime.js";
import { stylePromptHint, stylePromptMessage } from "../terminal/prompt-style.js";
import { guardCancel } from "./onboard-helpers.js";

export type DoctorOptions = {
  workspaceSuggestions?: boolean;
  yes?: boolean;
  nonInteractive?: boolean;
  deep?: boolean;
  repair?: boolean;
  force?: boolean;
  generateGatewayToken?: boolean;
};

export type DoctorPrompter = {
  confirm: (params: Parameters<typeof confirm>[0]) => Promise<boolean>;
  confirmRepair: (params: Parameters<typeof confirm>[0]) => Promise<boolean>;
  confirmAggressive: (params: Parameters<typeof confirm>[0]) => Promise<boolean>;
  confirmSkipInNonInteractive: (params: Parameters<typeof confirm>[0]) => Promise<boolean>;
  select: <T>(params: Parameters<typeof select>[0], fallback: T) => Promise<T>;
  shouldRepair: boolean;
  shouldForce: boolean;
};

export function createDoctorPrompter(params: {
  runtime: RuntimeEnv;
  options: DoctorOptions;
}): DoctorPrompter {
  const yes = params.options.yes === true;
  const requestedNonInteractive = params.options.nonInteractive === true;
  const shouldRepair = params.options.repair === true || yes;
  const shouldForce = params.options.force === true;
  const isTty = Boolean(process.stdin.isTTY);
  const nonInteractive = requestedNonInteractive || (!isTty && !yes);

  const canPrompt = isTty && !yes && !nonInteractive;
  const confirmDefault = async (p: Parameters<typeof confirm>[0]) => {
    // --fix / --yes: auto-apply safe repairs even in non-interactive mode.
    // This lets `doctor --fix --non-interactive` (e.g. from Tauri tray) actually
    // perform config migrations, auth profile fixes, etc., instead of skipping
    // everything.  Heavy operations (daemon install, sandbox build, permissions)
    // are still gated by confirmSkipInNonInteractive which has its own
    // nonInteractive guard.
    if (shouldRepair) {
      return true;
    }
    if (nonInteractive) {
      return false;
    }
    if (!canPrompt) {
      return Boolean(p.initialValue ?? false);
    }
    return guardCancel(
      await confirm({
        ...p,
        message: stylePromptMessage(p.message),
      }),
      params.runtime,
    );
  };

  return {
    confirm: confirmDefault,
    confirmRepair: async (p) => {
      // shouldRepair is already checked inside confirmDefault, so we only
      // need the nonInteractive guard for non-repair runs (plain doctor
      // piped to a non-TTY without --fix).
      if (nonInteractive && !shouldRepair) {
        return false;
      }
      return confirmDefault(p);
    },
    confirmAggressive: async (p) => {
      // Aggressive actions need --fix --force to auto-execute.
      // --fix alone returns false (safe default).
      if (shouldRepair && shouldForce) {
        return true;
      }
      if (shouldRepair && !shouldForce) {
        return false;
      }
      if (nonInteractive) {
        return false;
      }
      if (!canPrompt) {
        return Boolean(p.initialValue ?? false);
      }
      return guardCancel(
        await confirm({
          ...p,
          message: stylePromptMessage(p.message),
        }),
        params.runtime,
      );
    },
    confirmSkipInNonInteractive: async (p) => {
      if (nonInteractive) {
        return false;
      }
      if (shouldRepair) {
        return true;
      }
      return confirmDefault(p);
    },
    select: async <T>(p: Parameters<typeof select>[0], fallback: T) => {
      if (!canPrompt || shouldRepair) {
        return fallback;
      }
      return guardCancel(
        await select({
          ...p,
          message: stylePromptMessage(p.message),
          options: p.options.map((opt) =>
            opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
          ),
        }),
        params.runtime,
      ) as T;
    },
    shouldRepair,
    shouldForce,
  };
}
