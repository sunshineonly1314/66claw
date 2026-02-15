# TODO-05: 扩展/插件改进

**优先级**: P2  
**预估工时**: 2天  
**影响**: 扩展可靠性、可维护性

## 问题清单

### 5.1 企微 Bot @提及检测改进

**位置**: `extensions/wecom/src/channel.ts:72-91`  
**现状**: 简单字符串匹配，可能误判。  
**建议**:
- 优先使用 WeCom API 的 `mentioned_list` 字段
- 回退到正则匹配时使用更精确的模式 `@BotName(?:\s|$)`

---

### 5.2 插件 ID 校验

**位置**: `src/plugins/config-state.ts:58-76`  
**现状**: `normalizePluginEntries()` 不验证插件 ID 是否存在于注册表。  
**建议**:
- 添加 `log.warn` 对未知插件 ID
- 不阻塞流程（向前兼容），仅告警

```typescript
if (!registryIds.has(pluginId)) {
  log.warn(`Unknown plugin ID in config: "${pluginId}", skipping`);
  continue;
}
```

---

### 5.3 插槽选择注册表一致性校验

**位置**: `src/plugins/slots.ts:35-100`  
**现状**: `applyExclusiveSlotSelection()` 不验证被操作的插件是否在注册表中。  
**建议**: 操作前过滤出注册表中存在的同插槽插件列表。

---

### 5.4 Bundled 插件列表动态化

**位置**: `src/plugins/config-state.ts:19-43`  
**现状**: 默认启用的 bundled 插件列表硬编码。  
**建议**:
- 在 `openclawcn.plugin.json` 中添加 `"bundled": true` 标记
- 扫描 extensions/ 目录动态构建列表
- 减少手动维护负担

---

### 5.5 Lobster 工具输出截断提示

**位置**: `extensions/lobster/src/lobster-tool.ts:127-134`  
**现状**: 输出超限直接截断，无提示。  
**建议**: 截断时附加 `[output truncated: showing X of Y characters]` 标记。

---

### 5.6 飞书卡片检测优化

**位置**: `extensions/feishu/src/channel.ts:96-103`  
**现状**: 使用正则检测卡片消息类型。  
**建议**: 使用简单字符串比较替代正则，性能更好。

## 验收标准

- [ ] 企微提及检测使用 API 字段优先
- [ ] 未知插件 ID 有告警日志
- [ ] 插槽操作校验注册表一致性
- [ ] Lobster 截断有用户提示
