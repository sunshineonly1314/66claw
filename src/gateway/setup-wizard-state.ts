/**
 * Setup Wizard - State Management
 * 配置向导的状态管理逻辑（包含渠道启动回调）
 */

import { detectChinaRegion } from "../config/region-cn.js";
import { loadConfig, writeConfigFile } from "../config/config.js";
import type { SetupWizardState, ChannelStartCallback } from "./setup-wizard-types.js";

// ============================================================================
// 渠道启动回调（用于配置保存后立即启动渠道）
// ============================================================================

let channelStartCallback: ChannelStartCallback | null = null;

/**
 * 设置渠道启动回调
 * 由 Gateway 初始化时调用，传入 startChannel 函数
 */
export function setChannelStartCallback(callback: ChannelStartCallback): void {
  channelStartCallback = callback;
}

/**
 * 获取当前的渠道启动回调
 */
export function getChannelStartCallback(): ChannelStartCallback | null {
  return channelStartCallback;
}

// ============================================================================
// Setup Wizard State Management
// ============================================================================

let setupWizardState: SetupWizardState = {
  step: 1,
  completed: false,
  region: detectChinaRegion() ? "cn" : "global",
};

export function getSetupState(): SetupWizardState {
  // 检查是否已完成配置
  const config = loadConfig();
  const hasApiKey = Boolean(config.auth?.profiles && Object.keys(config.auth.profiles).length > 0);
  const hasWorkspace = Boolean(config.agents?.defaults?.workspace);
  const hasLicense = Boolean(config.license?.key);
  const setupCompleted = Boolean(config.setup?.completedAt);

  // 只有在满足以下条件之一时才标记为已完成：
  // 1. 有 license（激活成功）
  // 2. 配置文件中有 setup.completedAt 标记（handleComplete 写入）
  if (hasApiKey && hasWorkspace && (hasLicense || setupCompleted)) {
    setupWizardState.completed = true;
  }

  // Resume from the last completed step so the user does not have to
  // start over after closing the browser mid-wizard.
  const savedStep = config.setup?.lastCompletedStep;
  if (
    typeof savedStep === "number" &&
    savedStep >= 0 &&
    !setupWizardState.completed &&
    setupWizardState.step <= 1
  ) {
    setupWizardState.step = savedStep + 1;
  }

  return setupWizardState;
}

export function updateSetupState(updates: Partial<SetupWizardState>): SetupWizardState {
  setupWizardState = { ...setupWizardState, ...updates };

  // Persist the last completed step so the wizard can resume from this point
  // even if the user closes the browser.  Best-effort – failure here must not
  // break the wizard flow.
  if (typeof updates.step === "number" && updates.step > 1) {
    try {
      const current = loadConfig();
      const lastCompletedStep = updates.step - 1;
      if ((current.setup?.lastCompletedStep ?? -1) < lastCompletedStep) {
        void writeConfigFile({
          ...current,
          setup: { ...current.setup, lastCompletedStep },
        }).catch(() => {
          /* best-effort: wizard continues even if checkpoint fails */
        });
      }
    } catch {
      /* best-effort: config read failure is non-fatal here */
    }
  }

  return setupWizardState;
}
