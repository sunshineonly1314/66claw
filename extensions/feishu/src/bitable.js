import { createFeishuClient } from "./client.js";
function json(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    details: data
  };
}
const FIELD_TYPE_NAMES = {
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
  1005: "AutoNumber"
};
function parseBitableUrl(url) {
  try {
    const u = new URL(url);
    const tableId = u.searchParams.get("table") ?? void 0;
    const wikiMatch = u.pathname.match(/\/wiki\/([A-Za-z0-9]+)/);
    if (wikiMatch) {
      return { token: wikiMatch[1], tableId, isWiki: true };
    }
    const baseMatch = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
    if (baseMatch) {
      return { token: baseMatch[1], tableId, isWiki: false };
    }
    return null;
  } catch {
    return null;
  }
}
async function getAppTokenFromWiki(client, nodeToken) {
  const res = await client.wiki.space.getNode({
    params: { token: nodeToken }
  });
  if (res.code !== 0) throw new Error(res.msg);
  const node = res.data?.node;
  if (!node) throw new Error("\u8282\u70B9\u672A\u627E\u5230");
  if (node.obj_type !== "bitable") {
    throw new Error(`\u8282\u70B9\u4E0D\u662F\u591A\u7EF4\u8868\u683C (\u7C7B\u578B: ${node.obj_type})`);
  }
  return node.obj_token;
}
async function getBitableMeta(client, url) {
  const parsed = parseBitableUrl(url);
  if (!parsed) {
    throw new Error("\u65E0\u6548\u7684 URL \u683C\u5F0F\u3002\u9700\u8981 /base/XXX \u6216 /wiki/XXX \u683C\u5F0F\u7684 URL");
  }
  let appToken;
  if (parsed.isWiki) {
    appToken = await getAppTokenFromWiki(client, parsed.token);
  } else {
    appToken = parsed.token;
  }
  const res = await client.bitable.app.get({
    path: { app_token: appToken }
  });
  if (res.code !== 0) throw new Error(res.msg);
  let tables = [];
  if (!parsed.tableId) {
    const tablesRes = await client.bitable.appTable.list({
      path: { app_token: appToken }
    });
    if (tablesRes.code === 0) {
      tables = (tablesRes.data?.items ?? []).map((t) => ({
        table_id: t.table_id,
        name: t.name
      }));
    }
  }
  return {
    app_token: appToken,
    table_id: parsed.tableId,
    name: res.data?.app?.name,
    url_type: parsed.isWiki ? "wiki" : "base",
    ...tables.length > 0 && { tables },
    hint: parsed.tableId ? `\u4F7F\u7528 app_token="${appToken}" \u548C table_id="${parsed.tableId}" \u8C03\u7528\u5176\u4ED6 bitable \u5DE5\u5177` : `\u4F7F\u7528 app_token="${appToken}" \u8C03\u7528\u5176\u4ED6 bitable \u5DE5\u5177\u3002\u4ECE tables \u5217\u8868\u4E2D\u9009\u62E9 table_id\u3002`
  };
}
async function listFields(client, appToken, tableId) {
  const res = await client.bitable.appTableField.list({
    path: { app_token: appToken, table_id: tableId }
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
      ...f.property && { property: f.property }
    })),
    total: fields.length
  };
}
async function listRecords(client, appToken, tableId, pageSize, pageToken) {
  const res = await client.bitable.appTableRecord.list({
    path: { app_token: appToken, table_id: tableId },
    params: {
      page_size: pageSize ?? 100,
      ...pageToken && { page_token: pageToken }
    }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    records: res.data?.items ?? [],
    has_more: res.data?.has_more ?? false,
    page_token: res.data?.page_token,
    total: res.data?.total
  };
}
async function getRecord(client, appToken, tableId, recordId) {
  const res = await client.bitable.appTableRecord.get({
    path: { app_token: appToken, table_id: tableId, record_id: recordId }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    record: res.data?.record
  };
}
async function createRecord(client, appToken, tableId, fields) {
  const res = await client.bitable.appTableRecord.create({
    path: { app_token: appToken, table_id: tableId },
    data: { fields }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    record: res.data?.record
  };
}
async function updateRecord(client, appToken, tableId, recordId, fields) {
  const res = await client.bitable.appTableRecord.update({
    path: { app_token: appToken, table_id: tableId, record_id: recordId },
    data: { fields }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    record: res.data?.record
  };
}
const GetMetaSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "\u591A\u7EF4\u8868\u683C URL\u3002\u652F\u6301\u4E24\u79CD\u683C\u5F0F: /base/XXX?table=YYY \u6216 /wiki/XXX?table=YYY"
    }
  },
  required: ["url"]
};
const ListFieldsSchema = {
  type: "object",
  properties: {
    app_token: {
      type: "string",
      description: "\u591A\u7EF4\u8868\u683C app_token (\u4F7F\u7528 feishu_bitable_get_meta \u4ECE URL \u83B7\u53D6)"
    },
    table_id: {
      type: "string",
      description: "\u8868\u683C ID (\u4ECE URL \u53C2\u6570 ?table=YYY \u83B7\u53D6)"
    }
  },
  required: ["app_token", "table_id"]
};
const ListRecordsSchema = {
  type: "object",
  properties: {
    app_token: {
      type: "string",
      description: "\u591A\u7EF4\u8868\u683C app_token"
    },
    table_id: {
      type: "string",
      description: "\u8868\u683C ID"
    },
    page_size: {
      type: "number",
      description: "\u6BCF\u9875\u8BB0\u5F55\u6570 (1-500\uFF0C\u9ED8\u8BA4 100)",
      minimum: 1,
      maximum: 500
    },
    page_token: {
      type: "string",
      description: "\u5206\u9875 token (\u6765\u81EA\u4E0A\u4E00\u6B21\u54CD\u5E94)"
    }
  },
  required: ["app_token", "table_id"]
};
const GetRecordSchema = {
  type: "object",
  properties: {
    app_token: { type: "string", description: "\u591A\u7EF4\u8868\u683C app_token" },
    table_id: { type: "string", description: "\u8868\u683C ID" },
    record_id: { type: "string", description: "\u8BB0\u5F55 ID" }
  },
  required: ["app_token", "table_id", "record_id"]
};
const CreateRecordSchema = {
  type: "object",
  properties: {
    app_token: { type: "string", description: "\u591A\u7EF4\u8868\u683C app_token" },
    table_id: { type: "string", description: "\u8868\u683C ID" },
    fields: {
      type: "object",
      description: "\u5B57\u6BB5\u503C\uFF0C\u4EE5\u5B57\u6BB5\u540D\u4E3A\u952E\u3002\u683C\u5F0F: Text='\u5B57\u7B26\u4E32', Number=123, SingleSelect='\u9009\u9879', MultiSelect=['A','B'], DateTime=\u65F6\u95F4\u6233\u6BEB\u79D2, User=[{id:'ou_xxx'}], URL={text:'\u663E\u793A\u6587\u672C',link:'https://...'}"
    }
  },
  required: ["app_token", "table_id", "fields"]
};
const UpdateRecordSchema = {
  type: "object",
  properties: {
    app_token: { type: "string", description: "\u591A\u7EF4\u8868\u683C app_token" },
    table_id: { type: "string", description: "\u8868\u683C ID" },
    record_id: { type: "string", description: "\u8BB0\u5F55 ID" },
    fields: {
      type: "object",
      description: "\u8981\u66F4\u65B0\u7684\u5B57\u6BB5\u503C (\u683C\u5F0F\u540C create_record)"
    }
  },
  required: ["app_token", "table_id", "record_id", "fields"]
};
function registerFeishuBitableTools(api) {
  const feishuCfg = api.config?.channels?.feishu;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_bitable] \u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E\uFF0C\u8DF3\u8FC7\u591A\u7EF4\u8868\u683C\u5DE5\u5177\u6CE8\u518C");
    return;
  }
  const getClient = () => createFeishuClient(feishuCfg);
  api.registerTool(
    {
      name: "feishu_bitable_get_meta",
      label: "\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u5143\u6570\u636E",
      description: "\u89E3\u6790\u591A\u7EF4\u8868\u683C URL \u5E76\u83B7\u53D6 app_token, table_id \u548C\u8868\u683C\u5217\u8868\u3002\u7ED9\u5B9A /wiki/ \u6216 /base/ URL \u65F6\u9996\u5148\u4F7F\u7528\u6B64\u5DE5\u5177\u3002",
      parameters: GetMetaSchema,
      async execute(_toolCallId, params) {
        const { url } = params;
        try {
          const result = await getBitableMeta(getClient(), url);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_bitable_get_meta" }
  );
  api.registerTool(
    {
      name: "feishu_bitable_list_fields",
      label: "\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u5B57\u6BB5",
      description: "\u5217\u51FA\u591A\u7EF4\u8868\u683C\u4E2D\u6240\u6709\u5B57\u6BB5 (\u5217) \u53CA\u5176\u7C7B\u578B\u548C\u5C5E\u6027",
      parameters: ListFieldsSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id } = params;
        try {
          const result = await listFields(getClient(), app_token, table_id);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_bitable_list_fields" }
  );
  api.registerTool(
    {
      name: "feishu_bitable_list_records",
      label: "\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u8BB0\u5F55\u5217\u8868",
      description: "\u5217\u51FA\u591A\u7EF4\u8868\u683C\u4E2D\u7684\u8BB0\u5F55 (\u884C)\uFF0C\u652F\u6301\u5206\u9875",
      parameters: ListRecordsSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, page_size, page_token } = params;
        try {
          const result = await listRecords(getClient(), app_token, table_id, page_size, page_token);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_bitable_list_records" }
  );
  api.registerTool(
    {
      name: "feishu_bitable_get_record",
      label: "\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u83B7\u53D6\u8BB0\u5F55",
      description: "\u6839\u636E ID \u83B7\u53D6\u591A\u7EF4\u8868\u683C\u4E2D\u7684\u5355\u6761\u8BB0\u5F55",
      parameters: GetRecordSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, record_id } = params;
        try {
          const result = await getRecord(getClient(), app_token, table_id, record_id);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_bitable_get_record" }
  );
  api.registerTool(
    {
      name: "feishu_bitable_create_record",
      label: "\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u521B\u5EFA\u8BB0\u5F55",
      description: "\u5728\u591A\u7EF4\u8868\u683C\u4E2D\u521B\u5EFA\u65B0\u8BB0\u5F55 (\u884C)",
      parameters: CreateRecordSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, fields } = params;
        try {
          const result = await createRecord(getClient(), app_token, table_id, fields);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_bitable_create_record" }
  );
  api.registerTool(
    {
      name: "feishu_bitable_update_record",
      label: "\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u66F4\u65B0\u8BB0\u5F55",
      description: "\u66F4\u65B0\u591A\u7EF4\u8868\u683C\u4E2D\u7684\u73B0\u6709\u8BB0\u5F55 (\u884C)",
      parameters: UpdateRecordSchema,
      async execute(_toolCallId, params) {
        const { app_token, table_id, record_id, fields } = params;
        try {
          const result = await updateRecord(getClient(), app_token, table_id, record_id, fields);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_bitable_update_record" }
  );
  api.logger.info?.(`[feishu_bitable] \u5DF2\u6CE8\u518C 6 \u4E2A\u591A\u7EF4\u8868\u683C\u5DE5\u5177`);
}
export {
  registerFeishuBitableTools
};
