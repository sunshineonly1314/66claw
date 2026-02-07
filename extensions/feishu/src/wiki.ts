/**
 * 飞书知识库工具
 * Feishu Wiki Tool
 *
 * 支持知识库空间和节点的管理
 * 融合自 m1heng/clawdbot-feishu (MIT License)
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { createFeishuClient, Lark } from "./client.js";
import type { FeishuChannelConfig } from "./types.js";
import { FeishuWikiJsonSchema, type FeishuWikiParams } from "./wiki-schema.js";
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

type ObjType = "doc" | "sheet" | "mindnote" | "bitable" | "file" | "docx" | "slides";

// ============================================================================
// 知识库操作
// ============================================================================

const WIKI_ACCESS_HINT =
  "要授予知识库访问权限：打开知识库空间 → 设置 → 成员 → 添加机器人。" +
  "参考文档：https://open.feishu.cn/document/server-docs/docs/wiki-v2/wiki-qa#a40ad4ca";

/** 列出知识库空间 */
async function listSpaces(client: Lark.Client) {
  const res = await client.wiki.space.list({});
  if (res.code !== 0) throw new Error(res.msg);

  const spaces =
    res.data?.items?.map((s) => ({
      space_id: s.space_id,
      name: s.name,
      description: s.description,
      visibility: s.visibility,
    })) ?? [];

  return {
    spaces,
    ...(spaces.length === 0 && { hint: WIKI_ACCESS_HINT }),
  };
}

/** 列出节点 */
async function listNodes(client: Lark.Client, spaceId: string, parentNodeToken?: string) {
  const res = await client.wiki.spaceNode.list({
    path: { space_id: spaceId },
    params: { parent_node_token: parentNodeToken },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    nodes:
      res.data?.items?.map((n) => ({
        node_token: n.node_token,
        obj_token: n.obj_token,
        obj_type: n.obj_type,
        title: n.title,
        has_child: n.has_child,
      })) ?? [],
  };
}

/** 获取节点详情 */
async function getNode(client: Lark.Client, token: string) {
  const res = await client.wiki.space.getNode({
    params: { token },
  });
  if (res.code !== 0) throw new Error(res.msg);

  const node = res.data?.node;
  return {
    node_token: node?.node_token,
    space_id: node?.space_id,
    obj_token: node?.obj_token,
    obj_type: node?.obj_type,
    title: node?.title,
    parent_node_token: node?.parent_node_token,
    has_child: node?.has_child,
    creator: node?.creator,
    create_time: node?.node_create_time,
  };
}

/** 创建节点 */
async function createNode(
  client: Lark.Client,
  spaceId: string,
  title: string,
  objType?: string,
  parentNodeToken?: string,
) {
  const res = await client.wiki.spaceNode.create({
    path: { space_id: spaceId },
    data: {
      obj_type: (objType as ObjType) || "docx",
      node_type: "origin" as const,
      title,
      parent_node_token: parentNodeToken,
    },
  });
  if (res.code !== 0) throw new Error(res.msg);

  const node = res.data?.node;
  return {
    node_token: node?.node_token,
    obj_token: node?.obj_token,
    obj_type: node?.obj_type,
    title: node?.title,
  };
}

/** 移动节点 */
async function moveNode(
  client: Lark.Client,
  spaceId: string,
  nodeToken: string,
  targetSpaceId?: string,
  targetParentToken?: string,
) {
  const res = await client.wiki.spaceNode.move({
    path: { space_id: spaceId, node_token: nodeToken },
    data: {
      target_space_id: targetSpaceId || spaceId,
      target_parent_token: targetParentToken,
    },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    success: true,
    node_token: res.data?.node?.node_token,
  };
}

/** 重命名节点 */
async function renameNode(
  client: Lark.Client,
  spaceId: string,
  nodeToken: string,
  title: string,
) {
  const res = await client.wiki.spaceNode.updateTitle({
    path: { space_id: spaceId, node_token: nodeToken },
    data: { title },
  });
  if (res.code !== 0) throw new Error(res.msg);

  return {
    success: true,
    node_token: nodeToken,
    title,
  };
}

// ============================================================================
// 工具注册
// ============================================================================

export function registerFeishuWikiTools(api: ClawdbotPluginApi) {
  const feishuCfg = api.config?.channels?.feishu as FeishuChannelConfig | undefined;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_wiki] 飞书凭证未配置，跳过知识库工具注册");
    return;
  }

  const toolsCfg = resolveToolsConfig(feishuCfg.tools);
  if (!toolsCfg.wiki) {
    api.logger.debug?.("[feishu_wiki] wiki 工具已在配置中禁用");
    return;
  }

  const getClient = () => createFeishuClient(feishuCfg);

  api.registerTool(
    {
      name: "feishu_wiki",
      label: "飞书知识库",
      description:
        "飞书知识库操作。支持: spaces(列出空间), nodes(列出节点), get(获取详情), create(创建), move(移动), rename(重命名)",
      parameters: FeishuWikiJsonSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuWikiParams;
        try {
          const client = getClient();
          switch (p.action) {
            case "spaces":
              return json(await listSpaces(client));
            case "nodes":
              return json(await listNodes(client, p.space_id!, p.parent_node_token));
            case "get":
              return json(await getNode(client, p.token!));
            case "create":
              return json(
                await createNode(client, p.space_id!, p.title!, p.obj_type, p.parent_node_token),
              );
            case "move":
              return json(
                await moveNode(
                  client,
                  p.space_id!,
                  p.node_token!,
                  p.target_space_id,
                  p.target_parent_token,
                ),
              );
            case "rename":
              return json(await renameNode(client, p.space_id!, p.node_token!, p.title!));
            default:
              return json({ error: `未知操作: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_wiki" },
  );

  api.logger.info?.(`[feishu_wiki] 已注册 feishu_wiki 工具`);
}
