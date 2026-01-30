import type { Command } from "commander";
import { DEFAULT_CHAT_CHANNEL } from "../../channels/registry.js";
import { agentCliCommand } from "../../commands/agent-via-gateway.js";
import {
  agentsAddCommand,
  agentsDeleteCommand,
  agentsListCommand,
  agentsSetIdentityCommand,
} from "../../commands/agents.js";
import { setVerbose } from "../../globals.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { hasExplicitOptions } from "../command-options.js";
import { formatHelpExamples } from "../help-format.js";
import { createDefaultDeps } from "../deps.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { collectOption } from "./helpers.js";

export function registerAgentCommands(program: Command, args: { agentChannelOptions: string }) {
  program
    .command("agent")
    .description(t("cli.agent.description"))
    .requiredOption("-m, --message <text>", t("cli.agent.message"))
    .option("-t, --to <number>", t("cli.agent.to"))
    .option("--session-id <id>", t("cli.agent.sessionId"))
    .option("--agent <id>", t("cli.agent.agentId"))
    .option("--thinking <level>", t("cli.agent.thinking"))
    .option("--verbose <on|off>", t("cli.agent.verbose"))
    .option(
      "--channel <channel>",
      t("cli.agent.channel", { options: args.agentChannelOptions, default: DEFAULT_CHAT_CHANNEL }),
    )
    .option("--reply-to <target>", t("cli.agent.replyTo"))
    .option("--reply-channel <channel>", t("cli.agent.replyChannel"))
    .option("--reply-account <id>", t("cli.agent.replyAccount"))
    .option("--local", t("cli.agent.local"), false)
    .option("--deliver", t("cli.agent.deliver"), false)
    .option("--json", t("cli.status.outputJson"), false)
    .option("--timeout <seconds>", t("cli.agent.timeout"))
    .addHelpText(
      "after",
      () =>
        `
${theme.heading(t("cli.status.examples"))}
${formatHelpExamples([
  ['clawdbot agent --to +15555550123 --message "status update"', t("cli.agent.exNewSession")],
  ['clawdbot agent --agent ops --message "Summarize logs"', t("cli.agent.exSpecificAgent")],
  [
    'clawdbot agent --session-id 1234 --message "Summarize inbox" --thinking medium',
    t("cli.agent.exThinking"),
  ],
  [
    'clawdbot agent --to +15555550123 --message "Trace logs" --verbose on --json',
    t("cli.agent.exVerbose"),
  ],
  ['clawdbot agent --to +15555550123 --message "Summon reply" --deliver', t("cli.agent.exDeliver")],
  [
    'clawdbot agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"',
    t("cli.agent.exReplyChannel"),
  ],
])}

${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/agent", "docs.clawd.bot/cli/agent")}`,
    )
    .action(async (opts) => {
      const verboseLevel = typeof opts.verbose === "string" ? opts.verbose.toLowerCase() : "";
      setVerbose(verboseLevel === "on");
      // Build default deps (keeps parity with other commands; future-proofing).
      const deps = createDefaultDeps();
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentCliCommand(opts, defaultRuntime, deps);
      });
    });

  const agents = program
    .command("agents")
    .description(t("cli.agents.description"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("common.docs") + ":")} ${formatDocsLink("/cli/agents", "docs.clawd.bot/cli/agents")}\n`,
    );

  agents
    .command("list")
    .description(t("cli.agents.list"))
    .option("--json", t("cli.agents.listJson"), false)
    .option("--bindings", t("cli.agents.listBindings"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsListCommand(
          { json: Boolean(opts.json), bindings: Boolean(opts.bindings) },
          defaultRuntime,
        );
      });
    });

  agents
    .command("add [name]")
    .description(t("cli.agents.add"))
    .option("--workspace <dir>", t("cli.agents.addWorkspace"))
    .option("--model <id>", t("cli.agents.addModel"))
    .option("--agent-dir <dir>", t("cli.agents.addAgentDir"))
    .option("--bind <channel[:accountId]>", t("cli.agents.addBind"), collectOption, [])
    .option("--non-interactive", t("cli.agents.addNonInteractive"), false)
    .option("--json", t("cli.onboard.json"), false)
    .action(async (name, opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const hasFlags = hasExplicitOptions(command, [
          "workspace",
          "model",
          "agentDir",
          "bind",
          "nonInteractive",
        ]);
        await agentsAddCommand(
          {
            name: typeof name === "string" ? name : undefined,
            workspace: opts.workspace as string | undefined,
            model: opts.model as string | undefined,
            agentDir: opts.agentDir as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            nonInteractive: Boolean(opts.nonInteractive),
            json: Boolean(opts.json),
          },
          defaultRuntime,
          { hasFlags },
        );
      });
    });

  agents
    .command("set-identity")
    .description(t("cli.agents.setIdentity"))
    .option("--agent <id>", t("cli.agents.identityAgent"))
    .option("--workspace <dir>", t("cli.agents.identityWorkspace"))
    .option("--identity-file <path>", t("cli.agents.identityFile"))
    .option("--from-identity", t("cli.agents.fromIdentity"), false)
    .option("--name <name>", t("cli.agents.identityName"))
    .option("--theme <theme>", t("cli.agents.identityTheme"))
    .option("--emoji <emoji>", t("cli.agents.identityEmoji"))
    .option("--avatar <value>", t("cli.agents.identityAvatar"))
    .option("--json", t("cli.onboard.json"), false)
    .addHelpText(
      "after",
      () =>
        `
${theme.heading(t("cli.status.examples"))}
${formatHelpExamples([
  ['clawdbot agents set-identity --agent main --name "Clawd" --emoji "🦞"', t("cli.agents.exSetName")],
  ["clawdbot agents set-identity --agent main --avatar avatars/clawd.png", t("cli.agents.exSetAvatar")],
  ["clawdbot agents set-identity --workspace ~/clawd --from-identity", t("cli.agents.exFromIdentity")],
  [
    "clawdbot agents set-identity --identity-file ~/clawd/IDENTITY.md --agent main",
    t("cli.agents.exIdentityFile"),
  ],
])}
`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsSetIdentityCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            identityFile: opts.identityFile as string | undefined,
            fromIdentity: Boolean(opts.fromIdentity),
            name: opts.name as string | undefined,
            theme: opts.theme as string | undefined,
            emoji: opts.emoji as string | undefined,
            avatar: opts.avatar as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("delete <id>")
    .description(t("cli.agents.delete"))
    .option("--force", t("cli.agents.deleteForce"), false)
    .option("--json", t("cli.onboard.json"), false)
    .action(async (id, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsDeleteCommand(
          {
            id: String(id),
            force: Boolean(opts.force),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await agentsListCommand({}, defaultRuntime);
    });
  });
}
