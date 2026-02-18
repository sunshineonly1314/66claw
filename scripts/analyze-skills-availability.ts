#!/usr/bin/env node
/**
 * Skills Availability Analyzer for China Users
 *
 * 分析 3,077 个 Skills 的中国可用性
 *
 * Usage:
 *   pnpm tsx scripts/analyze-skills-availability.ts
 *   pnpm tsx scripts/analyze-skills-availability.ts --source E:/clawdbuild/full-skills
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SKILLS_DIR = "E:/clawdbuild/full-skills";

const DETECTION_RULES = {
  // 中国无法访问的域名/服务
  blockedServices: [
    "google", "googleapis", "openai", "anthropic", "stripe", "aws", "amazon",
    "github", "githubusercontent", "facebook", "twitter", "x.com", "instagram",
    "youtube", "discord", "slack", "dropbox", "notion", "linear", "figma",
    "vercel", "netlify", "cloudflare", "zoom", "cohere", "huggingface",
    "replicate", "together.ai", "mistral.ai", "groq"
  ],

  // 中国可用的服务
  chinaFriendlyServices: [
    "aliyun", "aliyuncs", "dashscope", "tencent", "tencentcloud", "baidu",
    "baidubce", "huawei", "huaweicloud", "volcengine", "xiaomi", "bytedance",
    "modelscope", "gitee", "coding.net", "dingtalk", "feishu", "wecom",
    "wechat", "weixin", "qq", "qcloud", "amap", "baidu.com/maps"
  ],

  // macOS 专属
  macOSKeywords: [
    "keychain", "applescript", "osascript", "macos", "osx", "darwin",
    "cocoa", "appkit", "foundation", "launchd", "apple", "icloud"
  ],

  // Windows 专属
  windowsKeywords: [
    "windows", "win32", "registry", "powershell", "cmd.exe", "wsl"
  ],

  // Linux 专属
  linuxKeywords: [
    "systemd", "dbus", "apt-get", "yum", "snap", "flatpak"
  ]
};

// ============================================================================
// Types
// ============================================================================

interface SkillMetadata {
  name: string;
  description: string;
  homepage?: string;
  metadata?: {
    clawdbot?: {
      emoji?: string;
      requires?: {
        bins?: string[];
        [key: string]: any;
      };
      install?: Array<{
        id: string;
        kind: string;
        os?: string[];
        [key: string]: any;
      }>;
      [key: string]: any;
    };
  };
}

interface SkillAvailability {
  id: string;
  name: string;
  description: string;
  category: string;
  availability: {
    china: {
      status: "available" | "vpn-required" | "blocked" | "unknown";
      confidence: number;
      reasons: string[];
      alternatives: string[];
    };
    platforms: {
      supported: string[];
      restrictions: string[];
    };
    requirements: {
      bins: string[];
      services: string[];
      domains: string[];
    };
  };
  metadata: {
    source: string;
    homepage?: string;
    emoji?: string;
  };
}

// ============================================================================
// Analyzer
// ============================================================================

class SkillsAvailabilityAnalyzer {
  private skillsDir: string;
  private results: SkillAvailability[] = [];

  constructor(skillsDir: string = DEFAULT_SKILLS_DIR) {
    this.skillsDir = skillsDir;
  }

  async analyze(): Promise<void> {
    console.log(`\n🔍 Starting Skills availability analysis...`);
    console.log(`📂 Source: ${this.skillsDir}\n`);

    const skillDirs = await this.getSkillDirectories();
    console.log(`✅ Found ${skillDirs.length} skill directories\n`);

    let processed = 0;
    for (const skillDir of skillDirs) {
      try {
        const result = await this.analyzeSkill(skillDir);
        if (result) {
          this.results.push(result);
        }
        processed++;
        if (processed % 100 === 0) {
          console.log(`   Processed ${processed}/${skillDirs.length}`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to analyze ${skillDir}: ${error}`);
      }
    }

    console.log(`\n✅ Analysis complete!`);
    this.printSummary();
  }

  private async getSkillDirectories(): Promise<string[]> {
    const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => path.join(this.skillsDir, e.name));
  }

  private async analyzeSkill(skillDir: string): Promise<SkillAvailability | null> {
    const skillMdPath = path.join(skillDir, "SKILL.md");

    try {
      await fs.access(skillMdPath);
    } catch {
      return null; // No SKILL.md
    }

    const content = await fs.readFile(skillMdPath, "utf-8");
    const metadata = this.parseSkillMetadata(content);

    if (!metadata.name) {
      return null;
    }

    const text = content.toLowerCase();
    const domains = this.extractDomains(text);

    // 检测服务依赖
    const blockedServices = DETECTION_RULES.blockedServices.filter(s =>
      text.includes(s.toLowerCase())
    );
    const chinaServices = DETECTION_RULES.chinaFriendlyServices.filter(s =>
      text.includes(s.toLowerCase())
    );

    // 检测域名
    const blockedDomains = domains.filter(d =>
      DETECTION_RULES.blockedServices.some(blocked => d.includes(blocked))
    );
    const chinaDomains = domains.filter(d =>
      DETECTION_RULES.chinaFriendlyServices.some(friendly => d.includes(friendly))
    );

    // 计算可用性
    let status: "available" | "vpn-required" | "blocked" | "unknown" = "unknown";
    let confidence = 0.5;
    const reasons: string[] = [];
    const alternatives: string[] = [];

    if (chinaServices.length > 0 || chinaDomains.length > 0) {
      status = "available";
      confidence = 0.95;
      reasons.push(`使用国内服务: ${[...chinaServices, ...chinaDomains].join(", ")}`);
    } else if (blockedServices.length > 0 || blockedDomains.length > 0) {
      status = "vpn-required";
      confidence = 0.9;
      reasons.push(`依赖外网服务: ${[...blockedServices, ...blockedDomains].join(", ")}`);
      this.suggestAlternatives(metadata.name, text, alternatives);
    } else if (metadata.homepage && this.isBlockedDomain(metadata.homepage)) {
      status = "vpn-required";
      confidence = 0.7;
      reasons.push(`官网需要外网: ${metadata.homepage}`);
    } else {
      // 默认可用（如果没有明确的外网依赖）
      status = "available";
      confidence = 0.6;
      reasons.push("未检测到明确的外网依赖，大概率可用");
    }

    // 平台检测
    const platformRestrictions = this.detectPlatformRestrictions(text, metadata);
    const supportedPlatforms = this.getSupportedPlatforms(metadata, platformRestrictions);

    // 分类
    const category = this.categorizeSkill(metadata.name, text);

    return {
      id: metadata.name,
      name: metadata.name,
      description: metadata.description || "",
      category,
      availability: {
        china: {
          status,
          confidence,
          reasons,
          alternatives,
        },
        platforms: {
          supported: supportedPlatforms,
          restrictions: platformRestrictions,
        },
        requirements: {
          bins: metadata.metadata?.clawdbot?.requires?.bins || [],
          services: [...blockedServices, ...chinaServices],
          domains: [...blockedDomains, ...chinaDomains],
        },
      },
      metadata: {
        source: "installer",
        homepage: metadata.homepage,
        emoji: metadata.metadata?.clawdbot?.emoji,
      },
    };
  }

  private parseSkillMetadata(content: string): SkillMetadata {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return { name: "", description: "" };
    }

    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split("\n");

    const result: SkillMetadata = { name: "", description: "" };

    for (const line of lines) {
      const nameMatch = line.match(/^name:\s*(.+)$/);
      if (nameMatch) {
        result.name = nameMatch[1].trim();
        continue;
      }

      const descMatch = line.match(/^description:\s*(.+)$/);
      if (descMatch) {
        result.description = descMatch[1].replace(/^["']|["']$/g, "").trim();
        continue;
      }

      const homepageMatch = line.match(/^homepage:\s*(.+)$/);
      if (homepageMatch) {
        result.homepage = homepageMatch[1].trim();
        continue;
      }

      const metadataMatch = line.match(/^metadata:\s*(\{.+\})$/);
      if (metadataMatch) {
        try {
          result.metadata = JSON.parse(metadataMatch[1]);
        } catch {
          // Ignore parse errors
        }
      }
    }

    return result;
  }

  private extractDomains(text: string): string[] {
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g;
    const matches = text.matchAll(domainRegex);
    return Array.from(matches)
      .map(m => m[1])
      .filter(d => d && d.length > 3);
  }

  private isBlockedDomain(url: string): boolean {
    const urlLower = url.toLowerCase();
    return DETECTION_RULES.blockedServices.some(s => urlLower.includes(s));
  }

  private detectPlatformRestrictions(text: string, metadata: SkillMetadata): string[] {
    const restrictions: string[] = [];

    // 检查 install 配置中的 os 限制
    const installs = metadata.metadata?.clawdbot?.install || [];
    const osRestrictions = installs
      .filter(i => i.os && i.os.length > 0)
      .flatMap(i => i.os);

    if (osRestrictions.length > 0 && osRestrictions.length < 3) {
      if (osRestrictions.includes("darwin")) {
        restrictions.push("仅支持 macOS");
      } else if (osRestrictions.includes("win32")) {
        restrictions.push("仅支持 Windows");
      } else if (osRestrictions.includes("linux")) {
        restrictions.push("仅支持 Linux");
      }
    }

    // 关键词检测
    if (DETECTION_RULES.macOSKeywords.some(k => text.includes(k))) {
      restrictions.push("可能需要 macOS 特定功能");
    }
    if (DETECTION_RULES.windowsKeywords.some(k => text.includes(k))) {
      restrictions.push("可能需要 Windows 特定功能");
    }
    if (DETECTION_RULES.linuxKeywords.some(k => text.includes(k))) {
      restrictions.push("可能需要 Linux 特定功能");
    }

    return [...new Set(restrictions)];
  }

  private getSupportedPlatforms(metadata: SkillMetadata, restrictions: string[]): string[] {
    // 默认支持所有平台
    let platforms = ["linux", "darwin", "win32"];

    // 如果有明确的 OS 限制
    const installs = metadata.metadata?.clawdbot?.install || [];
    const osRestrictions = installs
      .filter(i => i.os && i.os.length > 0)
      .flatMap(i => i.os);

    if (osRestrictions.length > 0) {
      platforms = [...new Set(osRestrictions)];
    }

    return platforms;
  }

  private categorizeSkill(name: string, text: string): string {
    const nameLower = name.toLowerCase();

    if (nameLower.includes("ai") || text.includes("openai") || text.includes("llm")) {
      return "ai";
    }
    if (nameLower.includes("github") || nameLower.includes("git") || text.includes("git")) {
      return "development";
    }
    if (nameLower.includes("notion") || nameLower.includes("calendar") || nameLower.includes("task")) {
      return "productivity";
    }
    if (nameLower.includes("discord") || nameLower.includes("slack") || nameLower.includes("telegram")) {
      return "communication";
    }
    if (nameLower.includes("music") || nameLower.includes("spotify") || nameLower.includes("media")) {
      return "media";
    }
    if (nameLower.includes("smart") || nameLower.includes("home") || nameLower.includes("iot")) {
      return "smarthome";
    }

    return "other";
  }

  private suggestAlternatives(name: string, text: string, alternatives: string[]): void {
    if (text.includes("openai") || text.includes("gpt")) {
      alternatives.push("通义千问 (DashScope)", "百度文心一言", "腾讯混元");
    }
    if (text.includes("google") || text.includes("gemini")) {
      alternatives.push("通义千问", "百度地图 (地图服务)");
    }
    if (text.includes("github")) {
      alternatives.push("Gitee", "Coding.net");
    }
    if (text.includes("stripe")) {
      alternatives.push("支付宝", "微信支付");
    }
    if (text.includes("aws") || text.includes("amazon")) {
      alternatives.push("阿里云", "腾讯云", "华为云");
    }
  }

  private printSummary(): void {
    const total = this.results.length;
    const available = this.results.filter(r => r.availability.china.status === "available").length;
    const vpnRequired = this.results.filter(r => r.availability.china.status === "vpn-required").length;
    const blocked = this.results.filter(r => r.availability.china.status === "blocked").length;
    const unknown = this.results.filter(r => r.availability.china.status === "unknown").length;

    console.log(`\n📊 Analysis Summary:`);
    console.log(`   Total skills: ${total}`);
    console.log(`   ✅ China available: ${available} (${((available / total) * 100).toFixed(1)}%)`);
    console.log(`   🌐 VPN required: ${vpnRequired} (${((vpnRequired / total) * 100).toFixed(1)}%)`);
    console.log(`   🚫 Blocked: ${blocked} (${((blocked / total) * 100).toFixed(1)}%)`);
    console.log(`   ❓ Unknown: ${unknown} (${((unknown / total) * 100).toFixed(1)}%)`);

    // 平台统计
    const macOSOnly = this.results.filter(r =>
      r.availability.platforms.supported.includes("darwin") &&
      r.availability.platforms.supported.length === 1
    ).length;
    const windowsOnly = this.results.filter(r =>
      r.availability.platforms.supported.includes("win32") &&
      r.availability.platforms.supported.length === 1
    ).length;

    console.log(`\n🖥️  Platform Restrictions:`);
    console.log(`   macOS only: ${macOSOnly}`);
    console.log(`   Windows only: ${windowsOnly}`);
  }

  async exportResults(): Promise<void> {
    const outputPath = path.join(ROOT_DIR, "data", "skills-availability-dictionary.json");

    const summary = {
      totalSkills: this.results.length,
      chinaAvailable: this.results.filter(r => r.availability.china.status === "available").length,
      requiresVPN: this.results.filter(r => r.availability.china.status === "vpn-required").length,
      blocked: this.results.filter(r => r.availability.china.status === "blocked").length,
      platformRestricted: this.results.filter(r => r.availability.platforms.restrictions.length > 0).length,
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

  private getCategorySummary(): Record<string, number> {
    const categories: Record<string, number> = {};
    for (const result of this.results) {
      categories[result.category] = (categories[result.category] || 0) + 1;
    }
    return categories;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf("--source");
  const skillsDir = sourceIdx >= 0 && args[sourceIdx + 1]
    ? args[sourceIdx + 1]
    : DEFAULT_SKILLS_DIR;

  const analyzer = new SkillsAvailabilityAnalyzer(skillsDir);

  try {
    await analyzer.analyze();
    await analyzer.exportResults();
    console.log(`\n🎉 All done!`);
  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

main();
