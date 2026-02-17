import type {
    ChannelAccountSnapshot,
    ChannelsStatusSnapshot,
    ConfigUiHints,
    DiscordStatus,
    GoogleChatStatus,
    IMessageStatus,
    NostrProfile,
    NostrStatus,
    SignalStatus,
    SlackStatus,
    TelegramStatus,
    WhatsAppStatus,
} from "../types";
import type { NostrProfileFormState } from "./channels.nostr-profile-form";

export type ChannelKey = string;

// 飞书渠道状态类型
export type FeishuStatus = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  probe?: {
    ok?: boolean;
    status?: string;
    error?: string;
    tenant?: {
      name?: string;
    };
  } | null;
};

// 钉钉渠道状态类型
export type DingtalkStatus = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  probe?: {
    ok?: boolean;
    status?: string;
    error?: string;
    corp?: {
      name?: string;
    };
  } | null;
};

// 企业微信渠道状态类型
export type WecomStatus = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  probe?: {
    ok?: boolean;
    status?: string;
    error?: string;
    corp?: {
      name?: string;
    };
  } | null;
};

// QQ 机器人渠道状态类型
export type QqbotStatus = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  probe?: {
    ok?: boolean;
    status?: string;
    error?: string;
    botInfo?: {
      id?: string;
      username?: string;
    };
  } | null;
};

// 个人微信渠道状态类型（通过 ClawChat 桥接）
export type OpenclawwechatStatus = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
};

export type ChannelsProps = {
  connected: boolean;
  loading: boolean;
  snapshot: ChannelsStatusSnapshot | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  whatsappMessage: string | null;
  whatsappQrDataUrl: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  configSchema: unknown | null;
  configSchemaLoading: boolean;
  configForm: Record<string, unknown> | null;
  configUiHints: ConfigUiHints;
  configSaving: boolean;
  configFormDirty: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  onRefresh: (probe: boolean) => void;
  onWhatsAppStart: (force: boolean) => void;
  onWhatsAppWait: () => void;
  onWhatsAppLogout: () => void;
  onConfigPatch: (path: Array<string | number>, value: unknown) => void;
  onConfigSave: () => void;
  onConfigReload: () => void;
  onNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  onNostrProfileCancel: () => void;
  onNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  onNostrProfileSave: () => void;
  onNostrProfileImport: () => void;
  onNostrProfileToggleAdvanced: () => void;
};

export type ChannelsChannelData = {
  feishu?: FeishuStatus;
  dingtalk?: DingtalkStatus;
  wecom?: WecomStatus;
  qqbot?: QqbotStatus;
  openclawwechat?: OpenclawwechatStatus;
  whatsapp?: WhatsAppStatus;
  telegram?: TelegramStatus;
  discord?: DiscordStatus | null;
  googlechat?: GoogleChatStatus | null;
  slack?: SlackStatus | null;
  signal?: SignalStatus | null;
  imessage?: IMessageStatus | null;
  nostr?: NostrStatus | null;
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null;
};
