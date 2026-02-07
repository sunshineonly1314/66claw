# BUG-06: 扩展/插件问题 [低]

## Bug 6.1: 企微 Bot @提及检测过于简单

**位置**: `extensions/wecom/src/channel.ts:72-91`  
**严重度**: 低  
**类型**: 逻辑不完善  

**问题描述**:
WeCom 扩展中的 Bot @提及检测使用简单字符串匹配，可能产生误判：
- 误报：消息中包含 Bot 名称但不是 @提及
- 漏报：@提及使用了别名或昵称

**修复建议**:
```typescript
// 使用 WeCom API 提供的提及信息
function isBotMentioned(message: WeComMessage): boolean {
  // 优先使用 API 的 mentioned_list
  if (message.mentioned_list?.includes(botUserId)) {
    return true;
  }
  
  // 回退到文本检测，但使用更精确的模式
  const mentionPattern = new RegExp(`@${escapeRegex(botName)}(?:\\s|$)`, 'i');
  return mentionPattern.test(message.content);
}
```

---

## Bug 6.2: 飞书卡片检测正则可优化

**位置**: `extensions/feishu/src/channel.ts:96-103`  
**严重度**: 低  
**类型**: 性能  

**问题描述**:
卡片渲染模式检测使用正则表达式，但可以使用更高效的方式。

**修复建议**:
```typescript
// 如果只需要检测是否为卡片类型，使用简单判断
function isCardMessage(msgType: string): boolean {
  return msgType === 'interactive' || msgType === 'template';
}
```

---

## Bug 6.3: 插件 ID 未验证

**位置**: `src/plugins/config-state.ts:58-76`  
**严重度**: 低  
**类型**: 验证不足  

**问题描述**:
`normalizePluginEntries()` 处理插件配置时，不验证插件 ID 是否在注册表中存在。无效的插件 ID 会被静默接受。

**修复建议**:
```typescript
function normalizePluginEntries(
  config: PluginConfig,
  registry: PluginRegistry,
): NormalizedPluginEntries {
  const validIds = new Set(registry.plugins.map(p => p.id));
  const entries: NormalizedPluginEntries = {};
  
  for (const [id, value] of Object.entries(config)) {
    if (!validIds.has(id)) {
      log.warn(`Unknown plugin ID: ${id}, skipping`);
      continue;
    }
    entries[id] = normalizeEntry(value);
  }
  
  return entries;
}
```

---

## Bug 6.4: 插槽选择不验证注册表一致性

**位置**: `src/plugins/slots.ts:35-100`  
**严重度**: 低  
**类型**: 一致性  

**问题描述**:
`applyExclusiveSlotSelection()` 修改配置时不验证被禁用的插件是否确实在注册表中存在。

**修复建议**:
```typescript
function applyExclusiveSlotSelection(
  config: ClawdbotConfig,
  slotType: string,
  selectedId: string,
  registry: PluginRegistry,
): ClawdbotConfig {
  const slotPlugins = registry.plugins
    .filter(p => p.slot === slotType)
    .map(p => p.id);
  
  // 只处理注册表中存在的插件
  for (const pluginId of slotPlugins) {
    if (pluginId === selectedId) {
      config.plugins[pluginId] = { enabled: true };
    } else {
      config.plugins[pluginId] = { enabled: false };
    }
  }
  
  return config;
}
```

---

## Bug 6.5: Bundled 插件列表硬编码

**位置**: `src/plugins/config-state.ts:19-43`  
**严重度**: 低  
**类型**: 可维护性  

**问题描述**:
默认启用的 bundled 插件列表是硬编码的。新增 bundled 插件必须手动更新此列表。

**修复建议**:
```typescript
// 从 plugin.json 描述文件中读取 bundled 标记
function getBundledPluginIds(): string[] {
  const pluginsDir = path.join(__dirname, '../../extensions');
  const bundled: string[] = [];
  
  for (const dir of fs.readdirSync(pluginsDir)) {
    const manifest = loadPluginManifest(path.join(pluginsDir, dir));
    if (manifest?.bundled) {
      bundled.push(manifest.id);
    }
  }
  
  return bundled;
}
```

---

## Bug 6.6: Lobster 工具输出截断无提示

**位置**: `extensions/lobster/src/lobster-tool.ts:127-134`  
**严重度**: 低  
**类型**: 用户体验  

**问题描述**:
Lobster Pipeline 执行输出超过大小限制时直接截断，没有告知用户输出已被截断。

**修复建议**:
```typescript
if (output.length > MAX_OUTPUT_SIZE) {
  const truncated = output.substring(0, MAX_OUTPUT_SIZE);
  return {
    output: truncated,
    truncated: true,
    originalSize: output.length,
    message: `输出已截断（${MAX_OUTPUT_SIZE}/${output.length} 字符）`,
  };
}
```
