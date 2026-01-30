import { z } from "zod";

import {
  BlueBubblesConfigSchema,
  DiscordConfigSchema,
  GoogleChatConfigSchema,
  IMessageConfigSchema,
  MSTeamsConfigSchema,
  SignalConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema,
} from "./zod-schema.providers-core.js";
import { WhatsAppConfigSchema } from "./zod-schema.providers-whatsapp.js";
import {
  FeishuConfigSchema,
  DingtalkConfigSchema,
  WecomConfigSchema,
} from "./zod-schema.providers-cn.js";
import { GroupPolicySchema } from "./zod-schema.core.js";
import { ChannelHeartbeatVisibilitySchema } from "./zod-schema.channels.js";

export * from "./zod-schema.providers-core.js";
export * from "./zod-schema.providers-whatsapp.js";
export * from "./zod-schema.providers-cn.js";
export { ChannelHeartbeatVisibilitySchema } from "./zod-schema.channels.js";

export const ChannelsSchema = z
  .object({
    defaults: z
      .object({
        groupPolicy: GroupPolicySchema.optional(),
        heartbeat: ChannelHeartbeatVisibilitySchema,
      })
      .strict()
      .optional(),
    whatsapp: WhatsAppConfigSchema.optional(),
    telegram: TelegramConfigSchema.optional(),
    discord: DiscordConfigSchema.optional(),
    googlechat: GoogleChatConfigSchema.optional(),
    slack: SlackConfigSchema.optional(),
    signal: SignalConfigSchema.optional(),
    imessage: IMessageConfigSchema.optional(),
    bluebubbles: BlueBubblesConfigSchema.optional(),
    msteams: MSTeamsConfigSchema.optional(),
    // China region channels (中国区渠道)
    feishu: FeishuConfigSchema.optional(),
    dingtalk: DingtalkConfigSchema.optional(),
    wecom: WecomConfigSchema.optional(),
  })
  .passthrough() // Allow extension channel configs (nostr, matrix, zalo, etc.)
  .optional();
