import { createFeishuClient } from "./client.js";
import { resolveToolsConfig } from "./tools-config.js";
function json(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    details: data
  };
}
const FILE_TYPE_NAMES = {
  doc: "\u65E7\u7248\u6587\u6863",
  docx: "\u65B0\u7248\u6587\u6863",
  sheet: "\u7535\u5B50\u8868\u683C",
  bitable: "\u591A\u7EF4\u8868\u683C",
  mindnote: "\u601D\u7EF4\u7B14\u8BB0",
  file: "\u6587\u4EF6",
  folder: "\u6587\u4EF6\u5939",
  slides: "\u5E7B\u706F\u7247"
};
const DRIVE_ACCESS_HINT = "\u673A\u5668\u4EBA\u6CA1\u6709\u81EA\u5DF1\u7684'\u6211\u7684\u7A7A\u95F4'\u3002\u673A\u5668\u4EBA\u53EA\u80FD\u8BBF\u95EE\u88AB\u5206\u4EAB\u7ED9\u5B83\u7684\u6587\u4EF6/\u6587\u4EF6\u5939\u3002\u8981\u6388\u6743\uFF1A\u6253\u5F00\u6587\u4EF6\u5939 \u2192 \u5206\u4EAB \u2192 \u641C\u7D22\u673A\u5668\u4EBA\u540D\u79F0 \u2192 \u6388\u4E88\u6743\u9650\u3002";
async function listFolder(client, folderToken) {
  const res = await client.drive.file.list({
    params: {
      folder_token: folderToken,
      page_size: 100
    }
  });
  if (res.code !== 0) {
    if (res.code === 99991672 || res.msg?.includes("permission")) {
      throw new Error(`${res.msg}

${DRIVE_ACCESS_HINT}`);
    }
    throw new Error(res.msg);
  }
  const files = res.data?.files ?? [];
  return {
    files: files.map((f) => ({
      token: f.token,
      name: f.name,
      type: f.type,
      type_name: FILE_TYPE_NAMES[f.type ?? ""] || f.type,
      created_time: f.created_time,
      modified_time: f.modified_time,
      owner_id: f.owner_id,
      url: f.url
    })),
    has_more: res.data?.has_more ?? false,
    page_token: res.data?.next_page_token,
    ...files.length === 0 && !folderToken && { hint: DRIVE_ACCESS_HINT }
  };
}
async function getFileMeta(client, fileToken, fileType) {
  const res = await client.drive.meta.batchQuery({
    data: {
      request_docs: [{ doc_token: fileToken, doc_type: fileType }],
      with_url: true
    }
  });
  if (res.code !== 0) throw new Error(res.msg);
  const doc = res.data?.metas?.[0];
  if (!doc) throw new Error("\u6587\u4EF6\u672A\u627E\u5230");
  return {
    token: doc.doc_token,
    type: doc.doc_type,
    type_name: FILE_TYPE_NAMES[doc.doc_type ?? ""] || doc.doc_type,
    title: doc.title,
    owner_id: doc.owner_id,
    create_time: doc.create_time,
    latest_modify_time: doc.latest_modify_time,
    latest_modify_user: doc.latest_modify_user,
    url: doc.url
  };
}
async function createFolder(client, name, parentFolderToken) {
  const res = await client.drive.file.createFolder({
    data: {
      name,
      folder_token: parentFolderToken ?? ""
    }
  });
  if (res.code !== 0) {
    if (res.code === 99991672 || res.msg?.includes("permission")) {
      throw new Error(`${res.msg}

${DRIVE_ACCESS_HINT}`);
    }
    throw new Error(res.msg);
  }
  return {
    token: res.data?.token,
    url: res.data?.url,
    name
  };
}
async function moveFile(client, fileToken, fileType, targetFolderToken) {
  const res = await client.drive.file.move({
    data: {
      type: fileType,
      folder_token: targetFolderToken
    },
    path: {
      file_token: fileToken
    }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    task_id: res.data?.task_id
  };
}
async function deleteFile(client, fileToken, fileType) {
  const res = await client.drive.file.delete({
    path: { file_token: fileToken },
    params: { type: fileType }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    task_id: res.data?.task_id
  };
}
const FeishuDriveJsonSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "get", "create_folder", "move", "delete"],
      description: "\u64CD\u4F5C\u7C7B\u578B: list(\u5217\u51FA\u6587\u4EF6), get(\u83B7\u53D6\u8BE6\u60C5), create_folder(\u521B\u5EFA\u6587\u4EF6\u5939), move(\u79FB\u52A8), delete(\u5220\u9664)"
    },
    folder_token: {
      type: "string",
      description: "\u6587\u4EF6\u5939 token\u3002list \u65F6\u4E3A\u7A7A\u8868\u793A\u6839\u76EE\u5F55 (\u9700\u8981\u88AB\u5206\u4EAB\u8BBF\u95EE\u6743\u9650)"
    },
    file_token: {
      type: "string",
      description: "\u6587\u4EF6/\u6587\u4EF6\u5939 token (\u7528\u4E8E get/move/delete)"
    },
    file_type: {
      type: "string",
      enum: ["doc", "docx", "sheet", "bitable", "mindnote", "file", "folder", "slides"],
      description: "\u6587\u4EF6\u7C7B\u578B (\u7528\u4E8E get/move/delete)"
    },
    name: {
      type: "string",
      description: "\u6587\u4EF6\u5939\u540D\u79F0 (\u7528\u4E8E create_folder)"
    },
    parent_folder_token: {
      type: "string",
      description: "\u7236\u6587\u4EF6\u5939 token (\u7528\u4E8E create_folder)"
    },
    target_folder_token: {
      type: "string",
      description: "\u76EE\u6807\u6587\u4EF6\u5939 token (\u7528\u4E8E move)"
    }
  },
  required: ["action"]
};
function registerFeishuDriveTools(api) {
  const feishuCfg = api.config?.channels?.feishu;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_drive] \u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E\uFF0C\u8DF3\u8FC7\u4E91\u7A7A\u95F4\u5DE5\u5177\u6CE8\u518C");
    return;
  }
  const toolsCfg = resolveToolsConfig(feishuCfg.tools);
  if (!toolsCfg.drive) {
    api.logger.debug?.("[feishu_drive] drive \u5DE5\u5177\u5DF2\u5728\u914D\u7F6E\u4E2D\u7981\u7528");
    return;
  }
  const getClient = () => createFeishuClient(feishuCfg);
  api.registerTool(
    {
      name: "feishu_drive",
      label: "\u98DE\u4E66\u4E91\u7A7A\u95F4",
      description: "\u98DE\u4E66\u4E91\u7A7A\u95F4\u64CD\u4F5C\u3002\u652F\u6301: list(\u5217\u51FA\u6587\u4EF6), get(\u83B7\u53D6\u8BE6\u60C5), create_folder(\u521B\u5EFA\u6587\u4EF6\u5939), move(\u79FB\u52A8), delete(\u5220\u9664)",
      parameters: FeishuDriveJsonSchema,
      async execute(_toolCallId, params) {
        const p = params;
        try {
          const client = getClient();
          switch (p.action) {
            case "list":
              return json(await listFolder(client, p.folder_token));
            case "get":
              if (!p.file_token || !p.file_type) {
                return json({ error: "get \u64CD\u4F5C\u9700\u8981 file_token \u548C file_type" });
              }
              return json(await getFileMeta(client, p.file_token, p.file_type));
            case "create_folder":
              if (!p.name) {
                return json({ error: "create_folder \u64CD\u4F5C\u9700\u8981 name" });
              }
              return json(await createFolder(client, p.name, p.parent_folder_token));
            case "move":
              if (!p.file_token || !p.file_type || !p.target_folder_token) {
                return json({ error: "move \u64CD\u4F5C\u9700\u8981 file_token, file_type \u548C target_folder_token" });
              }
              return json(await moveFile(client, p.file_token, p.file_type, p.target_folder_token));
            case "delete":
              if (!p.file_token || !p.file_type) {
                return json({ error: "delete \u64CD\u4F5C\u9700\u8981 file_token \u548C file_type" });
              }
              return json(await deleteFile(client, p.file_token, p.file_type));
            default:
              return json({ error: `\u672A\u77E5\u64CD\u4F5C: ${p.action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_drive" }
  );
  api.logger.info?.(`[feishu_drive] \u5DF2\u6CE8\u518C feishu_drive \u5DE5\u5177`);
}
export {
  registerFeishuDriveTools
};
