#!/usr/bin/env node
/**
 * Skills Availability Analyzer for China Users
 *
 * 自动分析 9535+ MCP servers 和内置 extensions 的中国可用性
 * 生成详细的可用性字典表
 *
 * Features:
 * - Domain analysis (blocked vs accessible)
 * - Dependency scanning (API keys, services)
 * - Platform detection (macOS/Windows/Linux specific)
 * - Keyword matching (Google/AWS/OpenAI etc)
 * - Confidence scoring (0.0-1.0)
 *
 * Usage:
 *   pnpm tsx scripts/analyze-skill-availability.ts
 *   pnpm tsx scripts/analyze-skill-availability.ts --verify  # Manual verification mode
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// ============================================================================
// Detection Rules Configuration
// ============================================================================

const DETECTION_RULES = {
  // 中国大陆无法直接访问的域名
  blockedDomains: [
    // 国际科技公司
    "google.com",
    "googleapis.com",
    "openai.com",
    "anthropic.com",
    "stripe.com",
    "aws.amazon.com",
    "github.com",
    "githubusercontent.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "discord.com",
    "slack.com",
    "dropbox.com",
    "box.com",
    "notion.so",
    "linear.app",
    "figma.com",
    "vercel.com",
    "netlify.com",
    "cloudflare.com",
    "zoom.us",
    // 国际 AI 服务
    "cohere.com",
    "huggingface.co",
    "replicate.com",
    "together.ai",
    "mistral.ai",
    "groq.com",
  ],

  // 中国大陆可正常访问的服务
  chinaFriendlyDomains: [
    // 国内云服务
    "aliyun.com",
    "aliyuncs.com",
    "dashscope.aliyuncs.com",
    "tencent.com",
    "tencentcloudapi.com",
    "baidu.com",
    "baidubce.com",
    "huaweicloud.com",
    "volcengine.com",
    "xiaomi.com",
    "bytedance.com",
    // 国内开发平台
    "modelscope.cn",
    "gitee.com",
    "coding.net",
    // 国内社交/办公
    "dingtalk.com",
    "feishu.cn",
    "feishu.net",
    "wecom.work.weixin.qq.com",
    "qq.com",
    "qcloud.com",
    "wechat.com",
    "weixin.qq.com",
    // 国内地图
    "amap.com",
    "baidu.com/maps",
  ],

  // 平台特定 API/关键词
  platformSpecificAPIs: {
    darwin: [
      "keychain",
      "coredata",
      "launchd",
      "cocoa",
      "appkit",
      "foundation",
      "darwin",
      "macos",
      "osx",
      "/usr/bin/osascript",
      "applescript",
    ],
    win32: [
      "registry",
      "win32api",
      "dcom",
      "windows",
      "powershell",
      "cmd.exe",
      "\\windows\\",
      ".exe",
    ],
    linux: [
      "systemd",
      "dbus",
      "x11",
      "wayland",
      "/usr/bin",
      "/etc/systemd",
      "apt-get",
      "yum",
    ],
  },

  // 需要外网的服务关键词
  vpnRequiredKeywords: [
    "google",
    "openai",
    "anthropic",
    "github",
    "stripe",
    "aws",
    "azure",
    "gcp",
    "facebook",
    "twitter",
    "discord",
    "slack",
    "notion",
    "linear",
    "figma",
    "vercel",
    "netlify",
    "cloudflare",
    "zoom",
  ],

  // 中国可用的国际服务（有国内节点）
  chinaAvailableInternational: [
    "microsoft.com", // 有中国数据中心
    "azure.cn", // Azure 中国
    "office.com", // Office 365
    "bing.com", // 必应在中国可用
    "wikipedia.org", // 维基百科可访问（部分语言）
    "stackoverflow.com", // Stack Overflow 可访问
  ],
};

// ============================================================================
// Types
// ============================================================================

type AvailabilityStatus = "available" | "vpn-required" | "blocked" | "unknown";

interface SkillAvailability {
  id: string;
  type: "mcp" | "extension";
  name: string;
  nameEn: string;
  description: string;
  category: string;
  availability: {
    china: {
      status: AvailabilityStatus;
      confidence: number;
      reasons: string[];
      alternatives: string[];
    };
    platforms: {
      supported: string[];
      restrictions: string[];
    };
    requirements: {
      apiKeys: string[];
      services: string[];
      domains: string[];
      adaptationsNeeded: string[];
    };
  };
  metadata: {
    source: string;
    sourceUrl: string;
    version: string;
    toolCount: number;
    lastUpdated: string;
  };
  classification: {
    autoDetected: boolean;
    manualVerified: boolean;
    detectionMethod: string;
    verifiedBy: string | null;
    verifiedAt: string | null;
  };
}

interface MCPIndexItem {
  serverId: string;
  friendlyName: string;
  friendlyNameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  tags: string[];
  version: string;
  requiresApiKey: boolean;
  platforms: string[];
  isOfficial: boolean;
  isNew: boolean;
  toolCount: number;
  source: string;
  sourceUrl: string;
}

interface PluginManifest {
  id: string;
  channels?: string[];
  configSchema?: Record<string, unknown>;
}

// ============================================================================
// Analyzer Core
// ============================================================================

class SkillAvailabilityAnalyzer {
  private mcpIndex: { items: MCPIndexItem[] } | null = null;
  private extensions: Array<{ manifest: PluginManifest; path: string }> = [];
  private results: SkillAvailability[] = [];

  /**
   * 加载 MCP Index
   */
  async loadMCPIndex(): Promise<void> {
    const indexPath = path.join(ROOT_DIR, "data", "mcp-index.json");
    const content = await fs.readFile(indexPath, "utf-8");
    this.mcpIndex = JSON.parse(content);
    console.log(`✅ Loaded ${this.mcpIndex?.items.length || 0} MCP servers`);
  }

  /**
   * 加载内置 Extensions
   */
  async loadExtensions(): Promise<void> {
    const extensionsDir = path.join(ROOT_DIR, "extensions");
    const entries = await fs.readdir(extensionsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(
        extensionsDir,
        entry.name,
        "clawdbot.plugin.json"
      );
      try {
        const content = await fs.readFile(manifestPath, "utf-8");
        const manifest: PluginManifest = JSON.parse(content);
        this.extensions.push({ manifest, path: manifestPath });
      } catch (err) {
        // Skip if no manifest
      }
    }

    console.log(`✅ Loaded ${this.extensions.length} built-in extensions`);
  }

  /**
   * 分析 MCP Server 可用性
   */
  analyzeMCPServer(item: MCPIndexItem): SkillAvailability {
    const text = `${item.serverId} ${item.friendlyName} ${item.description} ${item.descriptionEn}`.toLowerCase();
    const sourceUrl = item.sourceUrl || "";

    // 检测域名
    const domains = this.extractDomains(text + " " + sourceUrl);
    const blockedDomains = domains.filter((d) =>
      DETECTION_RULES.blockedDomains.some((blocked) => d.includes(blocked))
    );
    const chinaFriendlyDomains = domains.filter((d) =>
      DETECTION_RULES.chinaFriendlyDomains.some((friendly) =>
        d.includes(friendly)
      )
    );

    // 检测 VPN 关键词
    const vpnKeywords = DETECTION_RULES.vpnRequiredKeywords.filter(
      (keyword) => text.includes(keyword)
    );

    // 计算可用性状态
    let status: AvailabilityStatus = "unknown";
    let confidence = 0.5;
    const reasons: string[] = [];
    const alternatives: string[] = [];

    // 规则 1: 明确的国内友好服务
    if (chinaFriendlyDomains.length > 0) {
      status = "available";
      confidence = 0.95;
      reasons.push(`使用国内服务: ${chinaFriendlyDomains.join(", ")}`);
    }
    // 规则 2: 使用被屏蔽域名
    else if (blockedDomains.length > 0) {
      status = "vpn-required";
      confidence = 0.9;
      reasons.push(`依赖外网服务: ${blockedDomains.join(", ")}`);
      this.suggestAlternatives(item, alternatives);
    }
    // 规则 3: 包含 VPN 关键词
    else if (vpnKeywords.length > 0) {
      status = "vpn-required";
      confidence = 0.7;
      reasons.push(`可能需要外网: 包含关键词 ${vpnKeywords.join(", ")}`);
    }
    // 规则 4: 来自 ModelScope 的大概率国内可用
    else if (item.source === "modelscope") {
      status = "available";
      confidence = 0.8;
      reasons.push("来自 ModelScope 中国站，大概率可用");
    }
    // 规则 5: 需要 API Key 的国际服务
    else if (item.requiresApiKey && item.source === "officialRegistry") {
      status = "vpn-required";
      confidence = 0.6;
      reasons.push("国际官方服务，可能需要外网 API Key");
    }

    // 平台限制检测
    const platformRestrictions = this.detectPlatformRestrictions(text, item);

    return {
      id: item.serverId,
      type: "mcp",
      name: item.friendlyName,
      nameEn: item.friendlyNameEn || item.friendlyName,
      description: item.description,
      category: item.category,
      availability: {
        china: {
          status,
          confidence,
          reasons,
          alternatives,
        },
        platforms: {
          supported: item.platforms || ["linux", "macos", "windows"],
          restrictions: platformRestrictions,
        },
        requirements: {
          apiKeys: item.requiresApiKey ? ["未知服务"] : [],
          services: [...blockedDomains, ...chinaFriendlyDomains],
          domains,
          adaptationsNeeded: status === "vpn-required" ? ["配置代理"] : [],
        },
      },
      metadata: {
        source: item.source,
        sourceUrl: item.sourceUrl,
        version: item.version,
        toolCount: item.toolCount,
        lastUpdated: new Date().toISOString(),
      },
      classification: {
        autoDetected: true,
        manualVerified: false,
        detectionMethod: "domain-analysis+keyword-match",
        verifiedBy: null,
        verifiedAt: null,
      },
    };
  }

  /**
   * 分析内置 Extension 可用性
   */
  analyzeExtension(ext: {
    manifest: PluginManifest;
    path: string;
  }): SkillAvailability {
    const id = ext.manifest.id;
    const channel = ext.manifest.channels?.[0] || id;

    // 已知的中国可用 extensions
    const chinaFriendly = [
      "feishu",
      "dingtalk",
      "wecom",
      "qqbot",
      "openclawwechat",
      "zalo",
      "zalouser",
      "memory-core",
      "qwen-portal-auth",
      "minimax-portal-auth",
    ];

    // 需要外网的 extensions
    const vpnRequired = [
      "slack",
      "discord",
      "telegram",
      "signal",
      "whatsapp",
      "googlechat",
      "msteams",
      "bluebubbles",
      "imessage",
      "matrix",
      "mattermost",
      "twitch",
    ];

    // macOS 专属
    const macOSOnly = ["imessage", "bluebubbles"];

    let status: AvailabilityStatus = "unknown";
    let confidence = 0.5;
    const reasons: string[] = [];
    const platformRestrictions: string[] = [];

    if (chinaFriendly.includes(id)) {
      status = "available";
      confidence = 1.0;
      reasons.push("国内服务，完全可用");
    } else if (vpnRequired.includes(id)) {
      status = "vpn-required";
      confidence = 0.95;
      reasons.push("国际服务，需要外网访问");
    }

    if (macOSOnly.includes(id)) {
      platformRestrictions.push("仅支持 macOS 平台");
    }

    return {
      id: `extension:${id}`,
      type: "extension",
      name: id,
      nameEn: id,
      description: `内置 ${channel} 扩展`,
      category: "extension",
      availability: {
        china: {
          status,
          confidence,
          reasons,
          alternatives: [],
        },
        platforms: {
          supported: macOSOnly.includes(id)
            ? ["darwin"]
            : ["linux", "darwin", "win32"],
          restrictions: platformRestrictions,
        },
        requirements: {
          apiKeys: [],
          services: [],
          domains: [],
          adaptationsNeeded: [],
        },
      },
      metadata: {
        source: "extension",
        sourceUrl: ext.path,
        version: "internal",
        toolCount: 0,
        lastUpdated: new Date().toISOString(),
      },
      classification: {
        autoDetected: true,
        manualVerified: true,
        detectionMethod: "hardcoded-rules",
        verifiedBy: "system",
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 提取文本中的域名
   */
  private extractDomains(text: string): string[] {
    const domainRegex =
      /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g;
    const matches = text.matchAll(domainRegex);
    return Array.from(matches)
      .map((m) => m[1])
      .filter((d) => d && d.length > 3);
  }

  /**
   * 检测平台限制
   */
  private detectPlatformRestrictions(
    text: string,
    item: MCPIndexItem
  ): string[] {
    const restrictions: string[] = [];

    // 检查是否只支持特定平台
    if (item.platforms && item.platforms.length < 3) {
      if (item.platforms.includes("darwin") && item.platforms.length === 1) {
        restrictions.push("仅支持 macOS");
      } else if (
        item.platforms.includes("win32") &&
        item.platforms.length === 1
      ) {
        restrictions.push("仅支持 Windows");
      } else if (
        item.platforms.includes("linux") &&
        item.platforms.length === 1
      ) {
        restrictions.push("仅支持 Linux");
      }
    }

    // 检测平台特定 API
    for (const [platform, keywords] of Object.entries(
      DETECTION_RULES.platformSpecificAPIs
    )) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          if (platform === "darwin") {
            restrictions.push(`可能需要 macOS 特定 API (${keyword})`);
          } else if (platform === "win32") {
            restrictions.push(`可能需要 Windows 特定 API (${keyword})`);
          } else if (platform === "linux") {
            restrictions.push(`可能需要 Linux 特定 API (${keyword})`);
          }
        }
      }
    }

    return [...new Set(restrictions)];
  }

  /**
   * 建议国内替代方案
   */
  private suggestAlternatives(
    item: MCPIndexItem,
    alternatives: string[]
  ): void {
    const text = `${item.serverId} ${item.friendlyName} ${item.description}`.toLowerCase();

    if (text.includes("openai") || text.includes("gpt")) {
      alternatives.push(
        "可考虑使用阿里云通义千问 (DashScope)",
        "可考虑使用百度文心一言",
        "可考虑使用腾讯混元"
      );
    }

    if (text.includes("google") || text.includes("gemini")) {
      alternatives.push(
        "可考虑使用百度地图 API (地图服务)",
        "可考虑使用通义千问 (AI 服务)"
      );
    }

    if (text.includes("github")) {
      alternatives.push("可考虑使用 Gitee (代码托管)", "配置 GitHub 镜像站");
    }

    if (text.includes("stripe") || text.includes("payment")) {
      alternatives.push(
        "可考虑使用支付宝 API",
        "可考虑使用微信支付 API",
        "可考虑使用银联云闪付"
      );
    }

    if (text.includes("aws") || text.includes("amazon")) {
      alternatives.push(
        "可考虑使用阿里云",
        "可考虑使用腾讯云",
        "可考虑使用华为云"
      );
    }
  }

  /**
   * 执行完整分析
   */
  async analyze(): Promise<void> {
    console.log("\n🔍 Starting skill availability analysis...\n");

    // 分析 MCP Servers
    console.log("📦 Analyzing MCP servers...");
    if (this.mcpIndex) {
      let processed = 0;
      for (const item of this.mcpIndex.items) {
        this.results.push(this.analyzeMCPServer(item));
        processed++;
        if (processed % 1000 === 0) {
          console.log(`   Processed ${processed}/${this.mcpIndex.items.length}`);
        }
      }
    }

    // 分析 Extensions
    console.log("\n🔌 Analyzing built-in extensions...");
    for (const ext of this.extensions) {
      this.results.push(this.analyzeExtension(ext));
    }

    console.log("\n✅ Analysis complete!");
    this.printSummary();
  }

  /**
   * 打印统计摘要
   */
  private printSummary(): void {
    const total = this.results.length;
    const available = this.results.filter(
      (r) => r.availability.china.status === "available"
    ).length;
    const vpnRequired = this.results.filter(
      (r) => r.availability.china.status === "vpn-required"
    ).length;
    const blocked = this.results.filter(
      (r) => r.availability.china.status === "blocked"
    ).length;
    const unknown = this.results.filter(
      (r) => r.availability.china.status === "unknown"
    ).length;

    console.log("\n📊 Analysis Summary:");
    console.log(`   Total skills: ${total}`);
    console.log(
      `   ✅ China available: ${available} (${((available / total) * 100).toFixed(1)}%)`
    );
    console.log(
      `   🌐 VPN required: ${vpnRequired} (${((vpnRequired / total) * 100).toFixed(1)}%)`
    );
    console.log(
      `   🚫 Blocked: ${blocked} (${((blocked / total) * 100).toFixed(1)}%)`
    );
    console.log(
      `   ❓ Unknown: ${unknown} (${((unknown / total) * 100).toFixed(1)}%)`
    );

    // 平台统计
    const macOSOnly = this.results.filter((r) =>
      r.availability.platforms.restrictions.some((s) => s.includes("macOS"))
    ).length;
    const windowsOnly = this.results.filter((r) =>
      r.availability.platforms.restrictions.some((s) => s.includes("Windows"))
    ).length;
    const linuxOnly = this.results.filter((r) =>
      r.availability.platforms.restrictions.some((s) => s.includes("Linux"))
    ).length;

    console.log("\n🖥️  Platform Restrictions:");
    console.log(`   macOS only: ${macOSOnly}`);
    console.log(`   Windows only: ${windowsOnly}`);
    console.log(`   Linux only: ${linuxOnly}`);
  }

  /**
   * 导出结果
   */
  async exportResults(): Promise<void> {
    const outputPath = path.join(
      ROOT_DIR,
      "data",
      "skill-availability-dictionary.json"
    );

    const summary = {
      totalSkills: this.results.length,
      chinaAvailable: this.results.filter(
        (r) => r.availability.china.status === "available"
      ).length,
      requiresVPN: this.results.filter(
        (r) => r.availability.china.status === "vpn-required"
      ).length,
      blocked: this.results.filter(
        (r) => r.availability.china.status === "blocked"
      ).length,
      platformRestricted: this.results.filter(
        (r) => r.availability.platforms.restrictions.length > 0
      ).length,
      categories: this.getCategorySummary(),
    };

    const output = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      summary,
      skills: this.results,
      detectionRules: DETECTION_RULES,
    };

    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n💾 Results saved to: ${outputPath}`);
    console.log(`   File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
  }

  /**
   * 获取分类统计
   */
  private getCategorySummary(): Record<string, number> {
    const categories: Record<string, number> = {};
    for (const result of this.results) {
      categories[result.category] = (categories[result.category] || 0) + 1;
    }
    return categories;
  }

  /**
   * 导出人工验证清单（置信度 < 0.8 的需要人工复核）
   */
  async exportVerificationList(): Promise<void> {
    const needsVerification = this.results.filter(
      (r) => r.availability.china.confidence < 0.8
    );

    const outputPath = path.join(
      ROOT_DIR,
      "data",
      "skill-verification-needed.json"
    );

    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          total: needsVerification.length,
          items: needsVerification.map((r) => ({
            id: r.id,
            name: r.name,
            status: r.availability.china.status,
            confidence: r.availability.china.confidence,
            reasons: r.availability.china.reasons,
          })),
        },
        null,
        2
      ),
      "utf-8"
    );

    console.log(`\n📋 Verification list saved to: ${outputPath}`);
    console.log(
      `   ${needsVerification.length} skills need manual verification`
    );
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const analyzer = new SkillAvailabilityAnalyzer();

  try {
    // 加载数据
    await analyzer.loadMCPIndex();
    await analyzer.loadExtensions();

    // 执行分析
    await analyzer.analyze();

    // 导出结果
    await analyzer.exportResults();
    await analyzer.exportVerificationList();

    console.log("\n🎉 All done!");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
