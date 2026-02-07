import { installSkill } from "../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { ClawdbotConfig } from "../config/config.js";
import { shouldUseCNMirror } from "../config/cn-mirrors.js";
import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { detectBinary, resolveNodeManagerOptions } from "./onboard-helpers.js";

function summarizeInstallFailure(message: string): string | undefined {
  const cleaned = message.replace(/^Install failed(?:\s*\([^)]*\))?\s*:?\s*/i, "").trim();
  if (!cleaned) return undefined;
  const maxLen = 140;
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function formatSkillHint(skill: {
  description?: string;
  install: Array<{ label: string }>;
}): string {
  const desc = skill.description?.trim();
  const installLabel = skill.install[0]?.label?.trim();
  const combined = desc && installLabel ? `${desc} — ${installLabel}` : desc || installLabel;
  if (!combined) return "install";
  const maxLen = 90;
  return combined.length > maxLen ? `${combined.slice(0, maxLen - 1)}…` : combined;
}

function upsertSkillEntry(
  cfg: ClawdbotConfig,
  skillKey: string,
  patch: { apiKey?: string },
): ClawdbotConfig {
  const entries = { ...cfg.skills?.entries };
  const existing = (entries[skillKey] as { apiKey?: string } | undefined) ?? {};
  entries[skillKey] = { ...existing, ...patch };
  return {
    ...cfg,
    skills: {
      ...cfg.skills,
      entries,
    },
  };
}

export async function setupSkills(
  cfg: ClawdbotConfig,
  workspaceDir: string,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<ClawdbotConfig> {
  const report = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
  const eligible = report.skills.filter((s) => s.eligible);
  const missing = report.skills.filter((s) => !s.eligible && !s.disabled && !s.blockedByAllowlist);
  const blocked = report.skills.filter((s) => s.blockedByAllowlist);

  const needsBrewPrompt =
    process.platform !== "win32" &&
    report.skills.some((skill) => skill.install.some((option) => option.kind === "brew")) &&
    !(await detectBinary("brew"));

  await prompter.note(
    [
      t("skills.eligible", { count: String(eligible.length) }),
      t("skills.missingRequirements", { count: String(missing.length) }),
      t("skills.blockedByAllowlist", { count: String(blocked.length) }),
    ].join("\n"),
    t("skills.status"),
  );

  const shouldConfigure = await prompter.confirm({
    message: t("skills.configureNow"),
    initialValue: true,
  });
  if (!shouldConfigure) return cfg;

  if (needsBrewPrompt) {
    await prompter.note(
      t("skills.homebrewNotice"),
      t("skills.homebrewRecommended"),
    );
    const showBrewInstall = await prompter.confirm({
      message: t("skills.showBrewInstall"),
      initialValue: true,
    });
    if (showBrewInstall) {
      // 中国区使用清华镜像安装 Homebrew
      const useCN = shouldUseCNMirror();
      const brewInstallCmd = useCN
        ? '/bin/bash -c "$(curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install/HEAD/install.sh)"'
        : '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
      await prompter.note(
        [
          t("skills.runCommand"),
          brewInstallCmd,
          useCN ? "\n# 或使用中科大镜像：" : "",
          useCN ? '/bin/bash -c "$(curl -fsSL https://mirrors.ustc.edu.cn/misc/brew-install.sh)"' : "",
        ].filter(Boolean).join("\n"),
        t("skills.homebrewInstall"),
      );
    }
  }

  const nodeManager = (await prompter.select({
    message: t("skills.nodeManager"),
    options: resolveNodeManagerOptions(),
  })) as "npm" | "pnpm" | "bun";

  let next: ClawdbotConfig = {
    ...cfg,
    skills: {
      ...cfg.skills,
      install: {
        ...cfg.skills?.install,
        nodeManager,
      },
    },
  };

  const installable = missing.filter(
    (skill) => skill.install.length > 0 && skill.missing.bins.length > 0,
  );
  if (installable.length > 0) {
    const toInstall = await prompter.multiselect({
      message: t("skills.installMissing"),
      options: [
        {
          value: "__skip__",
          label: t("skills.skipInstall"),
          hint: t("skills.continueWithout"),
        },
        ...installable.map((skill) => ({
          value: skill.name,
          label: `${skill.emoji ?? "🧩"} ${skill.name}`,
          hint: formatSkillHint(skill),
        })),
      ],
    });

    const selected = (toInstall as string[]).filter((name) => name !== "__skip__");
    for (const name of selected) {
      const target = installable.find((s) => s.name === name);
      if (!target || target.install.length === 0) continue;
      const installId = target.install[0]?.id;
      if (!installId) continue;
      const spin = prompter.progress(t("skills.installing", { name }));
      const result = await installSkill({
        workspaceDir,
        skillName: target.name,
        installId,
        config: next,
      });
      if (result.ok) {
        spin.stop(t("skills.installed", { name }));
      } else {
        const code = result.code == null ? "" : ` (exit ${result.code})`;
        const detail = summarizeInstallFailure(result.message);
        spin.stop(t("skills.installFailed", { name, code, detail: detail ? ` — ${detail}` : "" }));
        if (result.stderr) runtime.log(result.stderr.trim());
        else if (result.stdout) runtime.log(result.stdout.trim());
        runtime.log(
          t("skills.tipDoctor", { command: formatCliCommand("clawdbot doctor") }),
        );
        runtime.log("Docs: https://docs.clawd.bot/skills");
      }
    }
  }

  for (const skill of missing) {
    if (!skill.primaryEnv || skill.missing.env.length === 0) continue;
    const wantsKey = await prompter.confirm({
      message: t("skills.setApiKey", { env: skill.primaryEnv, skill: skill.name }),
      initialValue: false,
    });
    if (!wantsKey) continue;
    const apiKey = String(
      await prompter.text({
        message: t("skills.enterApiKey", { env: skill.primaryEnv }),
        validate: (value) => (value?.trim() ? undefined : t("common.required")),
      }),
    );
    next = upsertSkillEntry(next, skill.skillKey, { apiKey: apiKey.trim() });
  }

  return next;
}
