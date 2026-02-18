/**
 * 发布器
 *
 * 将 v3 索引和技能文件推送到 ClawdSkillsProxy。
 * 当前 Proxy 无 publish 端点，先实现本地输出 + 打包模式。
 * Proxy API 就绪后切换为 HTTP POST。
 */

import fs from "node:fs";
import path from "node:path";
import { PROXY_CONFIG, SKILLSUPDATE_CONFIG } from "./config.js";
import type { SkillsIndexV3, PublishResult } from "./types.js";

// ============================================================================
// 本地发布（生成可部署文件包）
// ============================================================================

/**
 * 本地发布：将 v3 索引 + 技能文件输出到 publishDir
 *
 * 输出结构:
 *   cn/skills-publish/output/publish/
 *   ├── skills-index-v3.json   (索引)
 *   ├── skills-en/             (英文 SKILL.md)
 *   │   ├── github/SKILL.md
 *   │   └── ...
 *   └── skills-zh/             (中文 SKILL.md)
 *       ├── github/SKILL.md
 *       └── ...
 */
export function publishLocal(index: SkillsIndexV3): PublishResult {
  const publishDir = path.resolve(SKILLSUPDATE_CONFIG.outputDir, "publish");
  const skillsEnDir = path.join(publishDir, "skills-en");
  const skillsZhDir = path.join(publishDir, "skills-zh");

  fs.mkdirSync(publishDir, { recursive: true });
  fs.mkdirSync(skillsEnDir, { recursive: true });
  fs.mkdirSync(skillsZhDir, { recursive: true });

  // 1. 写索引
  fs.writeFileSync(
    path.join(publishDir, "skills-index-v3.json"),
    JSON.stringify(index, null, 2),
    "utf-8",
  );

  // 2. 复制技能文件
  let published = 0;
  let failed = 0;
  const errors: string[] = [];

  const washEnDir = path.resolve(SKILLSUPDATE_CONFIG.washOutputDir, "skills-en");
  const washZhDir = path.resolve(SKILLSUPDATE_CONFIG.washOutputDir, "skills-zh");

  for (const skill of index.skills) {
    try {
      // 英文
      const enSrc = path.join(washEnDir, skill.name, "SKILL.md");
      if (fs.existsSync(enSrc)) {
        const enDst = path.join(skillsEnDir, skill.name);
        fs.mkdirSync(enDst, { recursive: true });
        fs.copyFileSync(enSrc, path.join(enDst, "SKILL.md"));
      }

      // 中文
      if (skill.hasTranslation) {
        const zhSrc = path.join(washZhDir, skill.name, "SKILL.md");
        if (fs.existsSync(zhSrc)) {
          const zhDst = path.join(skillsZhDir, skill.name);
          fs.mkdirSync(zhDst, { recursive: true });
          fs.copyFileSync(zhSrc, path.join(zhDst, "SKILL.md"));
        }
      }

      published++;
    } catch (err) {
      failed++;
      errors.push(`${skill.name}: ${(err as Error).message}`);
    }
  }

  console.log(`📦 本地发布完成: ${publishDir}`);
  console.log(`   索引: skills-index-v3.json`);
  console.log(`   技能: ${published} 个成功, ${failed} 个失败`);

  return { ok: failed === 0, published, failed, errors };
}

// ============================================================================
// 远程发布（推送到 ClawdSkillsProxy）
// ============================================================================

/**
 * 远程发布：推送 v3 索引到 ClawdSkillsProxy
 *
 * TODO: Proxy 端需新增 POST /api/skills/publish 端点
 */
export async function publishRemote(index: SkillsIndexV3): Promise<PublishResult> {
  const url = `${PROXY_CONFIG.baseUrl}/skills/publish`;

  console.log(`🚀 推送到 Proxy: ${url}`);
  console.log(`   Skills: ${index.skills.length} 个`);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_CONFIG.token}`,
      },
      body: JSON.stringify({
        index,
        timestamp: Date.now(),
      }),
      signal: AbortSignal.timeout(PROXY_CONFIG.timeoutMs),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return {
        ok: false,
        published: 0,
        failed: index.skills.length,
        errors: [`HTTP ${resp.status}: ${body}`],
      };
    }

    const result = (await resp.json()) as { published?: number };
    console.log(`✅ 推送成功: ${result.published ?? index.skills.length} 个`);

    return {
      ok: true,
      published: result.published ?? index.skills.length,
      failed: 0,
      errors: [],
    };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`❌ 推送失败: ${msg}`);

    // 回退到本地发布
    console.log(`↩ 回退到本地发布模式...`);
    return publishLocal(index);
  }
}
