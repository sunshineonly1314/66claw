# ⚡ 快速启动指南 - 技能安装界面测试

## 🎯 方案 A：仅测试前端 UI（推荐用于界面预览）

### 1. 启动前端开发服务器
```bash
cd ui
npm run dev
```

访问：http://localhost:5173

### 2. 在浏览器控制台手动触发组件

打开浏览器控制台（F12），复制粘贴以下代码：

```javascript
// 模拟 Banner 组件
const mockApp = {
  skillsBatch: {
    batchPhase: 'banner',
    batchCheckResult: {
      missing: [
        { name: 'weather', icon: '🌤', category: 'productivity', size_bytes: 1024000, tier: 'core', method: 'npm', description: '天气查询' },
        { name: 'summarize', icon: '📝', category: 'productivity', size_bytes: 2048000, tier: 'recommended', method: 'npm', description: '网页摘要' },
        { name: 'github', icon: '🐙', category: 'development', size_bytes: 512000, tier: 'optional', method: 'npm', description: 'GitHub' },
        { name: 'oracle', icon: '🔮', category: 'productivity', size_bytes: 1536000, tier: 'recommended', method: 'npm', description: '代码审查' },
        { name: 'mcporter', icon: '🔌', category: 'development', size_bytes: 768000, tier: 'optional', method: 'npm', description: 'MCP工具' },
        { name: 'openhue', icon: '💡', category: 'iot', size_bytes: 256000, tier: 'optional', method: 'npm', description: '智能灯光' },
      ],
      installed: [
        { name: 'slack', icon: '💬', tier: 'recommended' }
      ],
      total_size_bytes: 6144000,
      estimated_seconds: 45,
      disk_available_bytes: 10000000000,
      disk_ok: true
    }
  },
  requestUpdate: () => console.log('State updated')
};

// 将模拟对象挂载到全局
window.__clawdbot_app = mockApp;

console.log('✅ 模拟数据已加载！请刷新页面并进入 Chat 标签页查看效果');
```

---

## 🎯 方案 B：完整后端测试（用于功能测试）

### 前置条件
项目需要完整构建。如果遇到构建问题，请按以下步骤：

### 1. 跳过有问题的构建步骤
```bash
# 直接使用已有的 dist 目录
cd d:/codeknowledge/clawdbot-main/clawdbot-main

# 如果 dist 目录不存在，尝试简化构建
npm run build:simple  # 如果有这个命令
# 或
npx tsdown  # 仅编译 TypeScript
```

### 2. 启动后端
```bash
node dist/main.js
# 或
npm run dev
```

### 3. 访问控制台
http://localhost:3000 （或配置的端口）

---

## 🎨 方案 C：预览独立 HTML 页面（最简单）

### 直接在浏览器打开以下文件：

1. **Banner 横幅**
   ```
   file:///d:/codeknowledge/clawdbot-main/clawdbot-main/ui/1-chat-banner.html
   ```

2. **Confirm 对话框**
   ```
   file:///d:/codeknowledge/clawdbot-main/clawdbot-main/ui/2-download-confirm.html
   ```

3. **Progress 进度**
   ```
   file:///d:/codeknowledge/clawdbot-main/clawdbot-main/ui/3-download-progress.html
   ```

4. **Complete 完成页**
   ```
   file:///d:/codeknowledge/clawdbot-main/clawdbot-main/ui/skills-complete.html
   ```

5. **测试页面**
   ```
   file:///d:/codeknowledge/clawdbot-main/clawdbot-main/ui/test-enhanced-components.html
   ```

这些是您的**原始设计页面**，可以直接预览视觉效果！

---

## 🧪 快速视觉验证

### 在任何 HTML 页面，您应该看到：

✅ **霓虹青色主题** (`#00e5ff`)
✅ **暗黑背景** (`#07080d` / `#0e1017`)
✅ **JetBrains Mono** 数字字体
✅ **渐变按钮** + 悬停动画
✅ **技能药丸** 展示
✅ **Complete 页面**: 彩纸动画 + 环形扩散

---

## 📝 如果遇到构建问题

### 常见原因
1. `tsdown` 命令未找到
2. Canvas A2UI 构建失败
3. 依赖缺失

### 解决方案

#### 选项 1: 仅测试前端（推荐）
```bash
cd ui
npm install
npm run dev
```
然后使用方案 A 的控制台脚本

#### 选项 2: 使用已有构建
如果 `dist/` 目录已存在：
```bash
node dist/main.js
```

#### 选项 3: 预览独立 HTML
直接在浏览器打开 `ui/*.html` 文件

---

## ✅ 验收标准

### 最低标准（独立 HTML 预览）
- [x] 打开 `skills-complete.html`
- [x] 看到霓虹青色主题
- [x] 看到彩纸动画
- [x] 看到技能卡片展示

### 完整标准（前端开发服务器）
- [ ] `npm run dev` 启动成功
- [ ] Chat 页面显示 Banner
- [ ] 点击按钮触发 Confirm
- [ ] 模拟数据正确显示

### 理想标准（完整后端）
- [ ] 后端服务启动
- [ ] WebSocket 连接成功
- [ ] 完整安装流程测试
- [ ] 所有4个阶段正常显示

---

## 🎉 推荐测试流程

### 第一步：视觉验证（5分钟）
1. 打开 `ui/skills-complete.html`
2. 验证所有视觉效果正常

### 第二步：前端集成（10分钟）
1. `cd ui && npm run dev`
2. 访问 http://localhost:5173
3. 使用控制台脚本触发组件

### 第三步：完整测试（可选）
1. 解决构建问题
2. 启动后端服务
3. 完整流程测试

---

## 💡 提示

- **最快预览**: 直接打开 `skills-complete.html` ✨
- **功能测试**: 使用前端开发服务器 + 控制台脚本
- **生产测试**: 需要完整后端服务

---

**选择一个方案立即开始测试！** 🚀

推荐从**方案 C（独立 HTML）**开始，先看到视觉效果，再进行功能集成测试。
