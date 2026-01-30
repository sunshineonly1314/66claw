import type { Command } from "commander";
import { healthCommand } from "../../commands/health.js";
import { sessionsCommand } from "../../commands/sessions.js";
import { statusCommand } from "../../commands/status.js";
import { setVerbose } from "../../globals.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";
import { parsePositiveIntOrUndefined } from "./helpers.js";

function resolveVerbose(opts: { verbose?: boolean; debug?: boolean }): boolean {
  return Boolean(opts.verbose || opts.debug);
}

function parseTimeoutMs(timeout: unknown): number | null | undefined {
  const parsed = parsePositiveIntOrUndefined(timeout);
  if (timeout !== undefined && parsed === undefined) {
    defaultRuntime.error("--timeout must be a positive integer (milliseconds)");
    defaultRuntime.exit(1);
    return null;
  }
  return parsed;
}

export function registerStatusHealthSessionsCommands(program: Command) {
  program
    .command("status")
    .description(t("cli.status.showChannelHealth"))
    .option("--json", t("cli.status.outputJson"), false)
    .option("--all", t("cli.status.fullDiagnosis"), false)
    .option("--usage", t("cli.status.showUsage"), false)
    .option("--deep", t("cli.status.probeChannels"), false)
    .option("--timeout <ms>", t("cli.status.probeTimeout"), "10000")
    .option("--verbose", t("cli.status.verboseLogging"), false)
    .option("--debug", t("cli.status.debugAlias"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli.status.examples"))}\n${formatHelpExamples([
          ["clawdbot status", t("cli.status.exHealthSummary")],
          ["clawdbot status --all", t("cli.status.exFullDiagnosis")],
          ["clawdbot status --json", t("cli.status.exJsonOutput")],
          ["clawdbot status --usage", t("cli.status.exUsage")],
          ["clawdbot status --deep", t("cli.status.exDeep")],
          ["clawdbot status --deep --timeout 5000", t("cli.status.exTimeout")],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/status", "docs.clawd.bot/cli/status")}\n`,
    )
    .action(async (opts) => {
      const verbose = resolveVerbose(opts);
      setVerbose(verbose);
      const timeout = parseTimeoutMs(opts.timeout);
      if (timeout === null) {
        return;
      }
      await runCommandWithRuntime(defaultRuntime, async () => {
        await statusCommand(
          {
            json: Boolean(opts.json),
            all: Boolean(opts.all),
            deep: Boolean(opts.deep),
            usage: Boolean(opts.usage),
            timeoutMs: timeout,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("health")
    .description(t("cli.health.fetchHealth"))
    .option("--json", t("cli.status.outputJson"), false)
    .option("--timeout <ms>", t("cli.health.connectionTimeout"), "10000")
    .option("--verbose", t("cli.status.verboseLogging"), false)
    .option("--debug", t("cli.status.debugAlias"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/health", "docs.clawd.bot/cli/health")}\n`,
    )
    .action(async (opts) => {
      const verbose = resolveVerbose(opts);
      setVerbose(verbose);
      const timeout = parseTimeoutMs(opts.timeout);
      if (timeout === null) {
        return;
      }
      await runCommandWithRuntime(defaultRuntime, async () => {
        await healthCommand(
          {
            json: Boolean(opts.json),
            timeoutMs: timeout,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("sessions")
    .description(t("cli.sessions.listSessions"))
    .option("--json", t("cli.sessions.outputJson"), false)
    .option("--verbose", t("cli.status.verboseLogging"), false)
    .option("--store <path>", t("cli.sessions.storePath"))
    .option("--active <minutes>", t("cli.sessions.activeMinutes"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli.status.examples"))}\n${formatHelpExamples([
          ["clawdbot sessions", t("cli.sessions.exList")],
          ["clawdbot sessions --active 120", t("cli.sessions.exActive")],
          ["clawdbot sessions --json", t("cli.status.exJsonOutput")],
          ["clawdbot sessions --store ./tmp/sessions.json", t("cli.sessions.exStore")],
        ])}\n\n${theme.muted(t("cli.sessions.tokenNote"))}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/sessions", "docs.clawd.bot/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          active: opts.active as string | undefined,
        },
        defaultRuntime,
      );
    });
}
