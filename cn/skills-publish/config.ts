/**
 * SkillsUpdate 配置
 */

/** 路径配置 */
export const SKILLSUPDATE_CONFIG = {
  /** SkillWash 输出目录 */
  washOutputDir: "./cn/skills-qc/output",
  /** SkillWash v2 索引文件 */
  washIndexFile: "./cn/skills-qc/output/skills-index.json",
  /** SkillWash 单技能审计报告目录 */
  washReportDir: "./cn/skills-qc/output/report",
  /** 技能源文件目录 */
  skillsDir: "./skills",
  /** v3 输出目录 */
  outputDir: "./cn/skills-publish/output",
  /** Pipeline 版本号 */
  pipelineVersion: "3.0.0",
};

/** ClawdSkillsProxy 配置 */
export const PROXY_CONFIG = {
  baseUrl:
    process.env.CLAWDBOT_SKILLS_PROXY_URL?.trim() ||
    "http://121.43.61.90/api",
  token:
    process.env.CLAWDBOT_SKILLS_PROXY_TOKEN?.trim() ||
    "clawdskills_secret_token_2024",
  timeoutMs: 30_000,
};
