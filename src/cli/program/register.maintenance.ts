import type { Command } from "commander";
import { dashboardCommand } from "../../commands/dashboard.js";
import { doctorCommand } from "../../commands/doctor.js";
import { resetCommand } from "../../commands/reset.js";
import { uninstallCommand } from "../../commands/uninstall.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerMaintenanceCommands(program: Command) {
  program
    .command("doctor")
    .description(t("cli.doctor.healthChecks"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/doctor", "docs.clawd.bot/cli/doctor")}\n`,
    )
    .option("--no-workspace-suggestions", t("cli.doctor.noWorkspaceSuggestions"), false)
    .option("--yes", t("cli.doctor.yes"), false)
    .option("--repair", t("cli.doctor.repair"), false)
    .option("--fix", t("cli.doctor.fix"), false)
    .option("--force", t("cli.doctor.force"), false)
    .option("--non-interactive", t("cli.doctor.nonInteractive"), false)
    .option("--generate-gateway-token", t("cli.doctor.generateToken"), false)
    .option("--deep", t("cli.doctor.deep"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await doctorCommand(defaultRuntime, {
          workspaceSuggestions: opts.workspaceSuggestions,
          yes: Boolean(opts.yes),
          repair: Boolean(opts.repair) || Boolean(opts.fix),
          force: Boolean(opts.force),
          nonInteractive: Boolean(opts.nonInteractive),
          generateGatewayToken: Boolean(opts.generateGatewayToken),
          deep: Boolean(opts.deep),
        });
      });
    });

  program
    .command("dashboard")
    .description(t("cli.dashboard.openControlUi"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/dashboard", "docs.clawd.bot/cli/dashboard")}\n`,
    )
    .option("--no-open", t("cli.dashboard.noOpen"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await dashboardCommand(defaultRuntime, {
          noOpen: Boolean(opts.noOpen),
        });
      });
    });

  program
    .command("reset")
    .description(t("cli.reset.resetLocalConfig"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/reset", "docs.clawd.bot/cli/reset")}\n`,
    )
    .option("--scope <scope>", t("cli.reset.scope"))
    .option("--yes", t("cli.reset.skipConfirm"), false)
    .option("--non-interactive", t("cli.reset.disablePrompts"), false)
    .option("--dry-run", t("cli.reset.dryRun"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await resetCommand(defaultRuntime, {
          scope: opts.scope,
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });

  program
    .command("uninstall")
    .description(t("cli.uninstall.uninstallService"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/uninstall", "docs.clawd.bot/cli/uninstall")}\n`,
    )
    .option("--service", t("cli.uninstall.service"), false)
    .option("--state", t("cli.uninstall.state"), false)
    .option("--workspace", t("cli.uninstall.workspace"), false)
    .option("--app", t("cli.uninstall.app"), false)
    .option("--all", t("cli.uninstall.all"), false)
    .option("--yes", t("cli.reset.skipConfirm"), false)
    .option("--non-interactive", t("cli.reset.disablePrompts"), false)
    .option("--dry-run", t("cli.reset.dryRun"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await uninstallCommand(defaultRuntime, {
          service: Boolean(opts.service),
          state: Boolean(opts.state),
          workspace: Boolean(opts.workspace),
          app: Boolean(opts.app),
          all: Boolean(opts.all),
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });
}
