/**
 * SkillWash 类型定义
 */

// ============================================================================
// 输入
// ============================================================================

export interface SkillInput {
  skillId: string;
  filePath: string;
  rawContent: string;
  frontmatter: {
    name: string;
    description: string;
    homepage?: string;
    metadata?: Record<string, unknown>;
  };
  body: string;
}

// ============================================================================
// Layer 1: 规则引擎结果
// ============================================================================

export interface PatternMatch {
  patternId: string;
  category: string;
  severity: "warning" | "danger" | "critical";
  description: string;
  matchedText: string;
  lineNumber: number;
  inCodeBlock: boolean;
}

export interface StructuralViolation {
  rule: string;
  severity: "error" | "warning";
  message: string;
}

export interface Layer1Result {
  skillId: string;
  passed: boolean;
  decision: "pass" | "reject" | "review";
  structural: StructuralViolation[];
  patternMatches: PatternMatch[];
  blacklistHits: string[];
  processingTimeMs: number;
}

// ============================================================================
// Layer 2: 安全审计结果
// ============================================================================

export interface SecurityIssue {
  category: string;
  severity: "info" | "warning" | "danger" | "critical";
  location: string;
  description: string;
  evidence: string;
  attackVector: string;
}

export interface Layer2Result {
  skillId: string;
  passed: boolean;
  decision: "pass" | "review" | "reject";
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  issues: SecurityIssue[];
  hiddenRisks: string;
  summary: string;
  confidence: number;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  processingTimeMs: number;
  rawResponse?: string;
}

// ============================================================================
// Layer 3: 质量评估 + 汉化结果
// ============================================================================

export interface QualityScores {
  utility: number;
  completeness: number;
  technicalQuality: number;
  maintenance: number;
  cnCompatibility: number;
}

export interface Layer3Result {
  skillId: string;
  quality: {
    scores: QualityScores;
    overallScore: number;
    tier: "S" | "A" | "B" | "C" | "D";
    category: string;
    tags: string[];
    cnBlocked: boolean;
    cnAlternative: string;
    highlights: string;
    weaknesses: string;
    summary: string;
    recommendation: string;
  };
  translation?: {
    translatedContent: string;
    validationPassed: boolean;
  };
  modelUsed: string;
  totalTokens: number;
  processingTimeMs: number;
}

// ============================================================================
// Pipeline 总结果
// ============================================================================

export interface PipelineResult {
  skillId: string;
  filePath: string;
  layer1: Layer1Result;
  layer2?: Layer2Result;
  layer3?: Layer3Result;
  finalDecision: "accepted" | "rejected" | "review" | "error";
  finalTier?: "S" | "A" | "B";
  rejectReason?: string;
  totalTimeMs: number;
}

// ============================================================================
// 断点续跑
// ============================================================================

export interface Checkpoint {
  pipelineId: string;
  startedAt: string;
  completedSkillIds: string[];
  results: PipelineResult[];
}

// ============================================================================
// 批量统计
// ============================================================================

export interface BatchStats {
  totalScanned: number;
  layer1Rejected: number;
  layer2Rejected: number;
  layer2Review: number;
  layer3Excluded: number;
  finalAccepted: number;
  tierDistribution: { S: number; A: number; B: number };
  categoryDistribution: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostCNY: number;
  totalProcessingMs: number;
  securityFindings: {
    promptInjection: number;
    dataExfil: number;
    commandInjection: number;
    obfuscation: number;
    cryptoMining: number;
    privilegeEscalation: number;
  };
}
