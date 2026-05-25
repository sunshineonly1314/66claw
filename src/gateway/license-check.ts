import type { OpenClawCNConfig } from "../config/config.js";

export type LicenseClientState = {
  checking?: boolean;
  valid: boolean;
  offlineMode?: boolean;
  error?: string | null;
  errorCode?: string | null;
  license?: {
    tier?: string;
    tierName?: string;
    features?: string[];
    addons?: unknown[];
    upgradeAvailable?: unknown;
    [key: string]: unknown;
  } | null;
  device?: unknown;
  renewalReminder?: unknown;
  forceUpdate?: unknown;
  pendingNotifications?: unknown[];
  lastVerifiedAt?: number | null;
  deviceSwitchInfo?: unknown;
  deviceSwitchCooldown?: unknown;
};

export type StartupVerifyResult = {
  canProceed: boolean;
  valid: boolean;
  offlineMode: boolean;
  clientState: LicenseClientState;
};

const OPEN_SOURCE_LICENSE_STATE: LicenseClientState = {
  checking: false,
  valid: true,
  offlineMode: false,
  error: null,
  errorCode: null,
  license: {
    tier: "open-source",
    tierName: "Open Source",
    features: ["*"],
    addons: [],
    upgradeAvailable: null,
  },
  device: null,
  renewalReminder: null,
  forceUpdate: null,
  pendingNotifications: [],
  lastVerifiedAt: null,
  deviceSwitchInfo: null,
  deviceSwitchCooldown: null,
};

export function isLicenseCheckEnabled(_config: OpenClawCNConfig): boolean {
  return false;
}

export async function checkLicenseOnGatewayStart(
  _config: OpenClawCNConfig,
  _options?: { skipIntegrity?: boolean },
): Promise<StartupVerifyResult | null> {
  return null;
}

export function getGatewayLicenseState(): LicenseClientState {
  return OPEN_SOURCE_LICENSE_STATE;
}

export function updateGatewayLicenseState(_state: LicenseClientState): void {
  // Open-source builds do not maintain a license state machine.
}

export function isLicenseValid(): boolean {
  return true;
}

export function getLicenseFeatures(): string[] {
  return ["*"];
}

export function hasLicenseFeature(_feature: string): boolean {
  return true;
}
