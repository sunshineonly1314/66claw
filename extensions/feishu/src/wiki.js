import { createFeishuClient } from "./client.js";
import { FeishuWikiJsonSchema } from "./wiki-schema.js";
import { resolveToolsConfig } from "./tools-config.js";
function json(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    details: data
  };
}
const WIKI_ACCESS_HINT = "\u8981\u6388\u4E88\u77E5\u8BC6\u5E93\u8BBF\u95EE\u6743\u9650\uFF1A\u6253\u5F00\u77E5\u8BC6\u5E93\u7A7A\u95F4 \u2192 \u8BBE\u7F6E \u2192 \u6210\u5458 \u2192 \u6DFB\u52A0\u673A\u5668\u4EBA\u3002\u53C2\u8003\u6587\u6863\uFF1Ahttps://open.feishu.cn/document/server-docs/docs/wiki-v2/wiki-qa#a40ad4ca";
async function listSpaces(client) {
  const res = await client.wiki.space.list({});
  if (res.code !== 0) throw new Error(res.msg);
  const spaces = res.data?.items?.map((s) => ({
    space_id: s.space_id,
    name: s.name,
    description: s.description,
    visibility: s.visibility
  })) ?? [];
  return {
    spaces,
    ...spaces.length === 0 && { hint: WIKI_ACCESS_HINT }
  };
}
async function listNodes(client, spaceId, parentNodeToken) {
  const res = await client.wiki.spaceNode.list({
    path: { space_id: spaceId },
    params: { parent_node_token: parentNodeToken }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    nodes: res.data?.items?.map((n) => ({
      node_token: n.node_token,
      obj_token: n.obj_token,
      obj_type: n.obj_type,
      title: n.title,
      has_child: n.has_child
    })) ?? []
  };
}
async function getNode(client, token) {
  const res = await client.wiki.space.getNode({
    params: { token }
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
    create_time: node?.node_create_time
  };
}
async function createNode(client, spaceId, title, objType, parentNodeToken) {
  const res = await client.wiki.spaceNode.create({
    path: { space_id: spaceId },
    data: {
      obj_type: objType || "docx",
      node_type: "origin",
      title,
      parent_node_token: parentNodeToken
    }
  });
  if (res.code !== 0) throw new Error(res.msg);
  const node = res.data?.node;
  return {
    node_token: node?.node_token,
    obj_token: node?.obj_token,
    obj_type: node?.obj_type,
    title: node?.title
  };
}
async function moveNode(client, spaceId, nodeToken, targetSpaceId, targetParentToken) {
  const res = await client.wiki.spaceNode.move({
    path: { space_id: spaceId, node_token: nodeToken },
    data: {
      target_space_id: targetSpaceId || spaceId,
      target_parent_token: targetParentToken
    }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    node_token: res.data?.node?.node_token
  };
}
async function renameNode(client, spaceId, nodeToken, title) {
  const res = await client.wiki.spaceNode.updateTitle({
    path: { space_id: spaceId, node_token: nodeToken },
    data: { title }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    node_token: nodeToken,
    title
  };
}
function registerFeishuWikiTools(api) {
  const feishuCfg = api.config?.channels?.feishu;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_wiki] \u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E\uFF0C\u8DF3\u8FC7\u77E5\u8BC6\u5E93\u5DE5\u5177\u6CE8\u518C");
    return;
  }
  const toolsCfg = resolveToolsConfig(feishuCfg.tools);
  if (!toolsCfg.wiki) {
    api.logger.debug?.("[feishu_wiki] wiki \u5DE5\u5177\u5DF2\u5728\u914D\u7F6E\u4E2D\u7981\u7528");
    return;
  }
  const getClient = () => createFeishuClient(feishuCfg);
  api.registerTool(
    {
      name: "feishu_wiki",
      label: "\u98DE\u4E66\u77E5\u8BC6\u5E93",
      description: "\u98DE\u4E66\u77E5\u8BC6\u5E93\u64CD\u4F5C\u3002\u652F\u6301: spaces(\u5217\u51FA\u7A7A\u95F4), nodes(\u5217\u51FA\u8282\u70B9), get(\u83B7\u53D6\u8BE6\u60C5), create(\u521B\u5EFA), move(\u79FB\u52A8), rename(\u91CD\u547D\u540D)",
      parameters: FeishuWikiJsonSchema,
      async execute(_toolCallId, params) {
        const p = params;
        try {
          const client = getClient();
          switch (p.action) {
            case "spaces":
              return json(await listSpaces(client));
            case "nodes":
              return json(await listNodes(client, p.space_id, p.parent_node_token));
            case "get":
              return json(await getNode(client, p.token));
            case "create":
              return json(
                await createNode(client, p.space_id, p.title, p.obj_type, p.parent_node_token)
              );
            case "move":
              return json(
                await moveNode(
                  client,
                  p.space_id,
                  p.node_token,
                  p.target_space_id,
                  p.target_parent_token
                )
              );
            case "rename":
              return json(await renameNode(client, p.space_id, p.node_token, p.title));
            default:
              return json({ error: `\u672A\u77E5\u64CD\u4F5C: ${p.action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    { name: "feishu_wiki" }
  );
  api.logger.info?.(`[feishu_wiki] \u5DF2\u6CE8\u518C feishu_wiki \u5DE5\u5177`);
}
export {
  registerFeishuWikiTools
};
