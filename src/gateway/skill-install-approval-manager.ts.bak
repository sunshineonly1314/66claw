import { randomUUID } from "node:crypto";

/**
 * 技能安装决策类型
 */
export type SkillInstallDecision = "install" | "install-continue" | "deny";

/**
 * 技能安装请求载荷
 */
export type SkillInstallRequestPayload = {
  skillName: string;
  skillDescription?: string | null;
  missing: {
    bins: string[];
    env: string[];
    config: string[];
  };
  installSteps?: string[] | null;
  estimatedTime?: string | null;
  originalMessage?: string | null;
  runId?: string | null;
  sessionKey?: string | null;
  agentId?: string | null;
};

/**
 * 技能安装记录
 */
export type SkillInstallRecord = {
  id: string;
  request: SkillInstallRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
  resolvedAtMs?: number;
  decision?: SkillInstallDecision;
  resolvedBy?: string | null;
  installStatus?: "pending" | "installing" | "success" | "failed";
  installError?: string | null;
  continueAfterInstall?: boolean;
};

type PendingEntry = {
  record: SkillInstallRecord;
  resolve: (decision: SkillInstallDecision | null) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type InstallProgressListener = (
  recordId: string,
  progress: {
    stage: "downloading" | "installing" | "verifying" | "complete" | "failed";
    message: string;
    percent?: number;
  },
) => void;

/**
 * 技能安装审批管理器
 * 
 * 管理技能安装请求的生命周期：
 * 1. 创建安装请求
 * 2. 等待用户决策
 * 3. 执行安装
 * 4. 安装完成后可选择继续执行原始指令
 */
export class SkillInstallApprovalManager {
  private pending = new Map<string, PendingEntry>();
  private progressListeners = new Set<InstallProgressListener>();

  /**
   * 创建技能安装请求记录
   */
  create(
    request: SkillInstallRequestPayload,
    timeoutMs: number,
    id?: string | null,
  ): SkillInstallRecord {
    const now = Date.now();
    const resolvedId = id && id.trim().length > 0 ? id.trim() : randomUUID();
    const record: SkillInstallRecord = {
      id: resolvedId,
      request,
      createdAtMs: now,
      expiresAtMs: now + timeoutMs,
      installStatus: "pending",
    };
    return record;
  }

  /**
   * 等待用户对安装请求的决策
   */
  async waitForDecision(
    record: SkillInstallRecord,
    timeoutMs: number,
  ): Promise<SkillInstallDecision | null> {
    return await new Promise<SkillInstallDecision | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(record.id);
        resolve(null);
      }, timeoutMs);
      this.pending.set(record.id, { record, resolve, reject, timer });
    });
  }

  /**
   * 解析用户决策
   */
  resolve(
    recordId: string,
    decision: SkillInstallDecision,
    resolvedBy?: string | null,
  ): boolean {
    const pending = this.pending.get(recordId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    pending.record.resolvedAtMs = Date.now();
    pending.record.decision = decision;
    pending.record.resolvedBy = resolvedBy ?? null;
    pending.record.continueAfterInstall = decision === "install-continue";
    
    // 从 pending 移除，但保留到 completed 用于状态追踪
    this.pending.delete(recordId);
    if (decision === "install" || decision === "install-continue") {
      pending.record.installStatus = "installing";
      this.moveToCompleted(pending.record);
    }
    
    pending.resolve(decision);
    return true;
  }

  /**
   * 获取请求快照
   */
  getSnapshot(recordId: string): SkillInstallRecord | null {
    const entry = this.pending.get(recordId);
    return entry?.record ?? null;
  }

  // 已完成安装的记录（用于状态追踪，自动过期清理）
  private completedInstalls = new Map<string, { record: SkillInstallRecord; completedAt: number }>();
  private readonly COMPLETED_RETENTION_MS = 5 * 60 * 1000; // 5分钟后自动清理

  /**
   * 更新安装状态
   * 注意：这个方法现在也会检查已完成的安装记录
   */
  updateInstallStatus(
    recordId: string,
    status: "installing" | "success" | "failed",
    error?: string | null,
  ): void {
    // 先检查 pending
    const pendingEntry = this.pending.get(recordId);
    if (pendingEntry) {
      pendingEntry.record.installStatus = status;
      if (error) {
        pendingEntry.record.installError = error;
      }
      return;
    }

    // 检查已完成的记录
    const completed = this.completedInstalls.get(recordId);
    if (completed) {
      completed.record.installStatus = status;
      if (error) {
        completed.record.installError = error;
      }
    }

    // 清理过期的已完成记录
    this.pruneCompletedInstalls();
  }

  /**
   * 将记录移动到已完成列表（resolve 后调用）
   */
  private moveToCompleted(record: SkillInstallRecord): void {
    this.completedInstalls.set(record.id, { record, completedAt: Date.now() });
    this.pruneCompletedInstalls();
  }

  /**
   * 清理过期的已完成记录
   */
  private pruneCompletedInstalls(): void {
    const now = Date.now();
    for (const [id, entry] of this.completedInstalls) {
      if (now - entry.completedAt > this.COMPLETED_RETENTION_MS) {
        this.completedInstalls.delete(id);
      }
    }
  }

  /**
   * 获取安装状态（包括已完成的）
   */
  getInstallStatus(recordId: string): SkillInstallRecord | null {
    const pending = this.pending.get(recordId);
    if (pending) return pending.record;
    const completed = this.completedInstalls.get(recordId);
    return completed?.record ?? null;
  }

  /**
   * 添加进度监听器
   */
  addProgressListener(listener: InstallProgressListener): void {
    this.progressListeners.add(listener);
  }

  /**
   * 移除进度监听器
   */
  removeProgressListener(listener: InstallProgressListener): void {
    this.progressListeners.delete(listener);
  }

  /**
   * 发送安装进度
   */
  emitProgress(
    recordId: string,
    progress: {
      stage: "downloading" | "installing" | "verifying" | "complete" | "failed";
      message: string;
      percent?: number;
    },
  ): void {
    for (const listener of this.progressListeners) {
      try {
        listener(recordId, progress);
      } catch {
        // 忽略监听器错误
      }
    }
  }

  /**
   * 获取所有待处理的安装请求
   */
  getPendingRequests(): SkillInstallRecord[] {
    return Array.from(this.pending.values()).map((entry) => entry.record);
  }

  /**
   * 取消待处理的请求
   */
  cancel(recordId: string): boolean {
    const pending = this.pending.get(recordId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(recordId);
    pending.resolve(null);
    return true;
  }

  /**
   * 检查指定技能是否正在等待审批或正在安装
   * 用于防止重复安装请求
   */
  isSkillPendingOrInstalling(skillName: string): boolean {
    // 检查待审批队列
    for (const entry of this.pending.values()) {
      if (entry.record.request.skillName === skillName) {
        return true;
      }
    }
    // 检查正在安装的
    for (const entry of this.completedInstalls.values()) {
      if (
        entry.record.request.skillName === skillName &&
        entry.record.installStatus === "installing"
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取指定技能的最近安装状态
   */
  getSkillInstallStatus(skillName: string): SkillInstallRecord | null {
    // 优先检查待审批
    for (const entry of this.pending.values()) {
      if (entry.record.request.skillName === skillName) {
        return entry.record;
      }
    }
    // 检查已完成（按时间倒序）
    let latest: { record: SkillInstallRecord; completedAt: number } | null = null;
    for (const entry of this.completedInstalls.values()) {
      if (entry.record.request.skillName === skillName) {
        if (!latest || entry.completedAt > latest.completedAt) {
          latest = entry;
        }
      }
    }
    return latest?.record ?? null;
  }

  /**
   * 清理所有资源（用于优雅关闭）
   */
  clearAll(): void {
    // 取消所有待处理的请求
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve(null);
    }
    this.pending.clear();
    this.completedInstalls.clear();
    this.progressListeners.clear();
  }

  /**
   * 获取统计信息（用于调试）
   */
  getStats(): {
    pendingCount: number;
    installingCount: number;
    completedCount: number;
    listenerCount: number;
  } {
    let installingCount = 0;
    for (const entry of this.completedInstalls.values()) {
      if (entry.record.installStatus === "installing") {
        installingCount++;
      }
    }
    return {
      pendingCount: this.pending.size,
      installingCount,
      completedCount: this.completedInstalls.size,
      listenerCount: this.progressListeners.size,
    };
  }
}
