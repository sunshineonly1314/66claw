import type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelId,
  ChannelOutboundAdapter,
  ChannelPlugin,
} from "../channels/plugins/types.js";
import type { PluginRegistry } from "../plugins/registry.js";

export const createTestRegistry = (channels: PluginRegistry["channels"] = []): PluginRegistry => ({
  plugins: [],
  tools: [],
  hooks: [],
  typedHooks: [],
  channels,
  providers: [],
  gatewayHandlers: {},
  httpHandlers: [],
  httpRoutes: [],
  cliRegistrars: [],
  services: [],
  commands: [],
  diagnostics: [],
});

export const createIMessageTestPlugin = (): ChannelPlugin => ({
  id: "imessage" as ChannelId,
  meta: {
    id: "imessage" as ChannelId,
    label: "iMessage",
    selectionLabel: "iMessage",
    docsPath: "/platforms/mac",
    blurb: "test stub.",
    aliases: ["imsg"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => ["default"],
    resolveAccount: () => ({}),
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ deps, to, text }) => {
      const send = deps?.sendIMessage;
      if (!send) {
        throw new Error("sendIMessage missing");
      }
      const result = await send(to, text, {});
      return { channel: "imessage" as ChannelId, ...result };
    },
    sendMedia: async ({ deps, to, text, mediaUrl }) => {
      const send = deps?.sendIMessage;
      if (!send) {
        throw new Error("sendIMessage missing");
      }
      const result = await send(to, text, { mediaUrl });
      return { channel: "imessage" as ChannelId, ...result };
    },
  },
  status: {
    collectStatusIssues: (accounts: ChannelAccountSnapshot[]) =>
      accounts
        .filter(
          (account) =>
            typeof (account as Record<string, unknown>).lastError === "string" &&
            (account as Record<string, unknown>).lastError,
        )
        .map((account) => ({
          channel: "imessage" as ChannelId,
          accountId: typeof account.accountId === "string" ? account.accountId : "default",
          kind: "runtime" as const,
          message: `Channel error: ${String((account as Record<string, unknown>).lastError)}`,
        })),
  },
});

export const createOutboundTestPlugin = (params: {
  id: ChannelId;
  outbound: ChannelOutboundAdapter;
  label?: string;
  docsPath?: string;
  capabilities?: ChannelCapabilities;
}): ChannelPlugin => ({
  id: params.id,
  meta: {
    id: params.id,
    label: params.label ?? String(params.id),
    selectionLabel: params.label ?? String(params.id),
    docsPath: params.docsPath ?? `/channels/${params.id}`,
    blurb: "test stub.",
  },
  capabilities: params.capabilities ?? { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({}),
  },
  outbound: params.outbound,
});
