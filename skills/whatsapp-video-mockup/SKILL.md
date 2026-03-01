---
name: whatsapp-video-mockup
description: 使用 Remotion 创建逼真的 WhatsApp 风格聊天动画视频。适用于 X（原 Twitter）、TikTok、Instagram Reels 等平台。
description_zh: 使用 Remotion 创建逼真的 WhatsApp 风格聊天动画视频。适用于 X（原 Twitter）、TikTok、Instagram Reels 等平台。
---
# WhatsApp 视频技能（WhatsApp Video Skill）

使用 Remotion 创建逼真的 WhatsApp 风格聊天动画视频。适用于 X（原 Twitter）、TikTok、Instagram Reels 等平台。

## 功能特性

- 📱 真实 iPhone 边框，含动态岛（Dynamic Island）
- 💬 WhatsApp 深色模式 UI（配色、气泡、时间戳均精准还原）
- 📜 消息增长时自动滚动
- 🔤 大号、易读字体（专为移动端观看优化）
- 🎵 消息通知音效
- ✨ 消息出现时启用弹簧动画（spring animations）
- ⌨️ 输入提示（“...”气泡）
- 🔗 链接预览卡片
- ✅ 已读回执（蓝色对勾）
- 支持 **加粗** 和 `code` 格式

## 默认设置

- **宽高比**：4:5（1080×1350）——X / Instagram 信息流最优尺寸
- **无片头/片尾**——视频直接从聊天界面开始并结束
- **字体放大 2 倍**——确保移动端清晰可读
- **自动滚动**——始终保证全部消息可见

## 前置依赖

本 skill 需要启用 **Remotion 最佳实践（Remotion Best Practices）** skill：

```bash
npx skills add remotion-dev/skills -a claude-code -y -g
```

## 快速上手

```bash
cd ~/Projects/remotion-test
```

在 `src/WhatsAppVideo.tsx` 中编辑对话内容，然后渲染：

```bash
npx remotion render WhatsAppDemo out/my-video.mp4 --concurrency=4
```

## 如何创建新视频

### 1. 定义你的消息

在 `src/WhatsAppVideo.tsx` 中编辑 `ChatMessages` 组件：

```tsx
// Incoming message (from assistant)
<Message
  text="Your message text here"
  isOutgoing={false}
  time="8:40 AM"
  delay={125}  // Frame when message appears (30fps)
/>

// Outgoing message (from user)
<Message
  text="Your outgoing message"
  isOutgoing={true}
  time="8:41 AM"
  delay={200}
  showCheck={true}
/>

// Typing indicator (shows "..." bubbles)
<TypingIndicator delay={80} duration={45} />
```

### 2. 时间控制指南

- **30 fps** = 每秒 30 帧  
- `delay={30}` = 在第 1 秒出现  
- `delay={60}` = 在第 2 秒出现  
- `duration={45}` = 持续 1.5 秒  

**典型流程：**  
1. 首条消息：`delay={20}`（约 0.7 秒）  
2. 输入提示：`delay={80}`、`duration={45}`  
3. 回复：`delay={125}`（输入提示结束后）  
4. 下一轮输入：`delay={175}`、`duration={45}`  
5. 下一轮回复：`delay={220}`  

### 3. 调整滚动效果

在 `ChatMessages` 中，根据消息总数更新滚动插值参数：

```tsx
const scrollAmount = interpolate(
  frame,
  [scrollStart, scrollStart + 60, messageFrame, lastFrame],
  [0, firstScroll, firstScroll, finalScroll],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

若消息超出可视区域，请增大滚动值。

### 4. 文本格式支持

消息支持以下格式：
- **加粗**：`**bold text**`  
- `Code`：用反引号包围文字  
- 换行：字符串中使用 `\n`  
- 表情符号：直接插入即可 🎬  

### 5. 自定义顶部栏（Header）

在 `ChatHeader` 组件中修改以下字段：
- 名称：`Pokey 🐡` → 替换为你的 assistant 名称  
- 状态：`online`  
- 头像表情符号  

### 6. 更新视频总时长

在 `Root.tsx` 中，将 `durationInFrames` 设置为匹配你的视频长度：  
- 统计至最后一条消息出现所需的帧数 + 约 100 帧缓冲  
- 按 30fps 计算：450 帧 = 15 秒  

### 7. 渲染视频

```bash
# Standard render
npx remotion render WhatsAppDemo out/video.mp4 --concurrency=4

# Higher quality
npx remotion render WhatsAppDemo out/video.mp4 --codec h264 --crf 18

# Preview in browser
npm run dev
```

## 各平台尺寸规格

编辑 `Root.tsx` 可更改尺寸：

| 平台 | 尺寸 | 宽高比 | 使用场景 |
|------|------|--------|----------|
| **X / Instagram 信息流** | 1080×1350 | 4:5 | 默认尺寸，曝光度最高 |
| **X / TikTok / Reels** | 1080×1920 | 9:16 | 全屏竖版 |
| **X 正方形** | 1080×1080 | 1:1 | 通用适配 |
| **YouTube / X 横版** | 1920×1080 | 16:9 | 横向播放 |

## 项目结构

```
~/Projects/remotion-test/
├── src/
│   ├── WhatsAppVideo.tsx   # Main video component
│   └── Root.tsx            # Composition config
├── public/
│   └── sounds/
│       ├── pop.mp3         # Message received
│       └── send.mp3        # Message sent
└── out/                    # Rendered videos
```

## 音效

音效通过 Sequence 触发：
```tsx
<Sequence from={125}>
  <Audio src={staticFile("sounds/pop.mp3")} volume={0.5} />
</Sequence>
```

## 实用技巧

1. **边编辑边预览**：运行 `npm run dev` 实时查看变更效果  
2. **逐帧检查**：使用时间轴拖动条校准时机  
3. **精简消息内容**：过长消息可能需要调整滚动参数  
4. **移动端实测**：务必在真实设备上验证可读性  

## 请求 Pokey 生成视频

只需描述对话场景即可：  
- “WhatsApp 视频：我向你询问 [X]”  
- “制作一段展示 [对话内容] 的聊天视频”  

Pokey 将自动生成消息、设定时间点、渲染视频并发送 MP4 文件。