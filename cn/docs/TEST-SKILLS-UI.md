# 技能安装界面测试指南

## 🚀 快速启动

### 1. 启动后端服务
```bash
# 在项目根目录
npm run dev
# 或者
node dist/main.js
```

### 2. 启动前端开发服务器（可选）
```bash
cd ui
npm run dev
```

### 3. 访问控制台
打开浏览器访问：
- 开发模式：http://localhost:5173
- 生产模式：http://localhost:3000（取决于后端配置）

---

## 🎯 测试流程

### 阶段 1: Banner 横幅测试

**触发条件**: 首次进入 Chat 页面，且有缺失技能

**预期效果**:
- ✅ 显示霓虹青色横幅卡片
- ✅ 顶部有青色渐变线条
- ✅ 统计卡片显示技能数量、大小、耗时
- ✅ 显示前 5 个技能预览药丸
- ✅ "立即安装" 按钮悬停时上浮 + 发光
- ✅ "稍后" 按钮悬停时文字变亮

**测试步骤**:
1. 打开控制台
2. 进入 Chat 标签页
3. 观察是否自动弹出横幅
4. 鼠标悬停按钮测试动画效果

**调试技巧**:
```javascript
// 浏览器控制台强制触发检查
window.__clawdbot_app.skillsBatch.batchPhase = 'idle';
window.__clawdbot_app.checkBatchSkills();
```

---

### 阶段 2: Confirm 确认对话框测试

**触发方式**: 点击 Banner 上的 "立即安装" 按钮

**预期效果**:
- ✅ 背景模糊遮罩淡入
- ✅ 模态窗口弹性进场动画
- ✅ 2x2 统计网格显示数据
- ✅ 分类列表显示 5 类技能
- ✅ 国内镜像徽章显示 "🇨🇳 已启用国内加速镜像"
- ✅ 磁盘空间检查显示充足/不足状态
- ✅ 可展开/折叠完整技能列表
- ✅ Core 技能复选框禁用且默认选中
- ✅ Recommended 技能默认选中
- ✅ Optional 技能默认不选中

**测试步骤**:
1. 点击 "立即安装"
2. 检查动画流畅性
3. 展开技能列表
4. 尝试勾选/取消勾选 Recommended 和 Optional
5. 验证 Core 技能无法取消勾选
6. 点击 "开始安装"

**注意事项**:
- 如果磁盘空间不足，"开始安装" 按钮应禁用
- 取消所有勾选时，"开始安装" 按钮应禁用

---

### 阶段 3: Progress 进度页测试

**触发方式**: Confirm 对话框点击 "开始安装"

**预期效果**:
- ✅ 总进度条平滑增长
- ✅ 进度条右侧闪光动画
- ✅ 镜像指示器脉动绿点
- ✅ 实时显示下载速度（绿色）
- ✅ 技能列表阶梯式进场动画
- ✅ 当前下载技能高亮（青色边框）
- ✅ 已完成技能变灰 + 绿色对勾
- ✅ 失败技能显示红色错误图标

**测试步骤**:
1. 观察总进度条动画
2. 观察技能状态变化：
   - queued (等待) → downloading (下载) → verifying (验证) → done (完成)
3. 检查下载速度实时更新
4. （可选）点击 "取消安装" 测试中断

**WebSocket 数据流**:
```
skills.batch.install → 开始安装
skills.batch.progress (skill.progress) → 单个技能进度
skills.batch.progress (batch.progress) → 总体进度
skills.batch.complete → 完成通知
```

---

### 阶段 4: Complete 完成页测试

**触发方式**: 所有技能安装完成后自动跳转

**预期效果**:
- ✅ 环形成功图标动画（扩散 → 脉冲 → 对勾）
- ✅ 彩纸从顶部飘落（Canvas 动画）
- ✅ 统计数字从 0 计数到实际值
- ✅ 氛围背景光晕脉动
- ✅ 滚动提示箭头跳动
- ✅ 技能卡片按分类展示
- ✅ 技能描述高亮关键词（青色）
- ✅ 使用提示面板显示
- ✅ "开始对话" 按钮光泽扫过效果
- ✅ 滚动后提示箭头自动隐藏

**测试步骤**:
1. 等待安装完成
2. 观察所有进场动画
3. 向下滚动查看完整技能列表
4. 验证各分类技能正确显示
5. 悬停 "开始对话" 按钮测试动画
6. 点击 "开始对话" 跳转到 Chat

**动画时间轴**:
```
0.0s  - 环形开始扩散
0.5s  - 环形扩散完成
0.8s  - 环形脉冲外扩
0.9s  - 对勾弹出
1.0s  - 彩纸开始飘落
1.1s  - 统计数字开始计数
1.2s  - 数字计数完成
1.4s  - 滚动提示显示
1.5s  - 第一个分类淡入
...
2.2s  - CTA 按钮淡入
```

---

## 🐛 常见问题排查

### 问题 1: Banner 不显示

**可能原因**:
1. 后端未检测到缺失技能
2. WebSocket 连接失败
3. 已经显示过（session guard）

**解决方案**:
```javascript
// 浏览器控制台重置 guard
import { resetBannerCheck } from './controllers/skills-batch.js';
resetBannerCheck();

// 强制进入 banner 阶段
window.__clawdbot_app.skillsBatch.batchPhase = 'banner';
window.__clawdbot_app.skillsBatch.batchCheckResult = {
  missing: [
    { name: 'test-skill', icon: '🧪', category: 'dev', size_bytes: 1024000, tier: 'recommended' }
  ],
  total_size_bytes: 1024000,
  estimated_seconds: 30,
  disk_available_bytes: 10000000000,
  disk_ok: true
};
window.__clawdbot_app.requestUpdate();
```

---

### 问题 2: 彩纸动画不显示

**可能原因**:
1. Canvas 元素未正确创建
2. 动画模块加载失败
3. 浏览器不支持 Canvas

**解决方案**:
```javascript
// 检查 Canvas 是否存在
const canvas = document.getElementById('confetti-canvas');
console.log('Canvas:', canvas);

// 手动触发彩纸
import('./views/skills-batch-animations.js').then(({ launchConfetti }) => {
  launchConfetti(canvas);
});
```

---

### 问题 3: 样式显示异常

**可能原因**:
1. CSS 变量未定义
2. 字体加载失败
3. 主题冲突

**解决方案**:
```javascript
// 检查 CSS 变量
const root = document.documentElement;
console.log(getComputedStyle(root).getPropertyValue('--accent-cyan'));

// 应输出: #00e5ff
```

---

### 问题 4: 数据未正确绑定

**可能原因**:
1. 组件 props 传递错误
2. 数据格式不匹配
3. TypeScript 类型错误

**检查点**:
```typescript
// 检查 batchState 数据结构
console.log('Batch State:', window.__clawdbot_app.skillsBatch);

// 应包含:
{
  batchPhase: 'banner' | 'confirm' | 'downloading' | 'result' | 'complete',
  batchCheckResult: { missing: [...], ... },
  batchSkills: [...],
  batchProgress: { completed, total, ... },
  batchResult: { succeeded: [...], failed: [...], durationMs }
}
```

---

## 📊 性能检查

### Chrome DevTools 性能分析

1. 打开 DevTools → Performance 标签
2. 点击录制
3. 触发完整安装流程
4. 停止录制并分析

**关键指标**:
- 动画帧率: 应保持 60 FPS
- 内存占用: 彩纸动画后应自动释放
- 布局重排: 应最小化（使用 transform 而非 top/left）

### 网络检查

1. DevTools → Network 标签
2. 过滤 WS (WebSocket)
3. 观察实时消息流

**预期消息**:
```
→ skills.batch.check
← { missing: [...], total_size_bytes: ... }

→ skills.batch.install { skills: [...] }
← { batch_id: "..." }

← skills.batch.progress { type: "skill.progress", skill: "...", percent: 50 }
← skills.batch.progress { type: "batch.progress", completed: 5, total: 18 }

← skills.batch.complete { succeeded: [...], durationMs: 23000 }
```

---

## ✅ 验收检查清单

### 视觉设计
- [ ] 所有页面使用霓虹青色 (#00e5ff)
- [ ] 字体正确加载（Noto Sans SC / JetBrains Mono）
- [ ] 圆角统一（卡片 14-18px）
- [ ] 阴影发光效果正确显示

### 动画效果
- [ ] Banner 滑入流畅
- [ ] Confirm 弹性进场
- [ ] Progress 进度条闪光
- [ ] Complete 环形扩散
- [ ] Complete 彩纸飘落
- [ ] Complete 数字计数

### 功能完整性
- [ ] 技能数据正确显示
- [ ] 复选框状态同步
- [ ] 安装流程完整
- [ ] WebSocket 实时更新
- [ ] 错误处理优雅

### 交互体验
- [ ] 按钮悬停动画
- [ ] 卡片悬停高亮
- [ ] 滚动提示自动隐藏
- [ ] 点击跳转正常

---

## 🎬 录制测试视频（可选）

### 推荐工具
- **Windows**: Xbox Game Bar (Win + G)
- **macOS**: QuickTime Player (Cmd + Shift + 5)
- **跨平台**: OBS Studio

### 录制清单
1. ✅ Banner 显示 → 悬停 → 点击
2. ✅ Confirm 进场 → 展开列表 → 选择技能 → 确认
3. ✅ Progress 进度更新 → 技能状态变化
4. ✅ Complete 所有动画 → 滚动 → 点击开始对话

---

## 📝 测试报告模板

```markdown
## 测试环境
- 浏览器: Chrome 131 / Firefox 135 / Safari 18
- 操作系统: Windows 11 / macOS 15 / Linux
- 分辨率: 1920x1080 / 2560x1440
- 网络: 本地开发 / 生产环境

## 测试结果
### Banner 阶段
- [x] 显示正常
- [x] 动画流畅
- [ ] 发现问题：xxx

### Confirm 阶段
- [x] 显示正常
- [ ] 发现问题：xxx

### Progress 阶段
- [x] 显示正常
- [ ] 发现问题：xxx

### Complete 阶段
- [x] 彩纸动画正常
- [x] 计数动画正常
- [ ] 发现问题：xxx

## 性能数据
- 平均帧率: 60 FPS
- 内存占用: 约 150 MB
- 加载时间: < 2s

## 建议改进
1. xxx
2. xxx
```

---

## 🎉 成功标准

当以下所有条件满足时，测试通过：

✅ 所有 4 个阶段正常显示
✅ 动画流畅无卡顿（60 FPS）
✅ 数据正确绑定无错误
✅ 交互响应及时
✅ 视觉效果符合设计稿

**祝测试顺利！如有问题请查看上方排查指南。**
