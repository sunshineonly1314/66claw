#!/usr/bin/env node
/**
 * 标签中文化后处理
 * 扫描所有 report JSON，将英文标签翻译为中文使用场景标签
 */

import fs from "node:fs";
import path from "node:path";

// 常见英文标签 → 中文映射表
const TAG_MAP = {
  // --- 生产力 ---
  "productivity": "生产力",
  "notes": "笔记",
  "note": "笔记",
  "todo": "待办事项",
  "task": "任务管理",
  "task-management": "任务管理",
  "time-management": "时间管理",
  "calendar": "日历",
  "scheduling": "日程安排",
  "reminders": "提醒",
  "reminder": "提醒",
  "email": "邮件",
  "mail": "邮件",
  "file-management": "文件管理",
  "office": "办公",
  "budget": "预算理财",
  "finance": "理财",
  "accounting": "记账",
  "automation": "自动化",
  "workflow": "工作流",
  "focus": "专注",
  "journal": "日记",
  "diary": "日记",
  "bookmark": "书签",
  "bookmarks": "书签",
  "reading": "阅读",
  "writing": "写作",
  "document": "文档",

  // --- 通信 ---
  "chat": "即时通讯",
  "messaging": "消息",
  "communication": "通信",
  "slack": "团队协作",
  "discord": "社区聊天",
  "notification": "通知推送",
  "notifications": "通知推送",
  "social": "社交",
  "social-media": "社交媒体",
  "collaboration": "协作",

  // --- 开发 ---
  "developer": "开发者工具",
  "development": "开发",
  "coding": "编程",
  "code-review": "代码审查",
  "git": "版本控制",
  "github": "代码托管",
  "ci-cd": "持续集成",
  "deployment": "部署",
  "testing": "测试",
  "debugging": "调试",
  "api": "接口调用",
  "api-integration": "接口集成",
  "cli": "命令行工具",
  "cli-tool": "命令行工具",
  "sdk": "开发套件",
  "framework": "框架",
  "package-manager": "包管理",
  "database": "数据库",
  "devops": "运维",
  "monitoring": "监控",
  "logging": "日志",
  "infrastructure": "基础设施",

  // --- AI ---
  "ai": "人工智能",
  "machine-learning": "机器学习",
  "llm": "大语言模型",
  "image-generation": "图像生成",
  "text-to-speech": "语音合成",
  "speech-to-text": "语音识别",
  "voice": "语音",
  "voice-control": "语音控制",
  "translation": "翻译",
  "summarization": "摘要",
  "ocr": "文字识别",
  "nlp": "自然语言处理",
  "chatbot": "聊天机器人",

  // --- 多媒体 ---
  "audio": "音频",
  "music": "音乐",
  "video": "视频",
  "image": "图像",
  "photo": "照片",
  "photography": "摄影",
  "screenshot": "截屏",
  "camera": "相机",
  "media": "媒体",
  "podcast": "播客",
  "streaming": "流媒体",
  "pdf": "PDF处理",
  "epub": "电子书",

  // --- 数据 ---
  "weather": "天气",
  "news": "新闻",
  "rss": "RSS阅读",
  "web-scraping": "网页抓取",
  "data-analysis": "数据分析",
  "analytics": "数据分析",
  "search": "搜索",
  "web-search": "网络搜索",
  "maps": "地图",
  "location": "定位",
  "navigation": "导航",
  "transit": "公共交通",
  "travel": "旅行",
  "food": "美食",
  "recipe": "食谱",
  "shopping": "购物",
  "price-tracking": "比价",
  "stock": "股票",
  "crypto": "加密货币",
  "blockchain": "区块链",

  // --- 智能家居 ---
  "smart-home": "智能家居",
  "iot": "物联网",
  "home-automation": "家居自动化",
  "lighting": "灯光控制",
  "thermostat": "温控",
  "3d-printing": "3D打印",

  // --- 安全 ---
  "security": "安全",
  "password": "密码管理",
  "encryption": "加密",
  "vpn": "VPN",
  "firewall": "防火墙",
  "authentication": "身份验证",
  "privacy": "隐私保护",

  // --- 系统 ---
  "macos": "macOS系统",
  "linux": "Linux系统",
  "windows": "Windows系统",
  "docker": "容器化",
  "cloud": "云服务",
  "aws": "AWS云",
  "azure": "Azure云",
  "self-hosted": "自托管",
  "backup": "备份",

  // --- 内容 ---
  "blog": "博客",
  "cms": "内容管理",
  "wiki": "知识库",
  "documentation": "文档编写",
  "markdown": "Markdown",

  // --- 健康/生活 ---
  "health": "健康",
  "fitness": "健身",
  "meditation": "冥想",
  "mental-health": "心理健康",
  "adhd": "注意力管理",
  "sleep": "睡眠",
  "habit": "习惯养成",
  "habit-tracking": "习惯追踪",

  // --- 游戏/娱乐 ---
  "game": "游戏",
  "gaming": "游戏",
  "entertainment": "娱乐",
  "trivia": "趣味问答",

  // --- 专有名词/技术术语 ---
  "mcp": "MCP协议",
  "tts": "语音合成",
  "oauth": "OAuth认证",
  "webhook": "Webhook回调",
  "crm": "客户管理",
  "rag": "知识检索增强",
  "markdown": "Markdown编辑",
  "ci/cd": "持续集成",
  "kubernetes": "容器编排",
  "k8s": "容器编排",
  "tmux": "终端复用",
  "playwright": "浏览器自动化",
  "puppeteer": "浏览器自动化",
  "selenium": "浏览器自动化",
  "comfyui": "AI绘图工作流",
  "websocket": "实时通信",
  "arXiv": "学术论文",
  "arxiv": "学术论文",
  "youtube": "YouTube视频",
  "twitter": "Twitter社交",
  "bluesky": "Bluesky社交",
  "mastodon": "Mastodon社交",
  "reddit": "Reddit论坛",
  "telegram": "Telegram通讯",
  "whatsapp": "WhatsApp通讯",
  "ios": "iOS系统",
  "android": "Android系统",
  "applescript": "AppleScript自动化",
  "cron": "定时任务",
  "curl": "HTTP请求",
  "rest": "REST接口",
  "graphql": "GraphQL查询",
  "json": "JSON处理",
  "yaml": "YAML配置",
  "csv": "CSV数据",
  "excel": "Excel表格",
  "sql": "SQL查询",
  "nosql": "NoSQL数据库",
  "redis": "Redis缓存",
  "mongodb": "MongoDB数据库",
  "postgresql": "PostgreSQL数据库",
  "mysql": "MySQL数据库",
  "sqlite": "SQLite数据库",
  "openai": "OpenAI调用",
  "claude": "Claude调用",
  "gemini": "Gemini调用",
  "elevenlabs": "ElevenLabs语音",
  "comfyui": "ComfyUI绘图",
  "memory": "记忆管理",
  "community": "社区",
  "accessibility": "无障碍",
  "i18n": "国际化",
  "l10n": "本地化",
  "dns": "DNS管理",
  "nginx": "Nginx配置",
  "terraform": "基础设施编排",
  "ansible": "自动化运维",
  "prometheus": "监控告警",
  "grafana": "数据可视化",
  "notion": "Notion笔记",
  "obsidian": "Obsidian笔记",
  "trello": "Trello看板",
  "jira": "Jira项目管理",
  "asana": "Asana项目管理",
  "linear": "Linear项目管理",
  "figma": "Figma设计",
  "canva": "Canva设计",
  "spotify": "Spotify音乐",
  "homeassistant": "Home Assistant",
  "home-assistant": "Home Assistant",
  "zigbee": "Zigbee智能家居",
  "hue": "飞利浦Hue灯光",
  "mqtt": "MQTT消息",
  "bluetooth": "蓝牙",
  "nfc": "NFC近场通信",
  "qrcode": "二维码",
  "barcode": "条形码",
  "regex": "正则表达式",
  "scraping": "网页抓取",
  "crawling": "网络爬虫",
  "parser": "解析器",
  "compiler": "编译器",
  "linter": "代码检查",
  "formatter": "代码格式化",
  "minifier": "代码压缩",
  "bundler": "打包工具",
  "npm": "NPM包管理",
  "pip": "Python包管理",
  "brew": "Homebrew包管理",
  "clawdbot": "Clawdbot助手",
  "openclaw": "OpenClaw生态",

  // --- 补充高频未映射 ---
  "n8n": "n8n自动化",
  "elixir": "Elixir开发",
  "kanban": "看板管理",
  "apple silicon": "Apple Silicon",
  "prompt engineering": "提示词工程",
  "content": "内容创作",
  "openrouter": "OpenRouter路由",
  "grocery": "购物清单",
  "project-management": "项目管理",
  "prediction markets": "预测市场",
  "discovery": "内容发现",
  "fun": "趣味娱乐",
  "multi-agent": "多智能体",
  "multiplayer": "多人协作",
  "outlook": "Outlook邮件",
  "confluence": "Confluence文档",
  "atlassian": "Atlassian协作",
  "commit": "代码提交",
  "solana": "Solana区块链",
  "proactive": "主动推送",
  "smtp": "SMTP邮件",
  "otp": "动态验证码",
  "imap": "IMAP邮件",
  "fitbit": "Fitbit健康",
  "bash": "Bash脚本",
  "systemd": "系统服务",
  "ollama": "Ollama本地模型",
  "ffmpeg": "FFmpeg转码",
  "jupyter": "Jupyter笔记本",
  "huggingface": "HuggingFace模型",
  "langchain": "LangChain开发",
  "vercel": "Vercel部署",
  "supabase": "Supabase数据库",
  "nextjs": "Next.js开发",
  "next.js": "Next.js开发",
  "tailwind": "Tailwind样式",
  "tailwindcss": "Tailwind样式",
  "fastapi": "FastAPI开发",
  "flask": "Flask开发",
  "django": "Django开发",
  "latex": "LaTeX排版",
  "clipboard": "剪贴板",
  "snippet": "代码片段",
  "snippets": "代码片段",
  "template": "模板",
  "diff": "差异对比",
  "refactoring": "代码重构",
  "profiling": "性能分析",
  "caching": "缓存管理",
  "queue": "消息队列",
  "grpc": "gRPC通信",
  "microservices": "微服务",
  "serverless": "无服务器",
  "ethereum": "以太坊",
  "nft": "NFT数字藏品",
  "defi": "DeFi金融",
  "wallet": "钱包",
  "payments": "支付",
  "payment": "支付",
  "stripe": "Stripe支付",
  "education": "教育",
  "learning": "学习",
  "flashcards": "闪卡记忆",
  "mindmap": "思维导图",
  "mind-map": "思维导图",
  "diagram": "图表绘制",
  "mermaid": "Mermaid图表",
  "chart": "图表",
  "visualization": "可视化",
  "dashboard": "仪表盘",
  "export": "导出",
  "migration": "数据迁移",
  "slides": "幻灯片",
  "presentation": "演示文稿",
  "theme": "主题",
  "dark-mode": "深色模式",
  "mobile": "移动端",
  "electron": "Electron应用",
  "tauri": "Tauri应用",
  "pwa": "PWA应用",
  "extension": "浏览器扩展",
  "chrome": "Chrome浏览器",
  "browser": "浏览器",
  "jwt": "JWT认证",
  "sso": "单点登录",
  "audit": "审计日志",
  "vulnerability": "漏洞扫描",
  "ssh": "SSH远程",
  "s3": "S3存储",
  "cdn": "CDN加速",
  "api-gateway": "API网关",
  "sentry": "Sentry错误追踪",
  "datadog": "Datadog监控",
  "elasticsearch": "Elasticsearch搜索",
  "kafka": "Kafka流处理",
  "airflow": "Airflow数据管道",
  "spark": "Spark大数据",
  "pandas": "Pandas数据分析",
  "geocoding": "地理编码",
  "currency": "货币兑换",
  "inventory": "库存管理",
  "raspberry-pi": "树莓派",
  "arduino": "Arduino开发",
  "sensor": "传感器",
  "vr": "VR虚拟现实",
  "ar": "AR增强现实",
  "unity": "Unity游戏引擎",
  "midi": "MIDI音乐",
  "obs": "OBS直播",
  "livestream": "直播",
  "twitch": "Twitch直播",
  "subtitles": "字幕",
  "transcription": "转录",
  "screen-reader": "屏幕阅读器",
  "linkedin": "LinkedIn职场",
  "feishu": "飞书",
  "lark": "飞书",
  "dingtalk": "钉钉",
  "wecom": "企业微信",
  "wechat": "微信",
  "node.js": "Node.js开发",
  "nodejs": "Node.js开发",
  "python": "Python开发",
  "rust": "Rust开发",
  "go": "Go开发",
  "java": "Java开发",
  "typescript": "TypeScript开发",
  "react": "React前端",
  "vue": "Vue前端",
  "svelte": "Svelte前端",
  "ecommerce": "电子商务",
  "e-commerce": "电子商务",
  "seo": "SEO优化",
  "web3": "Web3",
  "nostr": "Nostr社交",
  "irc": "IRC聊天",
  "imessage": "iMessage通讯",
  "instagram": "Instagram社交",
  "tiktok": "TikTok短视频",
  "captcha": "验证码",
  "proxy": "代理",
  "changelog": "变更日志",
  "sync": "数据同步",
  "networking": "网络",
  "garmin": "Garmin运动",
  "strava": "Strava运动",
  "google workspace": "Google办公套件",
  "google places": "Google地点",
  "natural-language": "自然语言",
  "issue-tracking": "问题追踪",
  "demo": "演示",
  "engagement": "用户互动",
  "reflection": "自我反思",
  "personalization": "个性化",
  "context": "上下文管理",
  "codex": "代码生成",
  "agents": "智能体",
  "greeting": "问候",
  "solopreneur": "独立创业",

  // --- 第三批：长尾高频 ---
  "home assistant": "Home Assistant",
  "whisper": "Whisper语音",
  "oura ring": "Oura Ring健康",
  "disability": "无障碍辅助",
  "consciousness": "意识探索",
  "philosophy": "哲学思考",
  "monetization": "变现盈利",
  "reputation": "声誉管理",
  "open-source": "开源",
  "hugging face": "HuggingFace模型",
  "expense-tracking": "支出追踪",
  "tools": "实用工具",
  "anime": "动漫",
  "spaced-repetition": "间隔重复",
  "human-in-the-loop": "人机协同",
  "apple tv": "Apple TV",
  "app store": "App Store",
  "longevity": "长寿健康",
  "configuration-management": "配置管理",
  "investing": "投资理财",
  "homelab": "家庭实验室",
  "self-improvement": "自我提升",
  "therapy": "心理疗愈",
  "journaling": "日记写作",
  "gratitude": "感恩练习",
  "affirmation": "正向激励",
  "poetry": "诗歌",
  "creative-writing": "创意写作",
  "storytelling": "故事讲述",
  "comic": "漫画",
  "manga": "漫画",
  "recipe": "食谱",
  "cooking": "烹饪",
  "nutrition": "营养",
  "diet": "饮食管理",
  "workout": "锻炼",
  "yoga": "瑜伽",
  "running": "跑步",
  "cycling": "骑行",
  "hiking": "徒步",
  "camping": "露营",
  "fishing": "钓鱼",
  "gardening": "园艺",
  "pet": "宠物",
  "dog": "狗狗",
  "cat": "猫咪",
  "plant": "植物",
  "astronomy": "天文",
  "space": "太空",
  "science": "科学",
  "math": "数学",
  "statistics": "统计学",
  "physics": "物理",
  "chemistry": "化学",
  "biology": "生物",
  "legal": "法律",
  "law": "法律",
  "contract": "合同",
  "patent": "专利",
  "trademark": "商标",
  "copyright": "版权",
  "real-estate": "房产",
  "mortgage": "贷款",
  "insurance": "保险",
  "donations": "捐赠",
  "nonprofit": "非营利",
  "volunteering": "志愿服务",
  "sustainability": "可持续发展",
  "environment": "环保",
  "carbon": "碳排放",
  "renewable": "可再生能源",
  "solar": "太阳能",
  "wind": "风能",
  "ev": "电动汽车",
  "tesla": "Tesla特斯拉",
  "automotive": "汽车",
  "manufacturing": "制造业",
  "supply-chain": "供应链",
  "logistics": "物流",
  "shipping": "配送",
  "tracking": "物流追踪",
  "warehouse": "仓储",
  "agriculture": "农业",
  "farming": "种植",
  "drone": "无人机",
  "satellite": "卫星",
  "radio": "无线电",
  "ham-radio": "业余无线电",
  "signal": "信号",
  "modulation": "调制",
  "firmware": "固件",
  "bios": "BIOS设置",
  "bootloader": "引导程序",
  "kernel": "内核",
  "driver": "驱动",
  "virtualization": "虚拟化",
  "vmware": "VMware虚拟机",
  "hypervisor": "虚拟机管理",
  "container": "容器",
  "sandbox": "沙箱",
  "emulator": "模拟器",
  "retro": "复古",
  "emulation": "模拟",
  "rom": "ROM",
  "cheat": "游戏秘籍",
  "speedrun": "速通",
  "chess": "国际象棋",
  "puzzle": "益智游戏",
  "crossword": "填字游戏",
  "sudoku": "数独",
  "board-game": "桌游",
  "card-game": "纸牌游戏",
  "rpg": "角色扮演",
  "mmorpg": "多人在线RPG",
  "fps": "射击游戏",
  "simulation": "模拟仿真",
  "strategy": "策略",
};

const REPORT_DIR = "./cn/skills-qc/output-all/report";
const INDEX_PATH = "./cn/skills-qc/output-all/skills-index.json";

function translateTag(tag) {
  const lower = tag.toLowerCase().trim();

  // 已经是中文？保留
  if (/[\u4e00-\u9fff]/.test(tag)) return tag;

  // 精确匹配
  if (TAG_MAP[lower]) return TAG_MAP[lower];

  // 去掉连字符后匹配
  const noHyphen = lower.replace(/-/g, "");
  for (const [k, v] of Object.entries(TAG_MAP)) {
    if (k.replace(/-/g, "") === noHyphen) return v;
  }

  // 部分匹配
  for (const [k, v] of Object.entries(TAG_MAP)) {
    if (lower.includes(k) || k.includes(lower)) return v;
  }

  // 无法翻译，返回原值（后续手动处理）
  return tag;
}

function fixReportTags() {
  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.endsWith(".json") && !f.startsWith("wash") && !f.startsWith("rejected") && !f.startsWith("review"));

  let fixed = 0;
  let totalTags = 0;
  let cnTags = 0;
  const unmapped = new Map();

  for (const f of files) {
    const fpath = path.join(REPORT_DIR, f);
    try {
      const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
      const tags = data.layer3?.quality?.tags;
      if (!tags || !tags.length) continue;

      const newTags = tags.map(t => translateTag(t));

      // 去重
      const uniqueTags = [...new Set(newTags)];

      totalTags += uniqueTags.length;

      // 统计未映射的
      for (const t of uniqueTags) {
        if (!/[\u4e00-\u9fff]/.test(t)) {
          unmapped.set(t, (unmapped.get(t) || 0) + 1);
        } else {
          cnTags++;
        }
      }

      // 更新
      if (JSON.stringify(tags) !== JSON.stringify(uniqueTags)) {
        data.layer3.quality.tags = uniqueTags;
        fs.writeFileSync(fpath, JSON.stringify(data, null, 2), "utf8");
        fixed++;
      }
    } catch (e) {}
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 标签中文化统计`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  处理文件数: ${files.length}`);
  console.log(`  修复文件数: ${fixed}`);
  console.log(`  总标签数: ${totalTags}`);
  console.log(`  中文标签: ${cnTags} (${(cnTags / totalTags * 100).toFixed(1)}%)`);
  console.log(`  未映射标签: ${unmapped.size} 种`);

  if (unmapped.size > 0) {
    console.log(`\n  频率最高的未映射标签:`);
    const sorted = [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    for (const [tag, count] of sorted) {
      console.log(`    "${tag}": ${count} 次`);
    }
  }
}

// 也修复 skills-index.json
function fixIndexTags() {
  try {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    for (const skill of index.skills || []) {
      if (skill.tags?.length) {
        skill.tags = [...new Set(skill.tags.map(t => translateTag(t)))];
      }
    }
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
    console.log(`\n✅ skills-index.json 标签已更新`);
  } catch (e) {
    console.log(`\n⚠️  skills-index.json 尚未生成（等清洗完成后再运行）`);
  }
}

fixReportTags();
fixIndexTags();
