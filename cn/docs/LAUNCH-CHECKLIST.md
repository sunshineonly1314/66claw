# 🚀 技能安装界面启动检查清单

## ✅ 文件完整性检查

### 核心组件（必须存在）
- [x] `ui/src/ui/views/skills-batch-animations.ts` - 共享动画库
- [x] `ui/src/ui/views/skills-batch-banner-enhanced.ts` - Banner 组件
- [x] `ui/src/ui/views/skills-batch-confirm-enhanced.ts` - Confirm 组件
- [x] `ui/src/ui/views/skills-batch-progress-enhanced.ts` - Progress 组件
- [x] `ui/src/ui/views/skills-batch-complete-enhanced.ts` - Complete 组件

### 集成点（必须修改）
- [x] `ui/src/ui/app-render.ts` - 导入和调用增强组件

### 文档文件（可选）
- [x] `SKILLS-UI-ENHANCEMENT.md` - 技术文档
- [x] `TEST-SKILLS-UI.md` - 测试指南
- [x] `LAUNCH-CHECKLIST.md` - 本检查清单
- [x] `ui/test-enhanced-components.html` - 预览测试页

---

## 🔧 构建状态检查

### 1. 前端构建
```bash
cd ui
npm run build
```

**预期输出**:
```
✓ 204 modules transformed
✓ built in 1.72s
../dist/control-ui/index.html                 0.64 kB
../dist/control-ui/assets/index-xxx.css     247.89 kB
../dist/control-ui/assets/index-xxx.js     1,510.51 kB
```

**检查点**:
- [x] 无 TypeScript 编译错误
- [x] 无 Lit 模板语法错误
- [x] `dist/control-ui/` 目录已生成
- [x] CSS 和 JS 文件存在

---

## 🌐 运行环境检查

### 2. 后端服务启动
```bash
# 在项目根目录
npm run dev
```

**预期输出**:
```
OpenClawCN 正在启动...
控制台 UI 可访问于: http://localhost:3000
WebSocket 服务已启动
```

**检查点**:
- [ ] 后端成功启动
- [ ] WebSocket 服务正常
- [ ] 控制台 URL 可访问
- [ ] 无端口冲突错误

---

## 🎨 浏览器访问检查

### 3. 打开控制台
访问: http://localhost:3000 (或配置的端口)

**检查点**:
- [ ] 页面正常加载
- [ ] 无 404 错误（Network 标签）
- [ ] 无 JavaScript 错误（Console 标签）
- [ ] WebSocket 连接成功（Network → WS）

---

## 🧪 功能测试步骤

### 4. 触发技能安装流程

#### 步骤 1: 进入 Chat 页面
- [ ] 点击顶部 "Chat" 标签
- [ ] 页面加载完成

#### 步骤 2: 检查 Banner 显示
**如果 Banner 未显示**，打开浏览器控制台执行：

```javascript
// 重置检查 guard
if (window.__clawdbot_app) {
  // 强制进入 banner 阶段
  window.__clawdbot_app.skillsBatch.batchPhase = 'banner';
  window.__clawdbot_app.skillsBatch.batchCheckResult = {
    missing: [
      { name: 'weather', icon: '🌤', category: 'productivity', size_bytes: 1024000, tier: 'core', method: 'npm', description: '天气查询' },
      { name: 'summarize', icon: '📝', category: 'productivity', size_bytes: 2048000, tier: 'recommended', method: 'npm', description: '网页摘要' },
      { name: 'github', icon: '🐙', category: 'development', size_bytes: 512000, tier: 'optional', method: 'npm', description: 'GitHub 操作' },
    ],
    total_size_bytes: 3584000,
    estimated_seconds: 30,
    disk_available_bytes: 10000000000,
    disk_ok: true
  };
  window.__clawdbot_app.requestUpdate();
}
```

**验证点**:
- [ ] 霓虹青色横幅显示
- [ ] 顶部青色渐变线条
- [ ] 统计卡片显示正确
- [ ] 技能预览药丸显示
- [ ] 按钮悬停有动画

#### 步骤 3: 点击 "立即安装"
**验证点**:
- [ ] 背景模糊遮罩淡入
- [ ] 模态窗口弹性进场
- [ ] 2x2 统计网格显示
- [ ] 分类列表显示
- [ ] 国内镜像徽章显示
- [ ] 磁盘空间检查显示

#### 步骤 4: 展开技能列表
**验证点**:
- [ ] `<details>` 元素可展开/折叠
- [ ] Core 技能复选框禁用
- [ ] Recommended 技能默认选中
- [ ] Optional 技能默认未选中

#### 步骤 5: 点击 "开始安装"
**验证点**:
- [ ] 进度页面显示
- [ ] 总进度条动画
- [ ] 镜像指示器显示
- [ ] 技能列表阶梯进场
- [ ] WebSocket 消息流畅

#### 步骤 6: 等待安装完成
**验证点**:
- [ ] 进度实时更新
- [ ] 技能状态正确变化
- [ ] 下载速度显示

#### 步骤 7: 完成页面
**验证点**:
- [ ] 环形成功动画（扩散 → 脉冲 → 对勾）
- [ ] 彩纸从顶部飘落
- [ ] 统计数字从 0 计数到实际值
- [ ] 技能按分类展示
- [ ] 使用提示面板显示
- [ ] "开始对话" 按钮光泽效果

---

## 🐛 常见问题快速修复

### 问题 1: Banner 不显示
**原因**: session guard 或无缺失技能

**修复**:
```javascript
// 控制台执行
import('./controllers/skills-batch.js').then(({ resetBannerCheck }) => {
  resetBannerCheck();
  window.__clawdbot_app.checkBatchSkills();
});
```

---

### 问题 2: 样式未生效
**原因**: CSS 未正确加载或变量冲突

**修复**:
```javascript
// 检查 CSS 变量
const root = document.documentElement;
console.log('霓虹青色:', getComputedStyle(root).getPropertyValue('--accent-cyan'));
// 应输出: #00e5ff 或 rgb(0, 229, 255)
```

**如果变量未定义**，在 `ui/src/styles.css` 添加：
```css
:root {
  --accent-cyan: #00e5ff;
  --bg-deep: #07080d;
  --bg-card: #0e1017;
  /* ... 其他变量 */
}
```

---

### 问题 3: 彩纸动画不显示
**原因**: Canvas 元素未创建或动画模块加载失败

**修复**:
```javascript
// 控制台检查
const canvas = document.getElementById('confetti-canvas');
if (!canvas) {
  console.error('Canvas 元素未创建');
} else {
  console.log('Canvas 存在:', canvas);
  // 手动触发彩纸
  import('./views/skills-batch-animations.js').then(({ launchConfetti }) => {
    launchConfetti(canvas);
  });
}
```

---

### 问题 4: TypeScript 编译错误
**常见错误**:
```
error TS2307: Cannot find module 'lit/directives/unsafe-html.js'
```

**修复**:
```bash
cd ui
npm install lit --save
```

---

### 问题 5: WebSocket 连接失败
**检查点**:
1. 后端是否正常运行
2. WebSocket 端口是否正确
3. 防火墙是否阻止

**调试**:
```javascript
// 控制台检查 WebSocket 状态
console.log('WebSocket 状态:', window.__clawdbot_app.client?.connected);
```

---

## 📊 性能验证

### Chrome DevTools 检查

#### 1. Performance 面板
**目标**: 动画帧率 ≥ 60 FPS

**步骤**:
1. 打开 DevTools → Performance
2. 点击录制
3. 触发完整安装流程
4. 停止录制
5. 检查 FPS 图表

**通过标准**: 绿色区域占比 > 90%

---

#### 2. Network 面板
**检查 WebSocket 消息**:

**预期消息流**:
```
→ skills.batch.check
← { missing: [...], total_size_bytes: ... }

→ skills.batch.install { skills: [...] }
← { batch_id: "..." }

← skills.batch.progress { type: "skill.progress", ... }
← skills.batch.progress { type: "batch.progress", ... }

← skills.batch.complete { succeeded: [...] }
```

**通过标准**: 所有消息正常收发，无超时

---

#### 3. Console 面板
**检查错误**:

**通过标准**:
- 无 TypeScript 类型错误
- 无 Lit 模板语法错误
- 无 undefined 变量错误
- 允许的警告：`(!) Dynamic import will not move module into another chunk`（这是 Vite 优化警告，可忽略）

---

## ✅ 最终验收标准

### 必须通过（Critical）
- [x] 所有组件文件存在
- [x] 前端构建无错误
- [ ] Banner 正常显示
- [ ] Confirm 模态窗口正常显示
- [ ] Progress 实时更新
- [ ] Complete 动画播放完整

### 应该通过（High Priority）
- [ ] 动画流畅（60 FPS）
- [ ] 彩纸效果正常
- [ ] 计数动画流畅
- [ ] 按钮悬停效果正常

### 建议通过（Medium Priority）
- [ ] 响应式布局（移动端）
- [ ] 滚动提示自动隐藏
- [ ] 键盘导航支持

---

## 🎉 成功标准

当以下所有条件满足时，启动成功：

✅ **4 个核心阶段全部显示正常**
- Banner → Confirm → Progress → Complete

✅ **关键动画全部正常播放**
- 环形扩散 / 彩纸飘落 / 数字计数

✅ **数据绑定正确无误**
- 技能列表 / 统计数据 / 进度状态

✅ **交互响应及时流畅**
- 按钮点击 / 复选框选择 / 页面跳转

---

## 📝 测试完成报告

### 测试环境
- 浏览器: _______________
- 操作系统: _______________
- Node.js 版本: _______________
- 测试时间: _______________

### 测试结果
- [ ] 所有检查点通过
- [ ] 发现 ___ 个问题（已修复/未修复）

### 问题列表
1. _______________
2. _______________

### 备注
_______________

---

**测试完成签字**: _______________
**日期**: _______________

---

## 🔗 相关资源

- 📖 [技术文档](SKILLS-UI-ENHANCEMENT.md) - 完整技术实现说明
- 🧪 [测试指南](TEST-SKILLS-UI.md) - 详细测试步骤
- 🎨 [预览页面](ui/test-enhanced-components.html) - 快速预览测试

---

**准备就绪！开始测试吧！** 🚀
