#!/usr/bin/env npx tsx
/**
 * Operations Diagnostics Agent (Repomix + SiliconFlow GLM-5)
 *
 * Workflow:
 *   1. Pull pending tickets from the remote log-report server
 *   2. Use Repomix to pack project source code into a compressed context file
 *   3. Feed code context + log + description to SiliconFlow GLM-5 API directly
 *   4. Send the user-facing fix instructions back to the server as a ticket reply
 *   5. Archive the issue locally to D:\bugsfind\issues\ for downstream code review
 *
 * Architecture: Repomix pre-packs the codebase with tree-sitter compression,
 * then we inject the packed context into the SiliconFlow API prompt. This avoids
 * the OpenCode agent loop timeout on large projects (3600+ files) while giving
 * the LLM full code visibility.
 *
 * Usage:
 *   npx tsx scripts/ops-diagnose-agent.ts --list                List pending reports
 *   npx tsx scripts/ops-diagnose-agent.ts --ticket CODE         Process a specific ticket
 *   npx tsx scripts/ops-diagnose-agent.ts --auto                Auto-process all pending
 *   npx tsx scripts/ops-diagnose-agent.ts --auto --dry-run      Analyze only, don't reply
 *   npx tsx scripts/ops-diagnose-agent.ts --rebuild-context      Force rebuild Repomix cache
 *
 * Environment:
 *   OPS_API_TOKEN     — Admin Bearer token for the log-report admin API
 *   SILICONFLOW_KEY   — SiliconFlow API key
 *   PROJECT_CWD       — Project workspace for Repomix (default: D:\bugsfind\openclawcn)
 *   ISSUES_DIR        — Where to archive issues (default: D:\bugsfind\issues)
 *   REPORT_API_BASE   — Override server API base URL
 *   REPOMIX_MAX_TOKENS — Max tokens for code context (default: 100000)
 */

import { exec } from "node:child_process";
import { mkdir, writeFile, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ── Configuration ────────────────────────────────────────────────────────────

const REPORT_API_BASE =
  process.env.REPORT_API_BASE || "https://www.obplugins.cn/api/api/v1/log-report";
const OPS_TOKEN = process.env.OPS_API_TOKEN || "";
const SILICONFLOW_KEY = process.env.SILICONFLOW_KEY || "";

const PROJECT_CWD = process.env.PROJECT_CWD || process.env.OPENCODE_CWD || "D:\\bugsfind\\openclawcn";
const ISSUES_DIR = process.env.ISSUES_DIR || "D:\\bugsfind\\issues";

/** SiliconFlow API for direct LLM calls. */
const SILICONFLOW_API = "https://api.siliconflow.cn/v1/chat/completions";
const SILICONFLOW_MODEL = "Pro/zai-org/GLM-5";

/** Repomix output path (relative to PROJECT_CWD). */
const REPOMIX_OUTPUT = ".ops-tmp/repomix-output.txt";
/** Repomix cache max age: rebuild if older than 2 hours. */
const REPOMIX_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Max characters of Repomix output to inject into prompt.
 *  GLM-5 has 128K context. We reserve ~10K for prompt/logs, so ~118K for code.
 *  At ~4 chars/token, that's ~470K chars. Default conservatively to 100K tokens. */
const REPOMIX_MAX_CHARS = parseInt(process.env.REPOMIX_MAX_TOKENS || "100000", 10) * 4;

// ── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.includes("--list")
  ? "list"
  : args.includes("--auto")
    ? "auto"
    : args.includes("--ticket")
      ? "ticket"
      : args.includes("--rebuild-context")
        ? "rebuild"
        : "help";

const DRY_RUN = args.includes("--dry-run");
const FORCE_REBUILD = args.includes("--rebuild-context");

const ticketArg = (() => {
  const idx = args.indexOf("--ticket");
  return idx >= 0 && args[idx + 1] ? args[idx + 1].toUpperCase() : "";
})();

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportSummary {
  id: string;
  ticketCode: string;
  status: string;
  description: string;
  deviceId: string;
  createdAt: string;
  logEntryCount: number;
}

interface ReportDetail {
  id: string;
  ticketCode: string;
  status: string;
  description: string;
  deviceId: string;
  context: {
    version?: string;
    platform?: string;
    hostname?: string;
    uptime?: number;
    timestamp?: string;
  };
  logEntries: string[];
  createdAt: string;
  reply?: { content: string; repliedAt: string } | null;
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${REPORT_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${OPS_TOKEN}`,
      "User-Agent": "OpenClawCN-OpsAgent/1.0",
    },
  });
  if (!resp.ok) {
    throw new Error(`GET ${path} failed (${resp.status}): ${await resp.text()}`);
  }
  return (await resp.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${REPORT_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPS_TOKEN}`,
      "User-Agent": "OpenClawCN-OpsAgent/1.0",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`POST ${path} failed (${resp.status}): ${await resp.text()}`);
  }
  return (await resp.json()) as T;
}

// ── List pending reports ─────────────────────────────────────────────────────

async function listReports(): Promise<void> {
  const data = await apiGet<{
    success: boolean;
    reports: ReportSummary[];
    total: number;
  }>("/admin/list?status=pending&limit=20");

  if (!data.success || !data.reports?.length) {
    console.log("No pending reports found.");
    return;
  }

  console.log(`\n=== ${data.total} Pending Reports ===\n`);
  for (const r of data.reports) {
    console.log(
      `  [${r.ticketCode}] ${r.status.padEnd(10)} ${r.createdAt.slice(0, 19)}  ${r.description.slice(0, 60)}`,
    );
  }
  console.log();
}

// ── Fetch report detail ──────────────────────────────────────────────────────

async function fetchReport(code: string): Promise<ReportDetail> {
  const data = await apiGet<{ success: boolean; report: ReportDetail }>(
    `/admin/detail/${code}`,
  );
  if (!data.success || !data.report) throw new Error(`Report ${code} not found`);
  return data.report;
}

// ── Repomix code context ─────────────────────────────────────────────────────

/**
 * Build or reuse the Repomix code context cache.
 * Repomix packs the project source into a single compressed file using tree-sitter.
 * We cache the output and rebuild every REPOMIX_CACHE_MAX_AGE_MS or on --rebuild-context.
 */
async function ensureRepomixContext(forceRebuild = false): Promise<string> {
  const outputPath = join(PROJECT_CWD, REPOMIX_OUTPUT);
  const tmpDir = join(PROJECT_CWD, ".ops-tmp");
  await mkdir(tmpDir, { recursive: true });

  // Check cache freshness
  if (!forceRebuild) {
    try {
      const fileStat = await stat(outputPath);
      const ageMs = Date.now() - fileStat.mtimeMs;
      if (ageMs < REPOMIX_CACHE_MAX_AGE_MS) {
        const content = await readFile(outputPath, "utf-8");
        if (content.length > 1000) {
          console.log(`  [Repomix] Using cached context (${Math.round(ageMs / 60000)}min old, ${Math.round(content.length / 1024)}KB)`);
          return content;
        }
      }
      console.log(`  [Repomix] Cache expired (${Math.round(ageMs / 60000)}min old), rebuilding...`);
    } catch {
      console.log(`  [Repomix] No cache found, building...`);
    }
  } else {
    console.log(`  [Repomix] Force rebuild requested...`);
  }

  // Run repomix with the project's repomix.config.json
  const configPath = join(PROJECT_CWD, "repomix.config.json");

  console.log(`  [Repomix] Running: npx repomix --config "${configPath}"`);
  const startTime = Date.now();

  try {
    // configPath is derived from our own PROJECT_CWD + constant, not user input.
    // We use exec() because npx.cmd on Windows requires shell execution.
    const { stdout, stderr } = await execAsync(
      `npx repomix --config "${configPath}"`,
      {
        cwd: PROJECT_CWD,
        timeout: 120_000, // 2 minutes max
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
    );
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  [Repomix] Built in ${elapsed}s`);
    if (stderr) console.log(`  [Repomix] ${stderr.slice(0, 300)}`);
    if (stdout) console.log(`  [Repomix] ${stdout.slice(0, 300)}`);
  } catch (err: any) {
    console.error(`  [Repomix] Build failed: ${err.message}`);
    throw new Error(`Repomix failed: ${err.message}`);
  }

  const content = await readFile(outputPath, "utf-8");
  console.log(`  [Repomix] Output: ${Math.round(content.length / 1024)}KB`);
  return trimRepomixContext(content);
}

/**
 * Trim the Repomix output to fit within REPOMIX_MAX_CHARS.
 * Repomix sorts files by git change count — most-changed files are at the END.
 * We keep the header (file list + directory structure) + tail (most-changed files).
 */
function trimRepomixContext(raw: string): string {
  if (raw.length <= REPOMIX_MAX_CHARS) return raw;

  const headerEnd = raw.indexOf("================\nFile:");
  const headerSize = headerEnd > 0 ? Math.min(headerEnd, 20000) : 5000;
  const header = raw.slice(0, headerSize);
  const tailBudget = REPOMIX_MAX_CHARS - headerSize - 100;
  const tail = raw.slice(-tailBudget);
  const trimmed = header + "\n...(truncated stable files)...\n" + tail;
  console.log(`  [Repomix] Trimmed: ${Math.round(raw.length / 1024)}KB → ${Math.round(trimmed.length / 1024)}KB`);
  return trimmed;
}

// ── LLM analysis ─────────────────────────────────────────────────────────────

function getLogSnippet(report: ReportDetail): string {
  const errorLogs = report.logEntries
    .filter(
      (l) =>
        /"l":"(error|warn)"/i.test(l) ||
        /error|fail|crash|exception|timeout|ECONNREFUSED|ENOTFOUND/i.test(l),
    )
    .slice(0, 50);

  return errorLogs.length > 0
    ? errorLogs.join("\n")
    : report.logEntries.slice(-30).join("\n");
}

/** Step 1: 完整技术分析（含源码定位、代码修复方案）— 给开发团队看 */
function buildAnalysisPrompt(report: ReportDetail, codeContext: string): string {
  const logSnippet = getLogSnippet(report);

  // codeContext is already trimmed by trimRepomixContext() in ensureRepomixContext()
  return `你是 ClawdbotCN 的高级诊断工程师。下面提供了项目完整源码（经 tree-sitter 压缩），请根据用户反馈的现象和日志，在源码中定位问题根因。

## 项目源码（压缩版）
<code-context>
${codeContext}
</code-context>

## 用户反馈的现象
${report.description}

## 用户环境
- 系统: ${report.context.platform || "未知"}
- 软件版本: ${report.context.version || "未知"}
- 主机名: ${report.context.hostname || "未知"}
- 提交时间: ${report.createdAt}

## 错误日志 (共 ${report.logEntries.length} 条，以下是关键部分)
\`\`\`
${logSnippet.slice(0, 6000)}
\`\`\`

## 请执行以下步骤
1. 在上面的源码中搜索日志里出现的错误信息、函数名、模块名
2. 找到产生该错误的代码位置（文件路径 + 行号）
3. 分析根本原因
4. 判断问题类型：
   - A类: 用户侧问题（配置错误、环境缺依赖、网络不通、权限不足等）— 用户可自行修复
   - B类: 软件代码 bug — 需要开发团队修复

## 输出格式（中文，技术报告风格）

### 问题类型
A类（用户侧）或 B类（代码bug），一句话说明

### 根因定位
- 错误源码位置：文件路径 + 行号
- 错误触发链路：简述调用链
- 根本原因：为什么会出这个错

### 代码修复方案（如果是 B类）
- 需要修改的文件和具体改动
- 修复思路

### 用户侧解决方案（如果是 A类，或 B类有临时绕过办法）
- 用户可以做的操作（改配置、改环境变量、运行命令、重启、更新版本等）

控制在 1000 字以内。`;
}

/** Step 2: 从技术分析中提取用户回复（小白语言，不含源码细节） */
function buildUserReplyPrompt(report: ReportDetail, analysis: string): string {
  return `下面是我们技术团队对一个用户问题的内部诊断分析。请你把它转化为一段给普通用户（小白）看的回复。

## 用户的原始问题
${report.description}

## 内部技术分析（用户看不到这个）
${analysis}

## 转化要求
用中文，语气亲切友好，像朋友帮忙解决电脑问题。
目标用户是完全不懂技术的普通人（比如你爸妈），他们不知道什么是环境变量、命令行、开发者工具。

### 绝对禁止出现的内容
- 源码文件路径、函数名、行号、代码片段
- 让用户改 .ts / .js / .rs / .json 等代码文件
- 系统变量路径如 %APPDATA%、%LOCALAPPDATA%、%TEMP% — 小白根本不知道这是什么
- 让用户按 F12 打开开发者工具 — 小白不会用
- 让用户运行命令行 / PowerShell / cmd 命令
- 让用户检查 API 地址是否可访问
- 任何需要编程或系统管理知识的操作

### 允许出现的操作（小白能做到的）
- 关闭软件重新打开
- 到官网下载最新版重新安装（给出具体网址）
- 在 Windows 设置里操作（用截图级别的细致描述，比如"点击左下角开始菜单 → 设置 → ..."）
- 用软件自带的功能（比如设置页面里的选项）
- 检查网络连接（比如"打开浏览器看看能不能上网"）

### 输出格式

**问题原因**（1-2 句大白话，说清楚出了什么问题，像跟朋友聊天那样）

**解决方法**（编号步骤，每步都要具体到"点哪里"）
- 如果是软件 bug 用户没法修：说"这个问题我们已经发现了，正在加紧修复，预计下个版本更新后就好了"
- 复杂问题建议用户联系客服或等待更新
- 结尾加一句暖心的话

控制在 300 字以内。`;
}

/** Call SiliconFlow API directly with timeout and retry. */
async function callLLM(prompt: string, maxTokens = 2048): Promise<string> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 5000; // 5s, 10s backoff
      console.log(`  [LLM] Retry ${attempt}/${maxRetries} after ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000); // 2 minute timeout

      const resp = await fetch(SILICONFLOW_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SILICONFLOW_KEY}`,
        },
        body: JSON.stringify({
          model: SILICONFLOW_MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.status === 429 || resp.status >= 500) {
        lastError = new Error(`SiliconFlow API ${resp.status}: ${await resp.text()}`);
        continue; // retry on 429 or 5xx
      }
      if (!resp.ok) {
        // 4xx errors (400, 401, 403, etc.) are client errors — retrying won't help
        throw new Error(`SiliconFlow API error (${resp.status}): ${await resp.text()}`);
      }

      const data = (await resp.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const usage = data.usage;
      if (usage) {
        console.log(`  [LLM] tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}`);
      }
      return data.choices[0]?.message?.content?.trim() || "(empty response)";
    } catch (err: any) {
      // AbortError and network errors are retryable
      if (err.name === "AbortError") {
        lastError = new Error("SiliconFlow API timeout (120s)");
      } else if (err.message?.includes("fetch failed") || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        lastError = err; // network error, retryable
      } else {
        throw err; // non-retryable error (e.g. 4xx), propagate immediately
      }
    }
  }

  throw lastError || new Error("callLLM failed after retries");
}

interface DiagnosisResult {
  /** 完整技术分析（含源码位置、代码修复方案）— 归档给开发团队 */
  technicalAnalysis: string;
  /** 小白用户回复（不含源码细节）— 发回给用户 */
  userReply: string;
}

/**
 * Two-step analysis with Repomix code context:
 *   1. Inject packed code context + logs → SiliconFlow API → technical diagnosis
 *   2. Technical diagnosis → SiliconFlow API → user-friendly reply
 */
async function analyzeWithCodeContext(report: ReportDetail, codeContext: string): Promise<DiagnosisResult> {
  // Step 1: Full technical analysis with code context
  console.log(`  [Step 1/2] Analyzing with code context (${Math.round(codeContext.length / 1024)}KB) ...`);
  const analysisPrompt = buildAnalysisPrompt(report, codeContext);
  console.log(`  [Step 1/2] Prompt size: ${Math.round(analysisPrompt.length / 1024)}KB`);
  const technicalAnalysis = await callLLM(analysisPrompt, 2048);
  console.log(`  [Step 1/2] Technical analysis: ${technicalAnalysis.length} chars`);

  // Step 2: Convert to user-friendly reply (no code context needed)
  console.log(`  [Step 2/2] Generating user reply ...`);
  let userReply = await callLLM(buildUserReplyPrompt(report, technicalAnalysis));
  console.log(`  [Step 2/2] User reply: ${userReply.length} chars`);

  // Append AI disclaimer
  userReply = userReply.trimEnd() + "\n\n---\n*此回复由 AI 自动生成，结果仅供参考。如未能解决您的问题，请联系人工客服获取进一步帮助。*";

  return { technicalAnalysis, userReply };
}

// ── Issue archival ───────────────────────────────────────────────────────────

/**
 * Save a structured issue file to ISSUES_DIR.
 * Downstream processes read this directory to do code review and fixes.
 */
async function archiveIssue(
  report: ReportDetail,
  analysis: string,
): Promise<string> {
  await mkdir(ISSUES_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}_${report.ticketCode}.md`;
  const filepath = join(ISSUES_DIR, filename);

  const isCodeBug =
    /bug|缺陷|代码.*修改|修复.*代码|需要.*改/i.test(analysis);

  const content = `# Issue ${report.ticketCode}

## 基本信息
- **工单码**: ${report.ticketCode}
- **提交时间**: ${report.createdAt}
- **平台**: ${report.context.platform || "unknown"}
- **版本**: ${report.context.version || "unknown"}
- **设备**: ${report.context.hostname || "unknown"}
- **分类**: ${isCodeBug ? "代码缺陷" : "配置/环境问题"}
- **状态**: 待审查

## 用户描述
${report.description}

## 关键日志
\`\`\`
${report.logEntries
  .filter(
    (l) =>
      /"l":"(error|warn)"/i.test(l) ||
      /error|fail|crash|exception/i.test(l),
  )
  .slice(0, 20)
  .join("\n")}
\`\`\`

## AI 诊断分析
${analysis}

## 下游待办
- [ ] 代码审查：确认分析中提到的代码位置是否准确
- [ ] 修复验证：如果是 bug，提交修复并验证
- [ ] 回归测试：确保修复不引入新问题

---
*Generated by ops-diagnose-agent at ${new Date().toISOString()}*
`;

  await writeFile(filepath, content, "utf-8");
  return filepath;
}

// ── Process a single ticket ──────────────────────────────────────────────────

async function processTicket(code: string, codeContext: string): Promise<void> {
  console.log(`\n── Processing ticket: ${code} ──`);

  const report = await fetchReport(code);

  if (report.reply) {
    console.log(`  Already replied. Skipping.`);
    return;
  }

  console.log(`  ${report.description.slice(0, 80)}`);
  console.log(`  ${report.logEntries.length} log entries | ${report.context.platform} | v${report.context.version}`);

  // 1. Two-step analysis: code context + technical diagnosis + user-friendly reply
  const { technicalAnalysis, userReply } = await analyzeWithCodeContext(report, codeContext);

  // 2. Archive full technical analysis for downstream code review
  const issuePath = await archiveIssue(report, technicalAnalysis);
  console.log(`  Issue archived: ${issuePath}`);

  // 3. Send user-friendly reply back (unless dry-run)
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Not uploading reply. Review: ${issuePath}`);
    console.log(`  --- User reply preview ---`);
    console.log(userReply);
    console.log(`  --- End preview ---`);
  } else {
    await apiPost("/admin/reply", { ticketCode: code, content: userReply });
    console.log(`  Reply sent to user.`);
  }
}

// ── Auto mode ────────────────────────────────────────────────────────────────

async function autoProcessAll(): Promise<void> {
  const data = await apiGet<{
    success: boolean;
    reports: ReportSummary[];
    total: number;
  }>("/admin/list?status=pending&limit=10");

  if (!data.success || !data.reports?.length) {
    console.log("No pending reports.");
    return;
  }

  console.log(`${data.reports.length} pending reports. Processing...\n`);

  // Build code context once, reuse for all tickets
  const codeContext = await ensureRepomixContext(FORCE_REBUILD);

  for (const r of data.reports) {
    try {
      await processTicket(r.ticketCode, codeContext);
    } catch (err) {
      console.error(`  ERROR [${r.ticketCode}]: ${err}`);
    }
    // Small delay between tickets to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\nDone.");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (mode === "help") {
    console.log(`
ClawdbotCN Ops Diagnostics Agent (Repomix + SiliconFlow GLM-5)

Usage:
  npx tsx scripts/ops-diagnose-agent.ts --list                List pending reports
  npx tsx scripts/ops-diagnose-agent.ts --ticket CODE         Process one ticket
  npx tsx scripts/ops-diagnose-agent.ts --auto                Auto-process all pending
  npx tsx scripts/ops-diagnose-agent.ts --auto --dry-run      Analyze only, don't reply
  npx tsx scripts/ops-diagnose-agent.ts --rebuild-context      Force rebuild Repomix cache

Environment:
  OPS_API_TOKEN       Admin API token (required)
  SILICONFLOW_KEY     SiliconFlow API key (required)
  PROJECT_CWD         Project workspace for Repomix (default: D:\\bugsfind\\openclawcn)
  ISSUES_DIR          Issue archive dir (default: D:\\bugsfind\\issues)
  REPORT_API_BASE     Override API base URL
  REPOMIX_MAX_TOKENS  Max tokens for code context (default: 100000)
`);
    return;
  }

  if (!OPS_TOKEN) {
    console.error("Error: OPS_API_TOKEN is required.");
    process.exit(1);
  }
  if (mode !== "list" && !SILICONFLOW_KEY) {
    console.error("Error: SILICONFLOW_KEY is required for analysis.");
    process.exit(1);
  }

  console.log(`Project: ${PROJECT_CWD}`);
  console.log(`Model: ${SILICONFLOW_MODEL} (SiliconFlow direct API)`);
  console.log(`Issues: ${ISSUES_DIR}`);
  console.log(`Code context: Repomix → ${REPOMIX_OUTPUT}`);

  switch (mode) {
    case "list":
      await listReports();
      break;
    case "rebuild": {
      console.log("Rebuilding Repomix code context...");
      const ctx = await ensureRepomixContext(true);
      console.log(`Done. Context size: ${Math.round(ctx.length / 1024)}KB`);
      break;
    }
    case "ticket": {
      if (!ticketArg) {
        console.error("Error: --ticket requires a ticket code.");
        process.exit(1);
      }
      const codeContext = await ensureRepomixContext(FORCE_REBUILD);
      await processTicket(ticketArg, codeContext);
      break;
    }
    case "auto":
      await autoProcessAll();
      break;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
