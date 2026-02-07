/**
 * 飞书多维表格工具
 * Feishu Bitable Tool
 *
 * 支持多维表格的读写操作
 * 融合自 m1heng/clawdbot-feishu (MIT License)
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { createFeishuClient, Lark } from "./client.js";
import type { FeishuChannelConfig } from "./types.js";

// ============================================================================
// 辅助函数
// ============================================================================

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

/** 字段类型 ID 到名称映射 */
const FIELD_TYPE_NAMES: Record<number, string> = {
  1: "Text",
  2: "Number",
  3: "SingleSelect",
  4: "MultiSelect",
  5: "DateTime",
  7: "Checkbox",
  11: "User",
  13: "Phone",
  15: "URL",
  17: "Attachment",
  18: "SingleLink",
  19: "Lookup",
  20: "Formula",
  21: "DuplexLink",
  22: "Location",
  23: "GroupChat",
  1001: "CreatedTime",
  1002: "ModifiedTime",
  1003: "CreatedUser",
  1004: "ModifiedUser",
  1005: "AutoNumber",
};

// ============================================================================
// 核心功能
// ============================================================================

/** 解析多维表格 URL 并提取 token */
function parseBitableUrl(url: string): { token: string; tableId?: string; isWiki: boolean } | null {
  try {
    const u = new URL(url);
    const tableId = u.searchParams.get("table") ?? undefined;

    // Wiki 格式: /wiki/XXXXX?table=YYY
    const wikiMatch = u.pathname.match(/\/wiki\/([A-Za-z0-9]+)/);
    if (wikiMatch) {
      return { token: wikiMatch[1], tableId, isWiki: true };
    }

    // Base 格式: /base/XXXXX?table=YYY
    const baseMatch = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
    if (baseMatch) {
      return { token: baseMatch[1], tableId, isWiki: false };
    }

    return null;
  } catch {
    return null;
  }
}

/** 从知识库节点获取 app_token */
async function getAppTokenFromWiki(
  client: ReturnType<typeof createFeishuClient>,
  nodeToken: string,
): Promise<string> {
  const res = await client.wiki.space.getNode({
    params: { token: nodeToken },
  });
  if (res.code !== 0) throw new Error(res.msg);

  const node = res.data?.node;
  if (!node) throw new Error("节点未找到");
  if (node.obj_type !== "bitable") {
    throw new Error(`节点不是多维表格 (类型: ${node.obj_type})`);
  }

  return node.obj_token!;
}

/** 从 URL 获取多维表格元数据 (支持 /base/ 和 /wiki/ 格式) */
async function getBitableMeta(
  client: ReturnType<typeof createFeishuClient>,
  url: string,
) {
  const parsed = parseBitableUrl(url);
  if (!parsed) {
    throw new Error("无效的 URL 格式。需要 /base/XXX 或 /wiki/XXX 格式的 URL");
  }

  let appToken: string;
  if (parsed.isWiki) {
    appToken = await getAppTokenFromWiki(client, parsed.token);
  } else {
    appToken = parsed.token;
  }

  // 获取多维表格信息
  const res = await client.bitable.app.get({
    path: { app_token: appToken },
  });
  if (res.code !== 0) throw new Error(res.msg);

  // 如果没有指定 table_id，列出所有表
  let tables: { table_id: string; name: string }[] = [];
  if (!parsed.tableId) {
    const tablesRes = await client.bitable.appTable.list({
      path: { app_token: appToken },
    });
    if (tablesRes.code === 0) {
      tables = (tablesRes.data?.items ?? []).map((t) => ({
        table_id: t.table_id!,
        name: t.name!,
      }));
    }
  }

  return {
    app_token: appToken,
    table_id: parsed.tableId,
    name: res.data?.app?.name,
    url_type: parsed.isWiki ? "wiki" : "base",
    ...(tables.length > 0 && { tables }),
    hint: parsed.tableId
      ? `使用 app_token="${appToken}" 和 table_id="${parsed.tableId}" 调用其他 bitable 工具`
      : `使用 app_token="${appToken}" 调用其他 bitable 工具。从 tables 列表中选择 table_id。`,
  };
}

/** 列出字段 */
async function listFields(
  client: ReturnType<typeof createFeishuClient>,
  appToken: string,
  tableId: string,
) {
  const res = await client.bitable.appTableField.list({
    path: { app_token: appToken, table_id: tableId },
  });
  if (res.code !== 0) throw new Error(res.msg);

  const fields = res.data?.items ?? [];
  return {
    fields: fields.map((f) => ({
      field_id: f.field_id,
      field_name: f.field_name,
      type: f.type,
      type_name: FIELD_TYPE_NAMES[f.type ?? 0] || `type_${f.type}`,
      is_primary: f.is_primary,
      ...(f.property && { property: f.property }),
    })),
    total: fields.length,
  };
}

/** 列出记录 */
async function listRecords(
  client: ReturnType<typeof createFeishuClient>,
  appToken: string,
  tableId: string,
  pageSize?: number,
  pageToken?: string,
) {
  const res = await client.bitable.appTableRecord.list({
    path: { app_token: appToken, table_id: tableId },
    params: {
      page_size: pageSize ?? 100,
      ...(pageToken && { page_token: pageToken }),
    },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    records: res.data?.items ?? [],
    has_more: res.data?.has_more ?? false,
    page_token: res.data?.page_token,
    total: res.data?.total,
  };
}

/** 获取单条记录 */
async function getRecord(
  client: ReturnType<typeof createFeishuClient>,
  appToken: string,
  tableId: string,
  recordId: string,
) {
  const res = await client.bitable.appTableRecord.get({
    path: { app_token: appToken, table_id: tableId, record_id: recordId },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    record: res.data?.record,
  };
}

/** 创建记录 */
async function createRecord(
  client: ReturnType<typeof createFeishuClient>,
  appToken: string,
  tableId: string,
  fields: Record<string, unknown>,
) {
  const res = await client.bitable.appTableRecord.create({
    path: { app_token: appToken, table_id: tableId },
    data: { fields },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    record: res.data?.record,
  };
}

/** 更新记录 */
async function updateRecord(
  client: ReturnType<typeof createFeishuClient>,
  appToken: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
) {
  const res = await client.bitable.appTableRecord.update({
    path: { app_token: appToken, table_id: tableId, record_id: recordId },
    data: { fields },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    record: res.data?.record,
  };
}

// ============================================================================
// Schema 定义
// ============================================================================

const GetMetaSchema = {
  type: "object" as const,
  properties: {
    url: {
      type: "string",
      description: "多维表格 URL。支持两种格式: /base/XXX?table=YYY 或 /wiki/XXX?table=YYY",
    },
  },
  required: ["url"],
};

const ListFieldsSchema = {
  type: "object" as const,
  properties: {
    app_token: {
      type: "string",
      description: "多维表格 app_token (使用 feishu_bitable_get_meta 从 URL 获取)",
    },
    table_id: {
      type: "string",
      description: "表格 ID (从 URL 参数 ?table=YYY 获取)",
    },
  },
  required: ["app_token", "table_id"],
};

const ListRecordsSchema = {
  type: "object" as const,
  properties: {
    app_token: {
      type: "string",
      description: "多维表格 app_token",
    },
    table_id: {
      type: "string",
      description: "表格 ID",
    },
    page_size: {
      type: "number",
      description: "每页记录数 (1-500，默认 100)",
      minimum: 1,
      maximum: 500,
    },
    page_token: {
      type: "string",
      description: "分页 token (来自上一次响应)",
    },
  },
  required: ["app_token", "table_id"],
};

const GetRecordSchema = {
  type: "object" as const,
  properties: {
    app_token: { type: "string", description: "多维表格 app_token" },
    table_id: { type: "string", description: "表格 ID" },
    record_id: { type: "string", description: "记录 ID" },
  },
  required: ["app_token", "table_id", "record_id"],
};

const CreateRecordSchema = {
  type: "object" as const,
  properties: {
    app_token: { type: "string", description: "多维表格 app_token" },
    table_id: { type: "string", description: "表格 ID" },
    fields: {
      type: "object",
      description:
        "字段值，以字段名为键。格式: Text='字符串', Number=123, SingleSelect='选项', MultiSelect=['A','B'], DateTime=时间戳毫秒, User=[{id:'ou_xxx'}], URL={text:'显示文本',link:'https://...'}",
    },
  },
  required: ["app_token", "table_id", "fields"],
};

const UpdateRecordSchema = {
  type: "object" as const,
  properties: {
    app_token: { type: "string", description: "多维表格 app_token" },
    table_id: { type: "string", description: "表格 ID" },
    record_id: { type: "string", description: "记录 ID" },
    fields: {
      type: "object",
      description: "要更新的字段值 (格式同 create_record)",
    },
  },
  required: ["app_token", "table_id", "record_id", "fields"],
};

// ============================================================================
// 工具注册
// ============================================================================

export function registerFeishuBitableTools(api: ClawdbotPluginApi) {
  const feishuCfg = api.config?.channels?.feishu as FeishuChannelConfig | undefined;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_bitable] 飞书凭证未配置，跳过多维表格工具注册");
    return;
  }

  const getClient = () => createFeishuClient(feishuCfg);

  // 工具 0: feishu_bitable_get_meta (解析 URL 辅助工具)
  api.registerTool(
    {
      name: "feishu_bitable_get_meta",
      label: "飞书多维表格元数据",
      description:
        "解析多维表格 URL 并获取 app_token, table_id 和表格列表。给定 /wiki/ 或 /base/ URL 时首先使用此工具。",
      parameters: GetMetaSchema,
      async execute(_toolCallId, params) {
        const { url } = params as { url: string };
        try {
          const result = await getBitableMeta(getClient(), url);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_bitable_get_meta" },
  );

  // 工具 1: feishu_bitable_list_fields
  api.registerTool(
    {
      name: "feishu_bitable_list_fields",
      label: "飞书多维表格字段",
      description: "列出多维表格中所有字段 (列) 及其类型和属性",
      parameters: ListFieldsSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id } = params as { app_token: string; table_id: string };
        try {
          const result = await listFields(getClient(), app_token, table_id);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_bitable_list_fields" },
  );

  // 工具 2: feishu_bitable_list_records
  api.registerTool(
    {
      name: "feishu_bitable_list_records",
      label: "飞书多维表格记录列表",
      description: "列出多维表格中的记录 (行)，支持分页",
      parameters: ListRecordsSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, page_size, page_token } = params as {
          app_token: string;
          table_id: string;
          page_size?: number;
          page_token?: string;
        };
        try {
          const result = await listRecords(getClient(), app_token, table_id, page_size, page_token);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_bitable_list_records" },
  );

  // 工具 3: feishu_bitable_get_record
  api.registerTool(
    {
      name: "feishu_bitable_get_record",
      label: "飞书多维表格获取记录",
      description: "根据 ID 获取多维表格中的单条记录",
      parameters: GetRecordSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, record_id } = params as {
          app_token: string;
          table_id: string;
          record_id: string;
        };
        try {
          const result = await getRecord(getClient(), app_token, table_id, record_id);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_bitable_get_record" },
  );

  // 工具 4: feishu_bitable_create_record
  api.registerTool(
    {
      name: "feishu_bitable_create_record",
      label: "飞书多维表格创建记录",
      description: "在多维表格中创建新记录 (行)",
      parameters: CreateRecordSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, fields } = params as {
          app_token: string;
          table_id: string;
          fields: Record<string, unknown>;
        };
        try {
          const result = await createRecord(getClient(), app_token, table_id, fields);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_bitable_create_record" },
  );

  // 工具 5: feishu_bitable_update_record
  api.registerTool(
    {
      name: "feishu_bitable_update_record",
      label: "飞书多维表格更新记录",
      description: "更新多维表格中的现有记录 (行)",
      parameters: UpdateRecordSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, record_id, fields } = params as {
          app_token: string;
          table_id: string;
          record_id: string;
          fields: Record<string, unknown>;
        };
        try {
          const result = await updateRecord(getClient(), app_token, table_id, record_id, fields);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_bitable_update_record" },
  );

  api.logger.info?.(`[feishu_bitable] 已注册 6 个多维表格工具`);
}
