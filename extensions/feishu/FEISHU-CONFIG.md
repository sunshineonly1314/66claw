# 飞书渠道配置指南

> 版本: 2026.2.5
>
> 融合自 m1heng/openclawcn-feishu 的增强功能 (MIT License)

---

## 功能概览

| 功能 | 说明 |
|-----|------|
| **WebSocket 长连接** | 推荐模式，无需公网 IP |
| **入站媒体支持** | AI 可以接收并理解图片、文件、语音、视频、表情包、富文本内联图片 |
| **出站媒体支持** | 可以发送图片和文件 |
| **卡片渲染模式** | Markdown 代码高亮、表格 |
| **@ 提及转发** | 消息中 @ 某人，回复自动带 @ |
| **国际版支持** | 支持 Lark (国际版) |
| **飞书文档工具** | AI 可以读写飞书文档 |
| **知识库工具** | AI 可以浏览/搜索知识库 |
| **多维表格工具** | AI 可以读写多维表格 |
| **云空间工具** | AI 可以管理云空间文件 |

---

## 配置方式

### 新版扁平配置（推荐）

```yaml
channels:
  feishu:
    enabled: true
    appId: "cli_xxxxx"
    appSecret: "your_app_secret"
    
    # 可选配置
    domain: "feishu"              # feishu (国内) / lark (国际)
    connectionMode: "websocket"   # websocket (推荐) / webhook
    renderMode: "auto"            # auto / raw / card
```

### 旧版嵌套配置（兼容）

```yaml
channels:
  feishu:
    enabled: true
    app:
      appId: "cli_xxxxx"
      appSecret: "your_app_secret"
      verificationToken: "xxx"    # Webhook 模式需要
      encryptKey: "xxx"           # 可选加密
```

---

## 完整配置选项

```yaml
channels:
  feishu:
    # ========== 基础配置 ==========
    enabled: true                    # 是否启用
    appId: "cli_xxxxx"               # App ID
    appSecret: "xxx"                 # App Secret
    encryptKey: "xxx"                # 加密密钥 (可选)
    verificationToken: "xxx"         # 验证 Token (Webhook 模式需要)

    # ========== 连接配置 ==========
    domain: "feishu"                 # feishu (国内) / lark (国际)
    connectionMode: "websocket"      # websocket (推荐) / webhook
    webhookPath: "/feishu/webhook"   # Webhook 路径 (Webhook 模式)
    webhookPort: 3001                # Webhook 端口 (可选)

    # ========== 私聊配置 ==========
    dmPolicy: "pairing"              # open / pairing / allowlist
    allowFrom:                       # 允许的用户 (dmPolicy=allowlist 时需要)
      - "ou_xxx"
      - "*"                          # dmPolicy=open 时需要包含 *
    dmHistoryLimit: 10               # 私聊历史消息限制

    # ========== 群聊配置 ==========
    groupPolicy: "allowlist"         # open / allowlist / disabled
    groupAllowFrom:                  # 群聊允许的发送者
      - "ou_xxx"
    requireMention: true             # 群聊是否需要 @机器人
    historyLimit: 20                 # 群聊历史消息限制
    groups:                          # 各群单独配置
      "oc_xxx":
        requireMention: false
        allowFrom: ["ou_xxx"]

    # ========== 消息配置 ==========
    renderMode: "auto"               # auto / raw / card
    textChunkLimit: 4000             # 文本分片限制
    chunkMode: "length"              # length / newline
    markdown:
      mode: "native"                 # native / escape / strip
      tableMode: "ascii"             # native / ascii / simple

    # ========== 媒体配置 ==========
    mediaMaxMb: 30                   # 媒体最大大小 (MB)

    # ========== 工具配置 (可选功能) ==========
    tools:
      doc: true                      # 文档操作
      wiki: true                     # 知识库操作
      drive: true                    # 云空间操作
      perm: false                    # 权限管理 (敏感)
      scopes: true                   # 应用权限诊断
```

---

## 渲染模式说明

| 模式 | 说明 |
|------|------|
| `auto` | （默认）自动检测：有代码块或表格时用卡片，否则纯文本 |
| `raw` | 始终纯文本，表格转为 ASCII |
| `card` | 始终使用卡片，支持语法高亮、表格、链接 |

---

## 连接模式对比

| 特性 | WebSocket（推荐） | Webhook |
|-----|------------------|---------|
| 公网 IP | ❌ 不需要 | ✅ 需要 |
| 配置复杂度 | 简单 | 中等 |
| 实时性 | 高 | 高 |
| 稳定性 | 高 | 依赖网络 |
| 飞书平台配置 | 选择"长连接" | 需要配置回调地址 |

---

## 飞书平台配置

### 1. 创建应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建自建应用
3. 获取 App ID 和 App Secret

### 2. 必需权限

**基础消息功能：**

| 权限 | 说明 |
|-----|------|
| `contact:user.base:readonly` | 获取用户基本信息 |
| `im:message.p2p_msg:readonly` | 读取私聊消息 |
| `im:message:send_as_bot` | 以机器人身份发送消息 |
| `im:message:readonly` | 读取消息内容 |
| `im:chat:readonly` | 获取会话信息 |
| `im:resource` | 上传和下载图片/文件/语音/视频（收发媒体必需） |

**可选权限（群聊功能）：**

| 权限 | 说明 |
|-----|------|
| `im:message.group_at_msg:readonly` | 接收群聊 @消息 |

### 3. 事件订阅

在 **事件与回调** 页面配置：

1. **事件配置方式**：选择 **使用长连接接收事件**（WebSocket 模式）
2. **添加事件**：
   - `im.message.receive_v1`（接收消息，必需）
   - `im.message.message_read_v1`（消息已读，可选）
   - `im.chat.member.bot.added_v1`（机器人入群，可选）
   - `im.chat.member.bot.deleted_v1`（机器人退群，可选）

---

## 打包注意事项

### 1. 依赖变更

`package.json` 新增依赖：

```json
{
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.58.0"
  }
}
```

> **注意**：SDK 1.58.0 中 `client.bot` 命名空间已移除，获取机器人信息需要使用 `client.request()` 直接调用 `/open-apis/bot/v3/info`。

### 2. 打包时需要

- 确保 `@larksuiteoapi/node-sdk` 包含在 node_modules 中
- 该 SDK 约 2MB，会增加安装包大小

### 3. 离线打包

如果需要离线安装，确保预打包 node_modules 时包含：

```bash
npm install @larksuiteoapi/node-sdk --save
```

---

## 常见问题

### Q: 机器人收不到消息

**检查清单**：
- [ ] 事件订阅是否配置正确
- [ ] WebSocket 模式：是否选择了"长连接"
- [ ] 权限是否已审核通过

### Q: 发送消息 403 错误

确保已申请并通过 `im:message:send_as_bot` 权限

### Q: 图片/文件收发失败

1. 检查 `im:resource` 权限是否已开通（接收和发送图片/文件都需要此权限）
2. 文件大小是否超过 30MB
3. 支持的入站媒体类型：图片、文件、语音、视频、表情包、富文本内联图片

### Q: 国际版 Lark 如何配置

```yaml
channels:
  feishu:
    domain: "lark"  # 使用 lark 而非 feishu
```

---

## 从旧版迁移

如果你之前使用旧版嵌套配置：

```yaml
# 旧版
channels:
  feishu:
    app:
      appId: "xxx"
      appSecret: "xxx"
```

建议迁移到新版扁平配置：

```yaml
# 新版（推荐）
channels:
  feishu:
    appId: "xxx"
    appSecret: "xxx"
    connectionMode: "websocket"  # 新增：使用 WebSocket
    renderMode: "auto"           # 新增：自动渲染模式
```

旧版配置仍然兼容，但建议迁移以使用新功能。

---

## 飞书工具详解

### 工具列表

| 工具名称 | 功能 | 使用场景 |
|---------|------|---------|
| `feishu_doc` | 文档操作 | 读取/创建/编辑飞书文档 |
| `feishu_wiki` | 知识库操作 | 浏览/搜索/创建知识库节点 |
| `feishu_bitable_*` | 多维表格操作 | 读取/创建/更新表格记录 |
| `feishu_drive` | 云空间操作 | 管理文件和文件夹 |
| `feishu_app_scopes` | 权限诊断 | 检查应用已授权的权限 |

### 工具权限要求

#### 文档工具 (feishu_doc) 权限

| 权限 | 说明 | 操作 |
|-----|------|-----|
| `docx:document:readonly` | 只读 | read, list_blocks, get_block |
| `docx:document` | 读写 | create, write, append, update_block, delete_block |
| `docx:document.block:convert` | 转换 | write, append (Markdown 转块) |
| `drive:drive` | 云空间 | 文档中上传图片 |

#### 知识库工具 (feishu_wiki) 权限

| 权限 | 说明 | 操作 |
|-----|------|-----|
| `wiki:wiki:readonly` | 只读 | spaces, nodes, get |
| `wiki:wiki` | 读写 | create, move, rename |

**重要**: 仅有 API 权限不够！还需要将机器人添加到知识库空间成员。

#### 多维表格工具 (feishu_bitable) 权限

| 权限 | 说明 | 操作 |
|-----|------|-----|
| `bitable:app:readonly` | 只读 | get_meta, list_fields, list_records, get_record |
| `bitable:app` | 读写 | create_record, update_record |

**重要**: 机器人只能访问被分享给它的多维表格。

#### 云空间工具 (feishu_drive) 权限

| 权限 | 说明 | 操作 |
|-----|------|-----|
| `drive:drive:readonly` | 只读 | list, get |
| `drive:drive` | 读写 | create_folder, move, delete |

**重要**: 机器人没有"我的空间"，只能访问被分享的文件夹。

---

### feishu_doc 使用示例

```
用户: 帮我读取这个文档 https://feishu.cn/docx/abc123
AI: [调用 feishu_doc action="read" doc_token="abc123"]

用户: 帮我创建一个会议纪要
AI: [调用 feishu_doc action="create" title="2026年2月会议纪要"]
    [调用 feishu_doc action="write" doc_token="新文档token" content="## 会议内容..."]
```

**支持的操作**:

| Action | 参数 | 说明 |
|--------|-----|------|
| `read` | doc_token | 读取文档纯文本内容 |
| `create` | title, folder_token? | 创建新文档 |
| `write` | doc_token, content | 覆盖写入 (Markdown) |
| `append` | doc_token, content | 追加内容 |
| `list_blocks` | doc_token | 列出所有块 |
| `get_block` | doc_token, block_id | 获取单个块 |
| `update_block` | doc_token, block_id, content | 更新块 |
| `delete_block` | doc_token, block_id | 删除块 |

---

### feishu_wiki 使用示例

```
用户: 列出我们的知识库空间
AI: [调用 feishu_wiki action="spaces"]

用户: 在产品文档空间创建一个新页面
AI: [调用 feishu_wiki action="create" space_id="xxx" title="新功能说明"]
```

**支持的操作**:

| Action | 参数 | 说明 |
|--------|-----|------|
| `spaces` | - | 列出所有知识库空间 |
| `nodes` | space_id, parent_node_token? | 列出节点 |
| `get` | token | 获取节点详情 |
| `create` | space_id, title, obj_type?, parent_node_token? | 创建节点 |
| `move` | space_id, node_token, target_space_id?, target_parent_token? | 移动节点 |
| `rename` | space_id, node_token, title | 重命名 |

---

### feishu_bitable 使用示例

```
用户: 帮我查看这个表格 https://feishu.cn/base/abc123?table=tbl456
AI: [调用 feishu_bitable_get_meta url="https://..."]
    [调用 feishu_bitable_list_fields app_token="abc123" table_id="tbl456"]
    [调用 feishu_bitable_list_records app_token="abc123" table_id="tbl456"]

用户: 添加一条新记录
AI: [调用 feishu_bitable_create_record app_token="..." table_id="..." fields={"姓名":"张三","部门":"研发"}]
```

**工具列表**:

| 工具 | 参数 | 说明 |
|-----|-----|------|
| `feishu_bitable_get_meta` | url | 解析 URL，获取 app_token 和表格列表 |
| `feishu_bitable_list_fields` | app_token, table_id | 列出字段 (列) |
| `feishu_bitable_list_records` | app_token, table_id, page_size?, page_token? | 列出记录 (行) |
| `feishu_bitable_get_record` | app_token, table_id, record_id | 获取单条记录 |
| `feishu_bitable_create_record` | app_token, table_id, fields | 创建记录 |
| `feishu_bitable_update_record` | app_token, table_id, record_id, fields | 更新记录 |

---

### feishu_drive 使用示例

```
用户: 列出我的文件
AI: [调用 feishu_drive action="list"]

用户: 在共享文件夹里创建一个新文件夹
AI: [调用 feishu_drive action="create_folder" name="项目资料" parent_folder_token="xxx"]
```

**支持的操作**:

| Action | 参数 | 说明 |
|--------|-----|------|
| `list` | folder_token? | 列出文件 (空=根目录，需分享权限) |
| `get` | file_token, file_type | 获取文件详情 |
| `create_folder` | name, parent_folder_token? | 创建文件夹 |
| `move` | file_token, file_type, target_folder_token | 移动文件 |
| `delete` | file_token, file_type | 删除文件 |

---

## 工具配置开关

在配置中可以单独启用/禁用各个工具：

```yaml
channels:
  feishu:
    enabled: true
    appId: "cli_xxx"
    appSecret: "xxx"
    
    # 工具配置
    tools:
      doc: true      # 文档工具（默认启用）
      wiki: true     # 知识库工具（默认启用）
      drive: true    # 云空间工具（默认启用）
      perm: false    # 权限管理工具（默认禁用，敏感）
      scopes: true   # 应用权限诊断（默认启用）
```

如果某个工具不需要，设为 `false` 可以减少 AI 的工具选择负担。

---

## 资源访问权限设置

### 文档访问权限

飞书文档默认只有创建者可以访问。要让机器人能操作文档：

1. 打开文档
2. 点击右上角 **分享**
3. 搜索机器人名称
4. 选择权限（查看/编辑）

### 知识库空间访问权限

> ⚠️ **重要**：API 权限不等于空间访问权限！

1. 打开知识库空间
2. 点击 **设置**（齿轮图标）
3. 点击 **成员管理**
4. 点击 **添加成员** → 搜索机器人名称
5. 选择权限级别

参考：https://open.feishu.cn/document/server-docs/docs/wiki-v2/wiki-qa#a40ad4ca

### 多维表格访问权限

> ⚠️ **重要**：机器人只能访问被分享给它的多维表格！

1. 打开多维表格
2. 点击 **分享**
3. 搜索机器人名称
4. 选择权限

### 云空间文件夹访问权限

> ⚠️ **重要**：机器人没有自己的"我的空间"！

1. 创建一个文件夹
2. 右键 → **分享**
3. 搜索机器人名称
4. 授予权限

---

## 相关链接

| 用途 | 链接 |
|------|------|
| 飞书开放平台 | https://open.feishu.cn/app |
| 开发者文档 | https://open.feishu.cn/document |
| 权限说明 | https://open.feishu.cn/document/ukTMukTMukTM/uITNz4iM1MjLyUzM |

---

*文档更新时间：2026-02-05*
*适用于飞书开放平台 2026 版界面*
