/**
 * SkillsUpdate v3 类型定义
 */

// ============================================================================
// 分类与状态
// ============================================================================

/** 10 大类 ID */
export type CategoryId =
  | "dev"
  | "productivity"
  | "media"
  | "comm"
  | "ai"
  | "smarthome"
  | "security"
  | "data"
  | "content"
  | "system";

/** CN 三级可用性 */
export type CnStatus = "cn-native" | "cn-proxy" | "cn-blocked";

/** 分类定义 */
export interface CategoryDef {
  id: CategoryId;
  nameZh: string;
  nameEn: string;
  emoji: string;
}

// ============================================================================
// v3 索引
// ============================================================================

/** v3 丰富技能元数据 */
export interface EnrichedSkillMeta {
  name: string;
  nameZh?: string;
  description: string;
  descriptionZh?: string;
  emoji?: string;
  path: string;
  version?: string;
  author?: string;
  // --- v3 新增 ---
  category: CategoryId;
  categoryZh: string;
  tags: string[];
  cnStatus: CnStatus;
  cnBlocked: boolean;
  cnAlternative: string;
  tier: "S" | "A" | "B";
  overallScore: number;
  platforms: string[];
  requiresBins: string[];
  installMethods: string[];
  hasTranslation: boolean;
  highlights: string;
  weaknesses: string;
}

/** v3 索引完整结构 */
export interface SkillsIndexV3 {
  schemaVersion: 3;
  generatedAt: string;
  pipelineVersion: string;
  stats: {
    totalScanned: number;
    finalAccepted: number;
    tierDistribution: { S: number; A: number; B: number };
    categoryDistribution: Partial<Record<CategoryId, number>>;
    cnStatusDistribution: Record<CnStatus, number>;
  };
  categories: CategoryDef[];
  skills: EnrichedSkillMeta[];
}

// ============================================================================
// v2 输入（从 cn/skills-qc/output/skills-index.json 读取）
// ============================================================================

export interface WashIndexV2 {
  schemaVersion: number;
  generatedAt: string;
  pipelineVersion: string;
  stats: {
    totalScanned: number;
    finalAccepted: number;
    tierDistribution: { S: number; A: number; B: number };
  };
  skills: WashSkillEntry[];
}

export interface WashSkillEntry {
  name: string;
  description: string;
  descriptionZh: string;
  path: string;
  tier: "S" | "A" | "B";
  overallScore: number;
  category: string;
  tags: string[];
  cnBlocked: boolean;
  cnAlternative: string;
  hasTranslation: boolean;
}

// ============================================================================
// 审计报告（从 cn/skills-qc/output/report/*.json 读取）
// ============================================================================

export interface SkillReport {
  skillId: string;
  layer3?: {
    quality: {
      scores: {
        utility: number;
        completeness: number;
        technicalQuality: number;
        maintenance: number;
        cnCompatibility: number;
      };
      overallScore: number;
      tier: string;
      category: string;
      tags: string[];
      cnBlocked: boolean;
      cnAlternative: string;
      highlights: string;
      weaknesses: string;
      summary: string;
    };
    translation?: {
      translatedContent: string;
      validationPassed: boolean;
    };
  };
}

// ============================================================================
// SKILL.md metadata（从 frontmatter 提取）
// ============================================================================

export interface SkillMetadata {
  emoji?: string;
  os?: string[];
  requires?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
  };
  install?: {
    id: string;
    kind: string;
    formula?: string;
    package?: string;
    module?: string;
    bins?: string[];
    label?: string;
    os?: string[];
    url?: string;
  }[];
}

// ============================================================================
// 发布
// ============================================================================

export interface PublishResult {
  ok: boolean;
  published: number;
  failed: number;
  errors: string[];
}
