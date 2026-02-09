/**
 * Skills Batch Pill — Floating minimized indicator
 * Shows download progress, completion, or failure in a compact pill at bottom-left.
 */

import { html, nothing, type TemplateResult } from "lit";
import type { SkillsBatchPhase, BatchProgress, SkillBatchItem, FailedSkillItem } from "../controllers/skills-batch.js";
import { formatSpeed } from "../controllers/skills-batch.js";

export type SkillsBatchPillProps = {
  phase: SkillsBatchPhase;
  progress: BatchProgress;
  skills: SkillBatchItem[];
  result: { succeeded: string[]; failed: FailedSkillItem[]; durationMs: number } | null;
  onExpand: () => void;
  onDismiss: () => void;
};

function renderDownloadingPill(props: SkillsBatchPillProps): TemplateResult {
  const { progress, skills } = props;
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const activeSkill = skills.find((s) => s.status === "downloading" || s.status === "verifying");
  const skillName = activeSkill?.name ?? "";
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return html`
    <div class="batch-pill" @click=${props.onExpand}
      style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px 8px 10px;
        background:#0e1017;border:1px solid rgba(0,229,255,0.2);border-radius:100px;
        cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 12px rgba(0,229,255,0.15);
        animation:batchPillIn 0.35s cubic-bezier(0.34,1.3,0.64,1);transition:transform 0.15s ease;user-select:none;">
      <svg width="28" height="28" viewBox="0 0 28 28" style="flex-shrink:0;transform:rotate(-90deg);">
        <circle cx="14" cy="14" r="${radius}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2.5"/>
        <circle cx="14" cy="14" r="${radius}" fill="none" stroke="#00e5ff" stroke-width="2.5"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          stroke-linecap="round" style="transition:stroke-dashoffset 0.3s ease;"/>
      </svg>
      <span style="font-size:14px;font-weight:700;color:#00e5ff;font-family:monospace;min-width:32px;">${pct}%</span>
      ${skillName ? html`<span style="font-size:12px;color:rgba(255,255,255,0.5);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${skillName}</span>` : nothing}
      ${progress.speedBps > 0 ? html`<span style="font-size:11px;color:rgba(0,230,118,0.7);font-family:monospace;">${formatSpeed(progress.speedBps)}</span>` : nothing}
    </div>
  `;
}

function renderCompletePill(props: SkillsBatchPillProps): TemplateResult {
  const count = props.result?.succeeded.length ?? 0;
  return html`
    <div class="batch-pill" @click=${props.onExpand}
      style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
        background:#0e1017;border:1px solid rgba(0,230,118,0.25);border-radius:100px;
        cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 12px rgba(0,230,118,0.15);
        animation:batchPillIn 0.35s cubic-bezier(0.34,1.3,0.64,1);transition:transform 0.15s ease;user-select:none;">
      <span style="width:20px;height:20px;border-radius:50%;background:rgba(0,230,118,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#00e676;">\u2713</span>
      <span style="font-size:13px;font-weight:600;color:#00e676;">${count} \u4E2A\u6280\u80FD\u914D\u7F6E\u5B8C\u6210</span>
    </div>
  `;
}

function renderResultPill(props: SkillsBatchPillProps): TemplateResult {
  const failedCount = props.result?.failed.length ?? 0;
  return html`
    <div class="batch-pill" @click=${props.onExpand}
      style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
        background:#0e1017;border:1px solid rgba(255,171,0,0.25);border-radius:100px;
        cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 12px rgba(255,171,0,0.12);
        animation:batchPillIn 0.35s cubic-bezier(0.34,1.3,0.64,1);transition:transform 0.15s ease;user-select:none;">
      <span style="width:20px;height:20px;border-radius:50%;background:rgba(255,171,0,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#ffab00;font-weight:700;">!</span>
      <span style="font-size:13px;font-weight:600;color:#ffab00;">${failedCount} \u9879\u5931\u8D25</span>
    </div>
  `;
}

export function renderSkillsBatchPill(props: SkillsBatchPillProps): TemplateResult {
  if (props.phase === "downloading") return renderDownloadingPill(props);
  if (props.phase === "complete") return renderCompletePill(props);
  if (props.phase === "result") return renderResultPill(props);
  return html`${nothing}`;
}
