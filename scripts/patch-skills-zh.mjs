#!/usr/bin/env node
/**
 * 批量为 SKILL.md 添加 nameZh / descriptionZh 字段
 *
 * 用法: node scripts/patch-skills-zh.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// 中文翻译映射 (与 zh-CN.ts 中的 skillName.*/skillDesc.* 保持一致)
const translations = {
  "weather":            { nameZh: "天气查询",       descZh: "查询全球各地实时天气和未来预报" },
  "local-places":       { nameZh: "附近地点",       descZh: "搜索附近的餐厅、商店、景点等" },
  "goplaces":           { nameZh: "地图导航",       descZh: "通过Google Places API搜索地点、查看详情和评论" },
  "food-order":         { nameZh: "外卖点餐",       descZh: "使用ordercli重新下单和追踪外卖订单状态" },
  "ordercli":           { nameZh: "订单查询",       descZh: "查看历史订单和实时追踪外卖配送状态" },
  "openhue":            { nameZh: "智能灯光",       descZh: "控制飞利浦Hue智能灯光" },
  "sonoscli":           { nameZh: "音箱控制",       descZh: "控制Sonos音箱（发现、播放、音量、分组）" },
  "songsee":            { nameZh: "音乐识别",       descZh: "从音频生成频谱图和特征面板可视化" },
  "1password":          { nameZh: "密码管理",       descZh: "安全管理和自动填充密码" },
  "notion":             { nameZh: "Notion笔记",    descZh: "管理Notion笔记和数据库" },
  "obsidian":           { nameZh: "Obsidian笔记",  descZh: "管理Obsidian知识库" },
  "apple-notes":        { nameZh: "苹果备忘录",     descZh: "读写苹果备忘录" },
  "apple-reminders":    { nameZh: "苹果提醒",       descZh: "管理苹果提醒事项" },
  "things-mac":         { nameZh: "Things待办",    descZh: "通过Things CLI管理Things 3待办事项和项目" },
  "bear-notes":         { nameZh: "Bear笔记",      descZh: "通过grizzly CLI创建、搜索和管理Bear笔记" },
  "trello":             { nameZh: "Trello看板",    descZh: "通过REST API管理Trello看板、列表和卡片" },
  "himalaya":           { nameZh: "邮件管理",       descZh: "通过IMAP/SMTP在终端管理邮件（收发、搜索、整理）" },
  "peekaboo":           { nameZh: "屏幕监控",       descZh: "监控和分析屏幕内容" },
  "camsnap":            { nameZh: "摄像头拍照",     descZh: "使用摄像头拍摄照片" },
  "tmux":               { nameZh: "终端会话",       descZh: "远程控制tmux终端会话（发送按键、读取输出）" },
  "canvas":             { nameZh: "画布展示",       descZh: "在画布上展示图表、代码等内容" },
  "nano-banana-pro":    { nameZh: "AI图片生成Pro",  descZh: "使用Gemini 3 Pro生成或编辑图片" },
  "gifgrep":            { nameZh: "GIF搜索",       descZh: "搜索GIF图片、下载结果并提取静态帧" },
  "summarize":          { nameZh: "内容总结",       descZh: "总结长文章和文档要点" },
  "gemini":             { nameZh: "Gemini AI",     descZh: "使用Gemini CLI进行问答、摘要和内容生成" },
  "oracle":             { nameZh: "AI问答",        descZh: "使用oracle CLI进行提示词和文件捆绑的最佳实践" },
  "discord":            { nameZh: "Discord",       descZh: "管理Discord服务器和消息" },
  "slack":              { nameZh: "Slack",          descZh: "发送和管理Slack消息" },
  "imsg":               { nameZh: "iMessage",      descZh: "iMessage/短信的收发、聊天记录查看和监听" },
  "wacli":              { nameZh: "WhatsApp",      descZh: "通过wacli CLI发送WhatsApp消息和搜索聊天记录" },
  "bluebubbles":        { nameZh: "蓝泡泡消息",     descZh: "构建或更新Clawdbot的BlueBubbles外部通道插件" },
  "voice-call":         { nameZh: "语音通话",       descZh: "通过Clawdbot语音通话插件发起语音通话" },
  "github":             { nameZh: "GitHub",        descZh: "管理GitHub仓库、Issue和PR" },
  "skill-creator":      { nameZh: "技能创建器",     descZh: "创建或更新AgentSkills技能包" },
  "skills-troubleshoot":{ nameZh: "技能排错",       descZh: "诊断并修复技能页面显示异常问题" },
  "mcporter":           { nameZh: "MCP工具",       descZh: "管理和调用MCP服务器/工具（HTTP或stdio模式）" },
  "video-frames":       { nameZh: "视频帧提取",     descZh: "从视频中提取关键帧图片" },
  "openai-whisper":     { nameZh: "语音转文字",     descZh: "使用Whisper将音频转换为文字" },
  "openai-whisper-api": { nameZh: "语音转文字API",  descZh: "通过OpenAI API将音频转换为文字" },
  "sherpa-onnx-tts":    { nameZh: "本地语音合成",    descZh: "本地离线文字转语音（无需云服务）" },
  "nano-pdf":           { nameZh: "PDF工具",       descZh: "读取和处理PDF文档" },
  "bird":               { nameZh: "Twitter/X",     descZh: "通过cookies进行Twitter/X的阅读、搜索、发帖和互动" },
  "blucli":             { nameZh: "蓝牙控制",       descZh: "BluOS CLI用于发现、播放、分组和音量控制" },
  "spotify-player":     { nameZh: "Spotify播放器",  descZh: "使用spotify_player播放音乐" },
  "openai-image-gen":   { nameZh: "AI图片生成",     descZh: "使用OpenAI生成图片" },
  "coding-agent":       { nameZh: "代码助手",       descZh: "通过后台进程运行代码助手进行编程" },
  "eightctl":           { nameZh: "8x控制",        descZh: "控制Eight Sleep智能床垫" },
  "blogwatcher":        { nameZh: "博客监控",       descZh: "监控博客和RSS/Atom订阅源的更新" },
  "model-usage":        { nameZh: "模型用量",       descZh: "统计和分析AI模型的Token使用量" },
  "session-logs":       { nameZh: "会话日志",       descZh: "搜索和分析历史对话记录" },
  "packaging":          { nameZh: "打包工具",       descZh: "打包Clawdbot为各平台分发包的完整指南" },
  "sag":                { nameZh: "系统分析",       descZh: "使用ElevenLabs进行文字转语音" },
  "gog":                { nameZh: "Go工具",        descZh: "管理Google Workspace（Gmail、日历、云端硬盘、通讯录等）" },
  "desktop-control":    { nameZh: "桌面控制",       descZh: "通过截图、点击、输入和快捷键控制Windows桌面应用" },
  "open-app":           { nameZh: "打开应用",       descZh: "通过名称查找并启动Windows桌面应用程序" },
};

// 扫描目录列表
const skillDirs = [
  path.join(ROOT, "skills"),
  path.join(ROOT, "build", "windows", "deploy", "skills"),
];

let updated = 0;
let skipped = 0;

for (const baseDir of skillDirs) {
  if (!fs.existsSync(baseDir)) continue;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const t = translations[skillName];
    if (!t) {
      skipped++;
      continue;
    }

    const mdPath = path.join(baseDir, skillName, "SKILL.md");
    if (!fs.existsSync(mdPath)) continue;

    let content = fs.readFileSync(mdPath, "utf-8");

    // 检查是否已有 nameZh
    if (content.includes("nameZh:")) {
      console.log(`  ⏭️  ${skillName} (already has nameZh)`);
      continue;
    }

    // 在 frontmatter 的第一个 name: 行后插入 nameZh/descriptionZh
    const fmMatch = content.match(/^(---\n)([\s\S]*?)\n(---)/);
    if (!fmMatch) {
      console.log(`  ⚠️  ${skillName} (no frontmatter)`);
      continue;
    }

    const beforeFm = fmMatch[1]; // "---\n"
    const fmBody = fmMatch[2];   // frontmatter content
    const afterFm = fmMatch[3];  // "---"

    // 在 description 行后插入
    const descLine = fmBody.match(/(description:.*)/);
    if (descLine) {
      const newFmBody = fmBody.replace(
        descLine[1],
        `${descLine[1]}\nnameZh: "${t.nameZh}"\ndescriptionZh: "${t.descZh}"`
      );
      content = content.replace(fmMatch[0], `${beforeFm}${newFmBody}\n${afterFm}`);
    } else {
      // 如果没有 description 行，在末尾添加
      const newFmBody = `${fmBody}\nnameZh: "${t.nameZh}"\ndescriptionZh: "${t.descZh}"`;
      content = content.replace(fmMatch[0], `${beforeFm}${newFmBody}\n${afterFm}`);
    }

    fs.writeFileSync(mdPath, content, "utf-8");
    updated++;
    console.log(`  ✅ ${skillName}`);
  }
}

console.log(`\n完成! 更新: ${updated}, 跳过: ${skipped}`);
