import { createFeishuClient } from "./client.js";
import { Readable } from "node:stream";
import { FeishuDocJsonSchema } from "./doc-schema.js";
import { getFeishuRuntime } from "./runtime.js";
import { resolveToolsConfig } from "./tools-config.js";
function json(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    details: data
  };
}
function extractImageUrls(markdown) {
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const urls = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.push(url);
    }
  }
  return urls;
}
const BLOCK_TYPE_NAMES = {
  1: "Page",
  2: "Text",
  3: "Heading1",
  4: "Heading2",
  5: "Heading3",
  12: "Bullet",
  13: "Ordered",
  14: "Code",
  15: "Quote",
  17: "Todo",
  18: "Bitable",
  21: "Diagram",
  22: "Divider",
  23: "File",
  27: "Image",
  30: "Sheet",
  31: "Table",
  32: "TableCell"
};
const UNSUPPORTED_CREATE_TYPES = /* @__PURE__ */ new Set([31, 32]);
function cleanBlocksForInsert(blocks) {
  const skipped = [];
  const cleaned = blocks.filter((block) => {
    if (UNSUPPORTED_CREATE_TYPES.has(block.block_type)) {
      const typeName = BLOCK_TYPE_NAMES[block.block_type] || `type_${block.block_type}`;
      skipped.push(typeName);
      return false;
    }
    return true;
  }).map((block) => {
    if (block.block_type === 31 && block.table?.merge_info) {
      const { merge_info, ...tableRest } = block.table;
      return { ...block, table: tableRest };
    }
    return block;
  });
  return { cleaned, skipped };
}
async function convertMarkdown(client, markdown) {
  const res = await client.docx.document.convert({
    data: { content_type: "markdown", content: markdown }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    blocks: res.data?.blocks ?? [],
    firstLevelBlockIds: res.data?.first_level_block_ids ?? []
  };
}
async function insertBlocks(client, docToken, blocks, parentBlockId) {
  const { cleaned, skipped } = cleanBlocksForInsert(blocks);
  const blockId = parentBlockId ?? docToken;
  if (cleaned.length === 0) {
    return { children: [], skipped };
  }
  const res = await client.docx.documentBlockChildren.create({
    path: { document_id: docToken, block_id: blockId },
    data: { children: cleaned }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return { children: res.data?.children ?? [], skipped };
}
async function clearDocumentContent(client, docToken) {
  const existing = await client.docx.documentBlock.list({
    path: { document_id: docToken }
  });
  if (existing.code !== 0) throw new Error(existing.msg);
  const childIds = existing.data?.items?.filter((b) => b.parent_id === docToken && b.block_type !== 1).map((b) => b.block_id) ?? [];
  if (childIds.length > 0) {
    const res = await client.docx.documentBlockChildren.batchDelete({
      path: { document_id: docToken, block_id: docToken },
      data: { start_index: 0, end_index: childIds.length }
    });
    if (res.code !== 0) throw new Error(res.msg);
  }
  return childIds.length;
}
async function uploadImageToDocx(client, blockId, imageBuffer, fileName) {
  const res = await client.drive.media.uploadAll({
    data: {
      file_name: fileName,
      parent_type: "docx_image",
      parent_node: blockId,
      size: imageBuffer.length,
      file: Readable.from(imageBuffer)
    }
  });
  const fileToken = res?.file_token;
  if (!fileToken) {
    throw new Error("\u56FE\u7247\u4E0A\u4F20\u5931\u8D25: \u672A\u8FD4\u56DE file_token");
  }
  return fileToken;
}
async function downloadImage(url, maxBytes) {
  const fetched = await getFeishuRuntime().channel.media.fetchRemoteMedia({ url, maxBytes });
  return fetched.buffer;
}
async function processImages(client, docToken, markdown, insertedBlocks, maxBytes) {
  const imageUrls = extractImageUrls(markdown);
  if (imageUrls.length === 0) return 0;
  const imageBlocks = insertedBlocks.filter((b) => b.block_type === 27);
  let processed = 0;
  for (let i = 0; i < Math.min(imageUrls.length, imageBlocks.length); i++) {
    const url = imageUrls[i];
    const blockId = imageBlocks[i].block_id;
    try {
      const buffer = await downloadImage(url, maxBytes);
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split("/").pop() || `image_${i}.png`;
      const fileToken = await uploadImageToDocx(client, blockId, buffer, fileName);
      await client.docx.documentBlock.patch({
        path: { document_id: docToken, block_id: blockId },
        data: {
          replace_image: { token: fileToken }
        }
      });
      processed++;
    } catch (err) {
      console.error(`\u5904\u7406\u56FE\u7247\u5931\u8D25 ${url}:`, err);
    }
  }
  return processed;
}
const STRUCTURED_BLOCK_TYPES = /* @__PURE__ */ new Set([14, 18, 21, 23, 27, 30, 31, 32]);
async function readDoc(client, docToken) {
  const [contentRes, infoRes, blocksRes] = await Promise.all([
    client.docx.document.rawContent({ path: { document_id: docToken } }),
    client.docx.document.get({ path: { document_id: docToken } }),
    client.docx.documentBlock.list({ path: { document_id: docToken } })
  ]);
  if (contentRes.code !== 0) throw new Error(contentRes.msg);
  const blocks = blocksRes.data?.items ?? [];
  const blockCounts = {};
  const structuredTypes = [];
  for (const b of blocks) {
    const type = b.block_type ?? 0;
    const name = BLOCK_TYPE_NAMES[type] || `type_${type}`;
    blockCounts[name] = (blockCounts[name] || 0) + 1;
    if (STRUCTURED_BLOCK_TYPES.has(type) && !structuredTypes.includes(name)) {
      structuredTypes.push(name);
    }
  }
  let hint;
  if (structuredTypes.length > 0) {
    hint = `\u672C\u6587\u6863\u5305\u542B ${structuredTypes.join(", ")}\uFF0C\u8FD9\u4E9B\u5185\u5BB9\u672A\u5305\u542B\u5728\u4E0A\u8FF0\u7EAF\u6587\u672C\u4E2D\u3002\u4F7F\u7528 feishu_doc action: "list_blocks" \u83B7\u53D6\u5B8C\u6574\u5185\u5BB9\u3002`;
  }
  return {
    title: infoRes.data?.document?.title,
    content: contentRes.data?.content,
    revision_id: infoRes.data?.document?.revision_id,
    block_count: blocks.length,
    block_types: blockCounts,
    ...hint && { hint }
  };
}
async function createDoc(client, title, folderToken) {
  const res = await client.docx.document.create({
    data: { title, folder_token: folderToken }
  });
  if (res.code !== 0) throw new Error(res.msg);
  const doc = res.data?.document;
  return {
    document_id: doc?.document_id,
    title: doc?.title,
    url: `https://feishu.cn/docx/${doc?.document_id}`
  };
}
async function writeDoc(client, docToken, markdown, maxBytes) {
  const deleted = await clearDocumentContent(client, docToken);
  const { blocks } = await convertMarkdown(client, markdown);
  if (blocks.length === 0) {
    return { success: true, blocks_deleted: deleted, blocks_added: 0, images_processed: 0 };
  }
  const { children: inserted, skipped } = await insertBlocks(client, docToken, blocks);
  const imagesProcessed = await processImages(client, docToken, markdown, inserted, maxBytes);
  return {
    success: true,
    blocks_deleted: deleted,
    blocks_added: inserted.length,
    images_processed: imagesProcessed,
    ...skipped.length > 0 && {
      warning: `\u8DF3\u8FC7\u4E86\u4E0D\u652F\u6301\u7684\u5757\u7C7B\u578B: ${skipped.join(", ")}\u3002\u8868\u683C\u4E0D\u652F\u6301\u901A\u8FC7\u6B64 API \u521B\u5EFA\u3002`
    }
  };
}
async function appendDoc(client, docToken, markdown, maxBytes) {
  const { blocks } = await convertMarkdown(client, markdown);
  if (blocks.length === 0) {
    throw new Error("\u5185\u5BB9\u4E3A\u7A7A");
  }
  const { children: inserted, skipped } = await insertBlocks(client, docToken, blocks);
  const imagesProcessed = await processImages(client, docToken, markdown, inserted, maxBytes);
  return {
    success: true,
    blocks_added: inserted.length,
    images_processed: imagesProcessed,
    block_ids: inserted.map((b) => b.block_id),
    ...skipped.length > 0 && {
      warning: `\u8DF3\u8FC7\u4E86\u4E0D\u652F\u6301\u7684\u5757\u7C7B\u578B: ${skipped.join(", ")}\u3002\u8868\u683C\u4E0D\u652F\u6301\u901A\u8FC7\u6B64 API \u521B\u5EFA\u3002`
    }
  };
}
async function updateBlock(client, docToken, blockId, content) {
  const blockInfo = await client.docx.documentBlock.get({
    path: { document_id: docToken, block_id: blockId }
  });
  if (blockInfo.code !== 0) throw new Error(blockInfo.msg);
  const res = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: {
      update_text_elements: {
        elements: [{ text_run: { content } }]
      }
    }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return { success: true, block_id: blockId };
}
async function deleteBlock(client, docToken, blockId) {
  const blockInfo = await client.docx.documentBlock.get({
    path: { document_id: docToken, block_id: blockId }
  });
  if (blockInfo.code !== 0) throw new Error(blockInfo.msg);
  const parentId = blockInfo.data?.block?.parent_id ?? docToken;
  const children = await client.docx.documentBlockChildren.get({
    path: { document_id: docToken, block_id: parentId }
  });
  if (children.code !== 0) throw new Error(children.msg);
  const items = children.data?.items ?? [];
  const index = items.findIndex((item) => item.block_id === blockId);
  if (index === -1) throw new Error("\u5757\u672A\u627E\u5230");
  const res = await client.docx.documentBlockChildren.batchDelete({
    path: { document_id: docToken, block_id: parentId },
    data: { start_index: index, end_index: index + 1 }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return { success: true, deleted_block_id: blockId };
}
async function listBlocks(client, docToken) {
  const res = await client.docx.documentBlock.list({
    path: { document_id: docToken }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    blocks: res.data?.items ?? []
  };
}
async function getBlock(client, docToken, blockId) {
  const res = await client.docx.documentBlock.get({
    path: { document_id: docToken, block_id: blockId }
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    block: res.data?.block
  };
}
async function listAppScopes(client) {
  const res = await client.application.scope.list({});
  if (res.code !== 0) throw new Error(res.msg);
  const scopes = res.data?.scopes ?? [];
  const granted = scopes.filter((s) => s.grant_status === 1);
  const pending = scopes.filter((s) => s.grant_status !== 1);
  return {
    granted: granted.map((s) => ({ name: s.scope_name, type: s.scope_type })),
    pending: pending.map((s) => ({ name: s.scope_name, type: s.scope_type })),
    summary: `\u5DF2\u6388\u6743 ${granted.length} \u4E2A\uFF0C\u5F85\u6388\u6743 ${pending.length} \u4E2A`
  };
}
function registerFeishuDocTools(api) {
  const feishuCfg = api.config?.channels?.feishu;
  if (!feishuCfg?.appId || !feishuCfg?.appSecret) {
    api.logger.debug?.("[feishu_doc] \u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E\uFF0C\u8DF3\u8FC7\u6587\u6863\u5DE5\u5177\u6CE8\u518C");
    return;
  }
  const toolsCfg = resolveToolsConfig(feishuCfg.tools);
  const mediaMaxBytes = (feishuCfg?.mediaMaxMb ?? 30) * 1024 * 1024;
  const getClient = () => createFeishuClient(feishuCfg);
  const registered = [];
  if (toolsCfg.doc) {
    api.registerTool(
      {
        name: "feishu_doc",
        label: "\u98DE\u4E66\u6587\u6863",
        description: "\u98DE\u4E66\u6587\u6863\u64CD\u4F5C\u3002\u652F\u6301: read(\u8BFB\u53D6), write(\u8986\u76D6\u5199\u5165), append(\u8FFD\u52A0), create(\u521B\u5EFA), list_blocks(\u5217\u51FA\u5757), get_block(\u83B7\u53D6\u5757), update_block(\u66F4\u65B0\u5757), delete_block(\u5220\u9664\u5757)",
        parameters: FeishuDocJsonSchema,
        async execute(_toolCallId, params) {
          const p = params;
          try {
            const client = getClient();
            switch (p.action) {
              case "read":
                return json(await readDoc(client, p.doc_token));
              case "write":
                return json(await writeDoc(client, p.doc_token, p.content, mediaMaxBytes));
              case "append":
                return json(await appendDoc(client, p.doc_token, p.content, mediaMaxBytes));
              case "create":
                return json(await createDoc(client, p.title, p.folder_token));
              case "list_blocks":
                return json(await listBlocks(client, p.doc_token));
              case "get_block":
                return json(await getBlock(client, p.doc_token, p.block_id));
              case "update_block":
                return json(await updateBlock(client, p.doc_token, p.block_id, p.content));
              case "delete_block":
                return json(await deleteBlock(client, p.doc_token, p.block_id));
              default:
                return json({ error: `\u672A\u77E5\u64CD\u4F5C: ${p.action}` });
            }
          } catch (err) {
            return json({ error: err instanceof Error ? err.message : String(err) });
          }
        }
      },
      { name: "feishu_doc" }
    );
    registered.push("feishu_doc");
  }
  if (toolsCfg.scopes) {
    api.registerTool(
      {
        name: "feishu_app_scopes",
        label: "\u98DE\u4E66\u5E94\u7528\u6743\u9650",
        description: "\u5217\u51FA\u5F53\u524D\u5E94\u7528\u7684\u6743\u9650 (scopes)\u3002\u7528\u4E8E\u8C03\u8BD5\u6743\u9650\u95EE\u9898\u6216\u68C0\u67E5\u53EF\u7528\u80FD\u529B\u3002",
        parameters: { type: "object", properties: {} },
        async execute() {
          try {
            const result = await listAppScopes(getClient());
            return json(result);
          } catch (err) {
            return json({ error: err instanceof Error ? err.message : String(err) });
          }
        }
      },
      { name: "feishu_app_scopes" }
    );
    registered.push("feishu_app_scopes");
  }
  if (registered.length > 0) {
    api.logger.info?.(`[feishu_doc] \u5DF2\u6CE8\u518C\u5DE5\u5177: ${registered.join(", ")}`);
  }
}
export {
  registerFeishuDocTools
};
