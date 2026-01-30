import type { Command } from "commander";
import type { GatewayDaemonRuntime } from "../../commands/daemon-runtime.js";
import { onboardCommand } from "../../commands/onboard.js";
import type {
  AuthChoice,
  GatewayAuthChoice,
  GatewayBind,
  NodeManagerChoice,
  TailscaleMode,
} from "../../commands/onboard-types.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

function resolveInstallDaemonFlag(
  command: unknown,
  opts: { installDaemon?: boolean },
): boolean | undefined {
  if (!command || typeof command !== "object") return undefined;
  const getOptionValueSource =
    "getOptionValueSource" in command ? command.getOptionValueSource : undefined;
  if (typeof getOptionValueSource !== "function") return undefined;

  // Commander doesn't support option conflicts natively; keep original behavior.
  // If --skip-daemon is explicitly passed, it wins.
  if (getOptionValueSource.call(command, "skipDaemon") === "cli") return false;
  if (getOptionValueSource.call(command, "installDaemon") === "cli") {
    return Boolean(opts.installDaemon);
  }
  return undefined;
}

export function registerOnboardCommand(program: Command) {
  program
    .command("onboard")
    .description(t("cli.onboard.description"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/onboard", "docs.clawd.bot/cli/onboard")}\n`,
    )
    .option("--workspace <dir>", t("cli.onboard.workspace"))
    .option("--reset", t("cli.onboard.reset"))
    .option("--non-interactive", t("cli.onboard.nonInteractive"), false)
    .option("--accept-risk", t("cli.onboard.acceptRisk"), false)
    .option("--flow <flow>", t("cli.onboard.flow"))
    .option("--mode <mode>", t("cli.onboard.mode"))
    .option("--auth-choice <choice>", t("cli.onboard.authChoice"))
    .option("--token-provider <id>", t("cli.onboard.tokenProvider"))
    .option("--token <token>", t("cli.onboard.token"))
    .option("--token-profile-id <id>", t("cli.onboard.tokenProfileId"))
    .option("--token-expires-in <duration>", t("cli.onboard.tokenExpiresIn"))
    .option("--anthropic-api-key <key>", "Anthropic API key")
    .option("--openai-api-key <key>", "OpenAI API key")
    .option("--openrouter-api-key <key>", "OpenRouter API key")
    .option("--ai-gateway-api-key <key>", "Vercel AI Gateway API key")
    .option("--moonshot-api-key <key>", "Moonshot API key")
    .option("--kimi-code-api-key <key>", "Kimi Code API key")
    .option("--gemini-api-key <key>", "Gemini API key")
    .option("--zai-api-key <key>", "Z.AI API key")
    .option("--minimax-api-key <key>", "MiniMax API key")
    .option("--synthetic-api-key <key>", "Synthetic API key")
    .option("--venice-api-key <key>", "Venice API key")
    .option("--opencode-zen-api-key <key>", "OpenCode Zen API key")
    .option("--gateway-port <port>", t("cli.onboard.gatewayPort"))
    .option("--gateway-bind <mode>", t("cli.onboard.gatewayBind"))
    .option("--gateway-auth <mode>", t("cli.onboard.gatewayAuth"))
    .option("--gateway-token <token>", t("cli.onboard.gatewayToken"))
    .option("--gateway-password <password>", t("cli.onboard.gatewayPassword"))
    .option("--remote-url <url>", t("cli.onboard.remoteUrl"))
    .option("--remote-token <token>", t("cli.onboard.remoteToken"))
    .option("--tailscale <mode>", t("cli.onboard.tailscale"))
    .option("--tailscale-reset-on-exit", t("cli.onboard.tailscaleResetOnExit"))
    .option("--install-daemon", t("cli.onboard.installDaemon"))
    .option("--no-install-daemon", t("cli.onboard.skipDaemon"))
    .option("--skip-daemon", t("cli.onboard.skipDaemon"))
    .option("--daemon-runtime <runtime>", t("cli.onboard.daemonRuntime"))
    .option("--skip-channels", t("cli.onboard.skipChannels"))
    .option("--skip-skills", t("cli.onboard.skipSkills"))
    .option("--skip-health", t("cli.onboard.skipHealth"))
    .option("--skip-ui", t("cli.onboard.skipUi"))
    .option("--node-manager <name>", t("cli.onboard.nodeManager"))
    .option("--json", t("cli.onboard.json"), false)
    .action(async (opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const installDaemon = resolveInstallDaemonFlag(command, {
          installDaemon: Boolean(opts.installDaemon),
        });
        const gatewayPort =
          typeof opts.gatewayPort === "string" ? Number.parseInt(opts.gatewayPort, 10) : undefined;
        await onboardCommand(
          {
            workspace: opts.workspace as string | undefined,
            nonInteractive: Boolean(opts.nonInteractive),
            acceptRisk: Boolean(opts.acceptRisk),
            flow: opts.flow as "quickstart" | "advanced" | "manual" | undefined,
            mode: opts.mode as "local" | "remote" | undefined,
            authChoice: opts.authChoice as AuthChoice | undefined,
            tokenProvider: opts.tokenProvider as string | undefined,
            token: opts.token as string | undefined,
            tokenProfileId: opts.tokenProfileId as string | undefined,
            tokenExpiresIn: opts.tokenExpiresIn as string | undefined,
            anthropicApiKey: opts.anthropicApiKey as string | undefined,
            openaiApiKey: opts.openaiApiKey as string | undefined,
            openrouterApiKey: opts.openrouterApiKey as string | undefined,
            aiGatewayApiKey: opts.aiGatewayApiKey as string | undefined,
            moonshotApiKey: opts.moonshotApiKey as string | undefined,
            kimiCodeApiKey: opts.kimiCodeApiKey as string | undefined,
            geminiApiKey: opts.geminiApiKey as string | undefined,
            zaiApiKey: opts.zaiApiKey as string | undefined,
            minimaxApiKey: opts.minimaxApiKey as string | undefined,
            syntheticApiKey: opts.syntheticApiKey as string | undefined,
            veniceApiKey: opts.veniceApiKey as string | undefined,
            opencodeZenApiKey: opts.opencodeZenApiKey as string | undefined,
            gatewayPort:
              typeof gatewayPort === "number" && Number.isFinite(gatewayPort)
                ? gatewayPort
                : undefined,
            gatewayBind: opts.gatewayBind as GatewayBind | undefined,
            gatewayAuth: opts.gatewayAuth as GatewayAuthChoice | undefined,
            gatewayToken: opts.gatewayToken as string | undefined,
            gatewayPassword: opts.gatewayPassword as string | undefined,
            remoteUrl: opts.remoteUrl as string | undefined,
            remoteToken: opts.remoteToken as string | undefined,
            tailscale: opts.tailscale as TailscaleMode | undefined,
            tailscaleResetOnExit: Boolean(opts.tailscaleResetOnExit),
            reset: Boolean(opts.reset),
            installDaemon,
            daemonRuntime: opts.daemonRuntime as GatewayDaemonRuntime | undefined,
            skipChannels: Boolean(opts.skipChannels),
            skipSkills: Boolean(opts.skipSkills),
            skipHealth: Boolean(opts.skipHealth),
            skipUi: Boolean(opts.skipUi),
            nodeManager: opts.nodeManager as NodeManagerChoice | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });
}
