import { Type } from "@sinclair/typebox";

import { NonEmptyString } from "./primitives.js";

export const ModelChoiceSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    provider: NonEmptyString,
    contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
    reasoning: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    identity: Type.Optional(
      Type.Object(
        {
          name: Type.Optional(NonEmptyString),
          theme: Type.Optional(NonEmptyString),
          emoji: Type.Optional(NonEmptyString),
          avatar: Type.Optional(NonEmptyString),
          avatarUrl: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const AgentsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const AgentsListResultSchema = Type.Object(
  {
    defaultId: NonEmptyString,
    mainKey: NonEmptyString,
    scope: Type.Union([Type.Literal("per-sender"), Type.Literal("global")]),
    agents: Type.Array(AgentSummarySchema),
  },
  { additionalProperties: false },
);

export const ModelsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const ModelsListResultSchema = Type.Object(
  {
    models: Type.Array(ModelChoiceSchema),
  },
  { additionalProperties: false },
);

export const SkillsStatusParamsSchema = Type.Object({}, { additionalProperties: false });

export const SkillsBinsParamsSchema = Type.Object({}, { additionalProperties: false });

export const SkillsBinsResultSchema = Type.Object(
  {
    bins: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsInstallParamsSchema = Type.Object(
  {
    name: NonEmptyString,
    installId: NonEmptyString,
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
  },
  { additionalProperties: false },
);

export const SkillsUpdateParamsSchema = Type.Object(
  {
    skillKey: NonEmptyString,
    enabled: Type.Optional(Type.Boolean()),
    apiKey: Type.Optional(Type.String()),
    env: Type.Optional(Type.Record(NonEmptyString, Type.String())),
  },
  { additionalProperties: false },
);

// Remote skills (Gitee registry)
export const SkillsRemoteListParamsSchema = Type.Object({}, { additionalProperties: false });

export const RemoteSkillMetaSchema = Type.Object(
  {
    name: NonEmptyString,
    description: Type.String(),
    emoji: Type.Optional(Type.String()),
    path: NonEmptyString,
    version: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    author: Type.Optional(Type.String()),
    installed: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const SkillsRemoteListResultSchema = Type.Object(
  {
    version: Type.Integer(),
    updated: Type.String(),
    skills: Type.Array(RemoteSkillMetaSchema),
  },
  { additionalProperties: false },
);

// Skills Market (local index based)
export const SkillsMarketListParamsSchema = Type.Object({}, { additionalProperties: false });

export const MarketSkillMetaSchema = Type.Object(
  {
    name: NonEmptyString,
    description: Type.String(),
    emoji: Type.Optional(Type.String()),
    path: NonEmptyString,
    version: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    author: Type.Optional(Type.String()),
    installed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SkillsMarketListResultSchema = Type.Object(
  {
    skills: Type.Array(MarketSkillMetaSchema),
    lastSyncedAt: Type.Union([Type.String(), Type.Null()]),
    syncing: Type.Boolean(),
    message: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const SkillsMarketRefreshParamsSchema = Type.Object({}, { additionalProperties: false });
