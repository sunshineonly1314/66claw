---
name: raycast-extensions
name_zh: Raycast
description: 使用 Raycast API 构建并维护 Raycast 扩展。触发关键词包括 @raycast/api、List、Grid、Detail、Form、AI.ask、LocalStorage、Cache、showToast 和 BrowserExtension。以本仓库中 references/api/*.md 文件作为组件规范与 API 用法的首要权威来源。
description_zh: 使用 Raycast API 构建并维护 Raycast 扩展。触发关键词包括 @raycast/api、List、Grid、Detail、Form、AI.ask、LocalStorage、Cache、showToast 和 BrowserExtension。以本仓库中 references/api/*.md 文件作为组件规范与 API 用法的首要权威来源。
---
# Raycast 扩展技能（Raycast Extensions Skill）

使用 React、TypeScript 以及 Raycast API 构建功能强大的扩展。

## 快速入门（Agent 工作流）

当被要求实现或修复 Raycast 功能时，请遵循以下步骤：

1. **识别核心组件**：确定 UI 是否需要使用 `List`、`Grid`、`Detail` 或 `Form`。
2. **查阅参考文档**：打开并阅读 `references/api/` 中对应的文件（例如 `references/api/list.md`）。
3. **使用默认实践**：
    - **反馈机制**：对加载、成功、失败状态统一使用 `showToast`；仅对快速后台完成任务使用 `showHUD`。
    - **数据存储**：对高频/临时数据使用 `Cache`；对需持久化保存的用户数据使用 `LocalStorage`。
    - **权限检查**：在使用前务必检查 `environment.canAccess(AI)` 或 `environment.canAccess(BrowserExtension)`。
4. **实现代码**：使用 `@raycast/api` 组件提供简洁的实现。
5. **引用说明**：回链至您所依据的具体 `references/api/*.md` 文件。

## 食谱式模式（Cookbook Patterns）

### 1. List 与 Grid（可搜索 UI）
对文本密集型数据使用 `List`；对图像密集型数据使用 `Grid`。
- [List 参考文档](references/api/list.md) | [Grid 参考文档](references/api/grid.md)

```tsx
<List isLoading={isLoading} searchBarPlaceholder="Search items..." throttle>
  <List.Item
    title="Item Title"
    subtitle="Subtitle"
    accessories={[{ text: "Tag" }]}
    actions={
      <ActionPanel>
        <Action.Push title="View Details" target={<Detail markdown="# Details" />} />
        <Action.CopyToClipboard title="Copy" content="value" />
      </ActionPanel>
    }
  />
</List>
```

### 2. Detail（富 Markdown 内容）
适用于展示长篇幅内容或条目详情。
- [Detail 参考文档](references/api/detail.md)

```tsx
<Detail
  isLoading={isLoading}
  markdown="# Heading\nContent here."
  metadata={
    <Detail.Metadata>
      <Detail.Metadata.Label title="Status" text="Active" icon={Icon.Checkmark} />
    </Detail.Metadata>
  }
/>
```

### 3. Form（用户输入）
务必包含一个 `SubmitForm` 操作。
- [Form 参考文档](references/api/form.md)

```tsx
<Form
  actions={
    <ActionPanel>
      <Action.SubmitForm onSubmit={(values) => console.log(values)} />
    </ActionPanel>
  }
>
  <Form.TextField id="title" title="Title" placeholder="Enter title" />
  <Form.TextArea id="description" title="Description" />
</Form>
```

### 4. 反馈与交互性
大多数反馈场景优先选用 `showToast`。
- [Toast 参考文档](references/api/toast.md) | [HUD 参考文档](references/api/hud.md)

```typescript
// Success/Failure
await showToast({ style: Toast.Style.Success, title: "Success!" });

// HUD (Overlay)
await showHUD("Done!");
```

### 5. 数据持久化
为提升性能使用 `Cache`；为保障持久化使用 `LocalStorage`。
- [Cache 参考文档](references/api/caching.md) | [Storage 参考文档](references/api/storage.md)

```typescript
// Cache (Sync/Transient)
const cache = new Cache();
cache.set("key", "value");

// LocalStorage (Async/Persistent)
await LocalStorage.setItem("key", "value");
```

### 6. AI 与浏览器扩展（受限 API）
务必在 `environment.canAccess` 检查内封装调用。
- [AI 参考文档](references/api/ai.md) | [浏览器扩展参考文档](references/api/browser-extension.md)

```typescript
if (environment.canAccess(AI)) {
  const result = await AI.ask("Prompt");
}

if (environment.canAccess(BrowserExtension)) {
  const tabs = await BrowserExtension.getTabs();
}
```

## 其他资源

### API 参考目录树

- **UI 组件**
  - [操作面板（Action Panel）](references/api/action-panel.md)
  - [详情页（Detail）](references/api/detail.md)
  - [表单（Form）](references/api/form.md)
  - [网格（Grid）](references/api/grid.md)
  - [列表（List）](references/api/list.md)
  - [用户界面（User Interface）](references/api/user-interface.md)
- **交互性**
  - [操作（Actions）](references/api/actions.md)
  - [警告（Alert）](references/api/alert.md)
  - [键盘（Keyboard）](references/api/keyboard.md)
  - [导航（Navigation）](references/api/navigation.md)
  - [Raycast 窗口搜索栏（Raycast Window Search Bar）](references/api/raycast-window-search-bar.md)
- **工具与服务**
  - [AI](references/api/ai.md)
  - [浏览器扩展（Browser Extension）](references/api/browser-extension.md)
  - [剪贴板（Clipboard）](references/api/clipboard.md)
  - [环境（Environment）](references/api/environment.md)
  - [反馈与 HUD（Feedback & HUD）](references/api/feedback.md)
    - [HUD](references/api/hud.md)
    - [Toast](references/api/toast.md)
  - [OAuth](references/api/oauth.md)
  - [系统工具（System Utilities）](references/api/system-utilities.md)
- **数据与配置**
  - [缓存（Caching）](references/api/caching.md)
  - [颜色（Colors）](references/api/colors.md)
  - [图标与图像（Icons & Images）](references/api/icons-images.md)
  - [偏好设置（Preferences）](references/api/preferences.md)
  - [存储（Storage）](references/api/storage.md)
- **进阶功能**
  - [命令相关工具（Command Related Utilities）](references/api/command-related-utilities.md)
  - [菜单栏命令（Menu Bar Commands）](references/api/menu-bar-commands.md)
  - [工具（Tool）](references/api/tool.md)
  - [窗口管理（Window Management）](references/api/window-management.md)

## 示例

如需查看融合多个组件与 API 的端到端示例，请参阅 [examples.md](examples.md)。