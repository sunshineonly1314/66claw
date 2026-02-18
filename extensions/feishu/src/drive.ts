/**
 * 飞书云空间工具
 * Feishu Drive Tool
 *
 * 支持文件夹管理、文件信息获取
 * 融合自 m1heng/clawdbot-feishu (MIT License)
 */

import type { ClawdbotPluginApi } from "openclawcn/plugin-sdk";
import { createFeishuClient } from "./client.js";
import type { FeishuChannelConfig } from "./types.js";
import { resolveToolsConfig } from "./tools-config.js";

// ============================================================================
// 辅助函数
// ============================================================================

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

/** 文件类型映射 */
const FILE_TYPE_NAMES: Record<string, string> = {
  doc: "旧版文档",
  docx: "新版文档",
  sheet: "电子表格",
  bitable: "多维表格",
  mindnote: "思维笔记",
  file: "文件",
  folder: "文件夹",
  slides: "幻灯片",
};

// ============================================================================
// 云空间操作
// ============================================================================

const DRIVE_ACCESS_HINT =
  "机器人没有自己的'我的空间'。机器人只能访问被分享给它的文件/文件夹。" +
  "要授权：打开文件夹 → 分享 → 搜索机器人名称 → 授予权限。";

/** 列出文件夹内容 */
async function listFolder(
  client: ReturnType<typeof createFeishuClient>,
  folderToken?: string,
) {
  const res = await client.drive.file.list({
    params: {
      folder_token: folderToken,
      page_size: 100,
    },
  });

  if (res.code !== 0) {
    // 如果是权限问题，提供帮助提示
    if (res.code === 99991672 || res.msg?.includes("permission")) {
      throw new Error(`${res.msg}\n\n${DRIVE_ACCESS_HINT}`);
    }
    throw new Error(res.msg);
  }

  const files = res.data?.files ?? [];
  return {
    files: files.map((f: { token: string; name: string; type: string; created_time?: string; modified_time?: string; owner_id?: string; url?: string }) => ({
      token: f.token,
      name: f.name,
      type: f.type,
      type_name: FILE_TYPE_NAMES[f.type ?? ""] || f.type,
      created_time: f.created_time,
      modified_time: f.modified_time,
      owner_id: f.owner_id,
      url: f.url,
    })),
    has_more: res.data?.has_more ?? false,
    page_token: res.data?.next_page_token,
    ...(files.length === 0 && !folderToken && { hint: DRIVE_ACCESS_HINT }),
  };
}

/** 文件类型字面量联合 */
type DriveFileType = "doc" | "docx" | "sheet" | "bitable" | "mindnote" | "file" | "wiki" | "folder" | "slides" | "synced_block";

/** 获取文件/文件夹元数据 */
async function getFileMeta(
  client: ReturnType<typeof createFeishuClient>,
  fileToken: string,
  fileType: string,
) {
  const res = await client.drive.meta.batchQuery({
    data: {
      request_docs: [{ doc_token: fileToken, doc_type: fileType as DriveFileType }],
      with_url: true,
    },
  });

  if (res.code !== 0) throw new Error(res.msg);

  const doc = res.data?.metas?.[0];
  if (!doc) throw new Error("文件未找到");

  return {
    token: doc.doc_token,
    type: doc.doc_type,
    type_name: FILE_TYPE_NAMES[doc.doc_type ?? ""] || doc.doc_type,
    title: doc.title,
    owner_id: doc.owner_id,
    create_time: doc.create_time,
    latest_modify_time: doc.latest_modify_time,
    latest_modify_user: doc.latest_modify_user,
    url: doc.url,
  };
}

/** 创建文件夹 */
async function createFolder(
  client: ReturnType<typeof createFeishuClient>,
  name: string,
  parentFolderToken?: string,
) {
  const res = await client.drive.file.createFolder({
    data: {
      name,
      folder_token: parentFolderToken ?? "",
    },
  });
  
  if (res.code !== 0) {
    if (res.code === 99991672 || res.msg?.includes("permission")) {
      throw new Error(`${res.msg}\n\n${DRIVE_ACCESS_HINT}`);
    }
    throw new Error(res.msg);
  }

  return {
    token: res.data?.token,
    url: res.data?.url,
    name,
  };
}

/** 移动文件/文件夹 */
async function moveFile(
  client: ReturnType<typeof createFeishuClient>,
  fileToken: string,
  fileType: string,
  targetFolderToken: string,
) {
  const res = await client.drive.file.move({
    data: {
      type: fileType as "file" | "doc" | "docx" | "sheet" | "bitable" | "mindnote" | "folder" | "slides",
      folder_token: targetFolderToken,
    },
    path: {
      file_token: fileToken,
    },
  });
  
  if (res.code !== 0) throw new Error(res.msg);

  return {
    success: true,
    task_id: res.data?.task_id,
  };
}

/** 删除文件/文件夹 */
async function deleteFile(
  client: ReturnType<typeof createFeishuClient>,
  fileToken: string,
  fileType: string,
) {
  const res = await client.drive.file.delete({
    path: { file_token: fileToken },
    params: { type: fileType as "file" | "doc" | "docx" | "sheet" | "bitable" | "mindnote" | "folder" | "slides" | "shortcut" },
  });
  
  if (res.code !== 0) throw new Error(res.msg);

  return {
    success: true,
    task_id: res.data?.task_id,
  };
}

// ============================================================================
// Schema 定义
// ============================================================================

const FeishuDriveJsonSchema = {
  type: "object" as const,
  properties: {
    action: {
      type: "string",
      enum: ["list", "get", "create_folder", "move", "delete"],
      description: "操作类型: list(列出文件), get(获取详情), create_folder(创建文件夹), move(移动), delete(删除)",
    },
    folder_token: {
      type: "string",
      description: "文件夹 token。list 时为空表示根目录 (需要被分享访问权限)",
    },
    file_token: {
      type: "string",
      description: "文件/文件夹 token (用于 get/move/delete)",
    },
    file_type: {
      type: "string",
      enum: ["doc", "docx", "sheet", "bitable", "mindnote", "file", "folder", "slides"],
      description: "文件类型 (用于 get/move/delete)",
    },
    name: {
      type: "string",
      description: "文件夹名称 (用于 create_folder)",
    },
    parent_folder_token: {
      type: "string",
      description: "父文件夹 token (用于 create_folder)",
    },
    target_folder_token: {
      type: "string",
      description: "目标文件夹 token (用于 move)",
    },
  },
  required: ["action"],
};

// ============================================================================
// 工具注册
// ============================================================================

export function registerFeishuDriveTools(api: ClawdbotPluginApi) {
  const feishuCfg = api.config?.channels?.feishu as FeishuChannelConfig | undefined;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_drive] 飞书凭证未配置，跳过云空间工具注册");
    return;
  }

  const toolsCfg = resolveToolsConfig(feishuCfg.tools);
  if (!toolsCfg.drive) {
    api.logger.debug?.("[feishu_drive] drive 工具已在配置中禁用");
    return;
  }

  const getClient = () => createFeishuClient(feishuCfg);

  api.registerTool(
    {
      name: "feishu_drive",
      label: "飞书云空间",
      description:
        "飞书云空间操作。支持: list(列出文件), get(获取详情), create_folder(创建文件夹), move(移动), delete(删除)",
      parameters: FeishuDriveJsonSchema,
      async execute(_toolCallId, params) {
        const p = params as {
          action: string;
          folder_token?: string;
          file_token?: string;
          file_type?: string;
          name?: string;
          parent_folder_token?: string;
          target_folder_token?: string;
        };
        try {
          const client = getClient();
          switch (p.action) {
            case "list":
              return json(await listFolder(client, p.folder_token));
            case "get":
              if (!p.file_token || !p.file_type) {
                return json({ error: "get 操作需要 file_token 和 file_type" });
              }
              return json(await getFileMeta(client, p.file_token, p.file_type));
            case "create_folder":
              if (!p.name) {
                return json({ error: "create_folder 操作需要 name" });
              }
              return json(await createFolder(client, p.name, p.parent_folder_token));
            case "move":
              if (!p.file_token || !p.file_type || !p.target_folder_token) {
                return json({ error: "move 操作需要 file_token, file_type 和 target_folder_token" });
              }
              return json(await moveFile(client, p.file_token, p.file_type, p.target_folder_token));
            case "delete":
              if (!p.file_token || !p.file_type) {
                return json({ error: "delete 操作需要 file_token 和 file_type" });
              }
              return json(await deleteFile(client, p.file_token, p.file_type));
            default:
              return json({ error: `未知操作: ${p.action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_drive" },
  );

  api.logger.info?.(`[feishu_drive] 已注册 feishu_drive 工具`);
}
