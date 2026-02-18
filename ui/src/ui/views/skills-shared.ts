import { html, nothing } from "lit";
import type { SkillStatusEntry } from "../types.ts";
import { t } from "../i18n/index.js";

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];
}

export function computeSkillReasons(skill: SkillStatusEntry): string[] {
  const reasons: string[] = [];
  if (skill.disabled) {
    reasons.push(t("agents.skillDisabled"));
  }
  if (skill.blockedByAllowlist) {
    reasons.push(t("agents.skillBlockedByAllowlist"));
  }
  return reasons;
}

export function renderSkillStatusChips(params: {
  skill: SkillStatusEntry;
  showBundledBadge?: boolean;
}) {
  const skill = params.skill;
  const showBundledBadge = Boolean(params.showBundledBadge);
  return html`
    <div class="chip-row" style="margin-top: 6px;">
      <span class="chip">${skill.source}</span>
      ${
        showBundledBadge
          ? html`
              <span class="chip">${t("agents.skillBundled")}</span>
            `
          : nothing
      }
      <span class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}">
        ${skill.eligible ? t("agents.skillEligible") : t("agents.skillBlocked")}
      </span>
      ${
        skill.disabled
          ? html`
              <span class="chip chip-warn">${t("agents.skillDisabled")}</span>
            `
          : nothing
      }
    </div>
  `;
}
