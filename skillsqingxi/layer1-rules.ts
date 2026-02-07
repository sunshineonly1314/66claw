/**
 * Layer 1: 规则引擎
 * 零成本、毫秒级过滤 — 结构校验 + 危险模式检测 + 黑名单
 */

import { LAYER1_THRESHOLDS } from "./config.js";
import type { SkillInput, Layer1Result, PatternMatch, StructuralViolation } from "./types.js";

// ============================================================================
// 危险模式库
// ============================================================================

interface PatternDef {
  id: string;
  category: string;
  severity: "warning" | "danger" | "critical";
  description: string;
  regex: RegExp;
  /** 在代码块内时是否降级 */
  downgradeInCodeBlock?: boolean;
  /** 附近有此模式时排除误报 */
  excludeIfNearby?: RegExp;
}

const PATTERNS: PatternDef[] = [
  // ===== 提示词注入 (Prompt Injection) =====
  { id: "PI-001", category: "prompt_injection", severity: "critical", description: "忽略先前指令", regex: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?|context)/i },
  { id: "PI-002", category: "prompt_injection", severity: "critical", description: "忽略上文内容", regex: /ignore\s+(all\s+|everything\s+)?above/i },
  { id: "PI-003", category: "prompt_injection", severity: "critical", description: "角色覆盖攻击", regex: /you\s+are\s+now\s+(a|an|the)\s+/i },
  { id: "PI-004", category: "prompt_injection", severity: "critical", description: "遗忘先前上下文", regex: /forget\s+(everything|all|your)\s+(previous|prior|about)/i },
  { id: "PI-005", category: "prompt_injection", severity: "critical", description: "丢弃先前指令", regex: /disregard\s+(all|any|the)\s+(previous|prior|above|preceding)/i },
  { id: "PI-006", category: "prompt_injection", severity: "critical", description: "新系统提示词注入", regex: /new\s+system\s+(prompt|instruction|message)/i },
  { id: "PI-007", category: "prompt_injection", severity: "critical", description: "覆盖安全设置", regex: /override\s+(system|safety|security|guard)/i },
  { id: "PI-008", category: "prompt_injection", severity: "critical", description: "越狱关键词", regex: /\bjailbreak\b/i },
  { id: "PI-009", category: "prompt_injection", severity: "danger", description: "DAN 越狱模式", regex: /\bDAN\s*(mode|prompt|jailbreak)\b/i },
  { id: "PI-010", category: "prompt_injection", severity: "danger", description: "伪造系统标记", regex: /<\/?system\s*>|<\/?instruction\s*>|\[SYSTEM\]|\[INST\]/i, downgradeInCodeBlock: true },
  { id: "PI-011", category: "prompt_injection", severity: "danger", description: "重新定义角色", regex: /from\s+(this\s+point|now\s+on),?\s+(you|i|we)\s+(are|will|must|should)/i },

  // ===== 数据窃取 (Data Exfiltration) =====
  { id: "DE-001", category: "data_exfil", severity: "danger", description: "读取环境变量", regex: /process\.env\b/i, downgradeInCodeBlock: true, excludeIfNearby: /set\s+(your|the)\s+.*(?:key|token)|export\s+\w+=/i },
  { id: "DE-002", category: "data_exfil", severity: "critical", description: "访问 SSH 密钥", regex: /[~$](?:HOME)?[/\\]\.ssh[/\\]/i },
  { id: "DE-003", category: "data_exfil", severity: "critical", description: "访问凭据目录", regex: /\.clawdbot[/\\]credentials/i },
  { id: "DE-004", category: "data_exfil", severity: "critical", description: "读取 .env 文件", regex: /cat\s+[^\s]*\.env\b/i },
  { id: "DE-005", category: "data_exfil", severity: "danger", description: "外传敏感数据", regex: /curl\s+.*-d\s+.*(?:api[_-]?key|token|secret|password|credential)/i },
  { id: "DE-006", category: "data_exfil", severity: "critical", description: "访问密码存储", regex: /\/etc\/shadow|\/etc\/passwd|\.netrc|\.pgpass/i },

  // ===== 命令注入 (Command Injection) =====
  { id: "CI-001", category: "command_injection", severity: "critical", description: "Curl 管道执行", regex: /curl\s+[^\n]*\|\s*(?:ba)?sh\b/i },
  { id: "CI-002", category: "command_injection", severity: "critical", description: "Wget 管道执行", regex: /wget\s+[^\n]*\|\s*(?:ba)?sh\b/i },
  { id: "CI-003", category: "command_injection", severity: "critical", description: "eval 远程代码", regex: /eval\s*\(\s*(?:fetch|require|import)/i },
  { id: "CI-004", category: "command_injection", severity: "danger", description: "反弹 Shell", regex: /\bnc\s+-[elp]|\/dev\/tcp\/|bash\s+-i\s+>&/i },
  { id: "CI-005", category: "command_injection", severity: "danger", description: "修改 Shell 配置", regex: />>?\s*~?\/?\.(?:bashrc|bash_profile|zshrc|profile)\b/i, downgradeInCodeBlock: true, excludeIfNearby: /export\s+PATH.*(?:brew|nvm|go|cargo)/i },
  { id: "CI-006", category: "command_injection", severity: "danger", description: "crontab 修改", regex: /crontab\s+-[er]|\/etc\/cron/i },

  // ===== 混淆 (Obfuscation) =====
  { id: "OB-001", category: "obfuscation", severity: "critical", description: "Base64 解码执行", regex: /base64\s+(?:-d|--decode)\s*[|>]/i },
  { id: "OB-002", category: "obfuscation", severity: "danger", description: "十六进制编码串", regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){5,}/ },
  { id: "OB-003", category: "obfuscation", severity: "danger", description: "零宽字符", regex: /[\u200B\u200C\u200D\u2060\uFEFF]/ },

  // ===== 挖矿 =====
  { id: "CM-001", category: "crypto_mining", severity: "critical", description: "挖矿软件", regex: /\b(?:xmrig|monero|coinhive|cryptonight|minergate)\b/i },

  // ===== 权限提升 =====
  { id: "PE-001", category: "privilege_escalation", severity: "danger", description: "危险文件权限", regex: /chmod\s+(?:777|666|a\+[rwx])/i },
  { id: "PE-002", category: "privilege_escalation", severity: "danger", description: "跳过安全验证", regex: /--no-verify\b|--insecure\b/i, downgradeInCodeBlock: true, excludeIfNearby: /git\s+commit|git\s+push|self-signed|localhost/i },
];

// ============================================================================
// 黑名单
// ============================================================================

const SKILL_NAME_BLACKLIST = [
  "jailbreak", "bypass", "hack", "exploit", "crack",
  "phishing", "malware", "trojan", "backdoor", "rootkit",
  "fake", "scam", "spam", "casino", "gambling",
  "nsfw", "porn", "xxx", "adult-content",
  "pump-dump", "rug-pull", "token-launch",
];

// ============================================================================
// 辅助函数
// ============================================================================

/** 判断位置是否在 Markdown 代码块内 */
function isInCodeBlock(content: string, matchIndex: number): boolean {
  const before = content.substring(0, matchIndex);
  const fenceCount = (before.match(/```/g) || []).length;
  return fenceCount % 2 === 1;
}

/** 获取行号 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

/** 检查附近上下文 */
function hasNearbyContext(content: string, matchIndex: number, pattern: RegExp, range = 200): boolean {
  const start = Math.max(0, matchIndex - range);
  const end = Math.min(content.length, matchIndex + range);
  const nearby = content.substring(start, end);
  return pattern.test(nearby);
}

// ============================================================================
// 结构校验
// ============================================================================

function checkStructural(input: SkillInput): StructuralViolation[] {
  const violations: StructuralViolation[] = [];

  // 文件大小
  if (input.rawContent.length > LAYER1_THRESHOLDS.maxFileSize) {
    violations.push({ rule: "maxFileSize", severity: "error", message: `文件大小 ${input.rawContent.length} 超过上限 ${LAYER1_THRESHOLDS.maxFileSize}` });
  }

  // 必填字段
  if (!input.frontmatter.name) {
    violations.push({ rule: "requiredField:name", severity: "error", message: "缺少 frontmatter.name 字段" });
  }
  if (!input.frontmatter.description) {
    violations.push({ rule: "requiredField:description", severity: "error", message: "缺少 frontmatter.description 字段" });
  }

  // name 格式
  if (input.frontmatter.name && !/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/.test(input.frontmatter.name)) {
    violations.push({ rule: "nameFormat", severity: "error", message: `name "${input.frontmatter.name}" 不符合 ^[a-z0-9-]+$ 格式` });
  }

  // body 行数
  const lineCount = input.body.split("\n").length;
  if (lineCount > LAYER1_THRESHOLDS.maxBodyLines) {
    violations.push({ rule: "maxBodyLines", severity: "warning", message: `body 行数 ${lineCount} 超过上限 ${LAYER1_THRESHOLDS.maxBodyLines}` });
  }

  // 空 body
  if (!input.body.trim()) {
    violations.push({ rule: "emptyBody", severity: "error", message: "SKILL.md body 为空" });
  }

  // description 过长
  if (input.frontmatter.description && input.frontmatter.description.length > LAYER1_THRESHOLDS.maxDescriptionLength) {
    violations.push({ rule: "descriptionLength", severity: "warning", message: `description 长度 ${input.frontmatter.description.length} 超过上限` });
  }

  return violations;
}

// ============================================================================
// 主函数
// ============================================================================

export function runLayer1(input: SkillInput): Layer1Result {
  const startTime = Date.now();

  // 1. 结构校验
  const structural = checkStructural(input);

  // 2. 模式检测（上下文感知）
  const patternMatches: PatternMatch[] = [];
  const fullContent = input.rawContent;

  for (const pat of PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pat.regex.source, pat.regex.flags + (pat.regex.flags.includes("g") ? "" : "g"));

    while ((match = regex.exec(fullContent)) !== null) {
      const inCodeBlock = isInCodeBlock(fullContent, match.index);

      // 上下文感知：排除误报
      if (pat.excludeIfNearby && hasNearbyContext(fullContent, match.index, pat.excludeIfNearby)) {
        continue;
      }

      // 代码块内降级
      let severity = pat.severity;
      if (inCodeBlock && pat.downgradeInCodeBlock) {
        if (severity === "critical") severity = "danger";
        else if (severity === "danger") severity = "warning";
      }

      patternMatches.push({
        patternId: pat.id,
        category: pat.category,
        severity,
        description: pat.description,
        matchedText: match[0].substring(0, 80),
        lineNumber: getLineNumber(fullContent, match.index),
        inCodeBlock,
      });
    }
  }

  // 3. 黑名单
  const blacklistHits: string[] = [];
  const nameLower = input.frontmatter.name?.toLowerCase() ?? "";
  for (const keyword of SKILL_NAME_BLACKLIST) {
    if (nameLower.includes(keyword)) {
      blacklistHits.push(keyword);
    }
  }

  // 4. 判定
  let decision: "pass" | "reject" | "review" = "pass";

  // 结构错误 → reject
  if (structural.some((v) => v.severity === "error")) {
    decision = "reject";
  }

  // 黑名单 → reject
  if (blacklistHits.length > 0) {
    decision = "reject";
  }

  // critical 模式 → reject
  if (patternMatches.some((m) => m.severity === "critical")) {
    decision = "reject";
  }

  // danger 数量超阈值 → reject
  const dangerCount = patternMatches.filter((m) => m.severity === "danger").length;
  if (dangerCount >= LAYER1_THRESHOLDS.dangerRejectThreshold) {
    decision = "reject";
  }

  // 单个 danger → review
  if (decision === "pass" && dangerCount === 1) {
    decision = "review";
  }

  return {
    skillId: input.skillId,
    passed: decision !== "reject",
    decision,
    structural,
    patternMatches,
    blacklistHits,
    processingTimeMs: Date.now() - startTime,
  };
}
