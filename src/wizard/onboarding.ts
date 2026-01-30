import { ensureAuthProfileStore } from "../agents/auth-profiles.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import {
  applyAuthChoice,
  resolvePreferredProviderForAuthChoice,
  warnIfModelConfigLooksOff,
} from "../commands/auth-choice.js";
import { promptAuthChoiceGrouped } from "../commands/auth-choice-prompt.js";
import { applyPrimaryModel, promptDefaultModel } from "../commands/model-picker.js";
import { setupChannels } from "../commands/onboard-channels.js";
import {
  applyWizardMetadata,
  DEFAULT_WORKSPACE,
  ensureWorkspaceAndSessions,
  handleReset,
  printWizardHeader,
  probeGatewayReachable,
  summarizeExistingConfig,
} from "../commands/onboard-helpers.js";
import { promptRemoteGatewayConfig } from "../commands/onboard-remote.js";
import { setupSkills } from "../commands/onboard-skills.js";
import { setupInternalHooks } from "../commands/onboard-hooks.js";
import type {
  GatewayAuthChoice,
  OnboardMode,
  OnboardOptions,
  ResetScope,
} from "../commands/onboard-types.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { ClawdbotConfig } from "../config/config.js";
import {
  DEFAULT_GATEWAY_PORT,
  readConfigFileSnapshot,
  resolveGatewayPort,
  writeConfigFile,
} from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { finalizeOnboardingWizard } from "./onboarding.finalize.js";
import { configureGatewayForOnboarding } from "./onboarding.gateway-config.js";
import type { QuickstartGatewayDefaults, WizardFlow } from "./onboarding.types.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";

async function requireRiskAcknowledgement(params: {
  opts: OnboardOptions;
  prompter: WizardPrompter;
}) {
  if (params.opts.acceptRisk === true) return;

  await params.prompter.note(
    [
      t("security.warning"),
      "",
      t("security.betaNotice"),
      t("security.toolWarning"),
      t("security.promptWarning"),
      "",
      t("security.inexperienceWarning"),
      t("security.helpAdvice"),
      "",
      t("security.baselineTitle"),
      `- ${t("security.baseline1")}`,
      `- ${t("security.baseline2")}`,
      `- ${t("security.baseline3")}`,
      `- ${t("security.baseline4")}`,
      "",
      t("security.runRegularly"),
      "clawdbot security audit --deep",
      "clawdbot security audit --fix",
      "",
      "Must read: https://docs.clawd.bot/gateway/security",
    ].join("\n"),
    t("security.title"),
  );

  const ok = await params.prompter.confirm({
    message: t("security.confirmRisk"),
    initialValue: false,
  });
  if (!ok) {
    throw new WizardCancelledError(t("security.riskNotAccepted"));
  }
}

export async function runOnboardingWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  printWizardHeader(runtime);
  await prompter.intro(t("onboard.intro"));
  await requireRiskAcknowledgement({ opts, prompter });

  const snapshot = await readConfigFileSnapshot();
  let baseConfig: ClawdbotConfig = snapshot.valid ? snapshot.config : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(summarizeExistingConfig(baseConfig), t("config.invalidConfig"));
    if (snapshot.issues.length > 0) {
      await prompter.note(
        [
          ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
          "",
          "Docs: https://docs.clawd.bot/gateway/configuration",
        ].join("\n"),
        t("config.configIssues"),
      );
    }
    await prompter.outro(
      t("config.invalidRunDoctor", { command: formatCliCommand("clawdbot doctor") }),
    );
    runtime.exit(1);
    return;
  }

  const quickstartHint = t("mode.quickstartHint", { command: formatCliCommand("clawdbot configure") });
  const manualHint = t("mode.manualHint");
  const explicitFlowRaw = opts.flow?.trim();
  const normalizedExplicitFlow = explicitFlowRaw === "manual" ? "advanced" : explicitFlowRaw;
  if (
    normalizedExplicitFlow &&
    normalizedExplicitFlow !== "quickstart" &&
    normalizedExplicitFlow !== "advanced"
  ) {
    runtime.error(t("error.invalidFlow"));
    runtime.exit(1);
    return;
  }
  const explicitFlow: WizardFlow | undefined =
    normalizedExplicitFlow === "quickstart" || normalizedExplicitFlow === "advanced"
      ? normalizedExplicitFlow
      : undefined;
  let flow: WizardFlow =
    explicitFlow ??
    ((await prompter.select({
      message: t("mode.onboardingMode"),
      options: [
        { value: "quickstart", label: t("mode.quickstart"), hint: quickstartHint },
        { value: "advanced", label: t("mode.manual"), hint: manualHint },
      ],
      initialValue: "quickstart",
    })) as "quickstart" | "advanced");

  if (opts.mode === "remote" && flow === "quickstart") {
    await prompter.note(
      t("mode.quickstartRemoteSwitch"),
      t("quickstart.title"),
    );
    flow = "advanced";
  }

  if (snapshot.exists) {
    await prompter.note(summarizeExistingConfig(baseConfig), t("config.existingDetected"));

    const action = (await prompter.select({
      message: t("config.configHandling"),
      options: [
        { value: "keep", label: t("config.useExisting") },
        { value: "modify", label: t("config.updateValues") },
        { value: "reset", label: t("common.reset") },
      ],
    })) as "keep" | "modify" | "reset";

    if (action === "reset") {
      const workspaceDefault = baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
      const resetScope = (await prompter.select({
        message: t("config.resetScope"),
        options: [
          { value: "config", label: t("config.configOnly") },
          {
            value: "config+creds+sessions",
            label: t("config.configCredsSession"),
          },
          {
            value: "full",
            label: t("config.fullReset"),
          },
        ],
      })) as ResetScope;
      await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
      baseConfig = {};
    }
  }

  const quickstartGateway: QuickstartGatewayDefaults = (() => {
    const hasExisting =
      typeof baseConfig.gateway?.port === "number" ||
      baseConfig.gateway?.bind !== undefined ||
      baseConfig.gateway?.auth?.mode !== undefined ||
      baseConfig.gateway?.auth?.token !== undefined ||
      baseConfig.gateway?.auth?.password !== undefined ||
      baseConfig.gateway?.customBindHost !== undefined ||
      baseConfig.gateway?.tailscale?.mode !== undefined;

    const bindRaw = baseConfig.gateway?.bind;
    const bind =
      bindRaw === "loopback" ||
      bindRaw === "lan" ||
      bindRaw === "auto" ||
      bindRaw === "custom" ||
      bindRaw === "tailnet"
        ? bindRaw
        : "loopback";

    let authMode: GatewayAuthChoice = "token";
    if (
      baseConfig.gateway?.auth?.mode === "token" ||
      baseConfig.gateway?.auth?.mode === "password"
    ) {
      authMode = baseConfig.gateway.auth.mode;
    } else if (baseConfig.gateway?.auth?.token) {
      authMode = "token";
    } else if (baseConfig.gateway?.auth?.password) {
      authMode = "password";
    }

    const tailscaleRaw = baseConfig.gateway?.tailscale?.mode;
    const tailscaleMode =
      tailscaleRaw === "off" || tailscaleRaw === "serve" || tailscaleRaw === "funnel"
        ? tailscaleRaw
        : "off";

    return {
      hasExisting,
      port: resolveGatewayPort(baseConfig),
      bind,
      authMode,
      tailscaleMode,
      token: baseConfig.gateway?.auth?.token,
      password: baseConfig.gateway?.auth?.password,
      customBindHost: baseConfig.gateway?.customBindHost,
      tailscaleResetOnExit: baseConfig.gateway?.tailscale?.resetOnExit ?? false,
    };
  })();

  if (flow === "quickstart") {
    const formatBind = (value: "loopback" | "lan" | "auto" | "custom" | "tailnet") => {
      if (value === "loopback") return t("quickstart.bindLoopback");
      if (value === "lan") return t("quickstart.bindLan");
      if (value === "custom") return t("quickstart.bindCustom");
      if (value === "tailnet") return t("quickstart.bindTailnet");
      return t("quickstart.bindAuto");
    };
    const formatAuth = (value: GatewayAuthChoice) => {
      if (value === "token") return t("quickstart.authToken");
      return t("quickstart.authPassword");
    };
    const formatTailscale = (value: "off" | "serve" | "funnel") => {
      if (value === "off") return t("quickstart.tailscaleOff");
      if (value === "serve") return t("quickstart.tailscaleServe");
      return t("quickstart.tailscaleFunnel");
    };
    const quickstartLines = quickstartGateway.hasExisting
      ? [
          t("quickstart.keepingSettings"),
          t("quickstart.gatewayPort", { port: String(quickstartGateway.port) }),
          t("quickstart.gatewayBind", { bind: formatBind(quickstartGateway.bind) }),
          ...(quickstartGateway.bind === "custom" && quickstartGateway.customBindHost
            ? [t("quickstart.gatewayCustomIP", { ip: quickstartGateway.customBindHost })]
            : []),
          t("quickstart.gatewayAuth", { auth: formatAuth(quickstartGateway.authMode) }),
          t("quickstart.tailscaleExposure", { mode: formatTailscale(quickstartGateway.tailscaleMode) }),
          t("quickstart.directToChannels"),
        ]
      : [
          t("quickstart.gatewayPort", { port: String(DEFAULT_GATEWAY_PORT) }),
          t("quickstart.gatewayBind", { bind: t("quickstart.bindLoopback") }),
          t("quickstart.gatewayAuth", { auth: t("quickstart.authToken") }),
          t("quickstart.tailscaleExposure", { mode: t("quickstart.tailscaleOff") }),
          t("quickstart.directToChannels"),
        ];
    await prompter.note(quickstartLines.join("\n"), t("quickstart.title"));
  }

  const localPort = resolveGatewayPort(baseConfig);
  const localUrl = `ws://127.0.0.1:${localPort}`;
  const localProbe = await probeGatewayReachable({
    url: localUrl,
    token: baseConfig.gateway?.auth?.token ?? process.env.CLAWDBOT_GATEWAY_TOKEN,
    password: baseConfig.gateway?.auth?.password ?? process.env.CLAWDBOT_GATEWAY_PASSWORD,
  });
  const remoteUrl = baseConfig.gateway?.remote?.url?.trim() ?? "";
  const remoteProbe = remoteUrl
    ? await probeGatewayReachable({
        url: remoteUrl,
        token: baseConfig.gateway?.remote?.token,
      })
    : null;

  const mode =
    opts.mode ??
    (flow === "quickstart"
      ? "local"
      : ((await prompter.select({
          message: t("mode.whatToSetup"),
          options: [
            {
              value: "local",
              label: t("mode.localGateway"),
              hint: localProbe.ok
                ? t("mode.localGatewayReachable", { url: localUrl })
                : t("mode.localGatewayNotDetected", { url: localUrl }),
            },
            {
              value: "remote",
              label: t("mode.remoteGateway"),
              hint: !remoteUrl
                ? t("mode.remoteNotConfigured")
                : remoteProbe?.ok
                  ? t("mode.remoteReachable", { url: remoteUrl })
                  : t("mode.remoteUnreachable", { url: remoteUrl }),
            },
          ],
        })) as OnboardMode));

  if (mode === "remote") {
    let nextConfig = await promptRemoteGatewayConfig(baseConfig, prompter);
    nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
    await writeConfigFile(nextConfig);
    logConfigUpdated(runtime);
    await prompter.outro(t("mode.remoteConfigured"));
    return;
  }

  const workspaceInput =
    opts.workspace ??
    (flow === "quickstart"
      ? (baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE)
      : await prompter.text({
          message: t("workspace.directory"),
          initialValue: baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE,
        }));

  const workspaceDir = resolveUserPath(workspaceInput.trim() || DEFAULT_WORKSPACE);

  let nextConfig: ClawdbotConfig = {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
  };

  const authStore = ensureAuthProfileStore(undefined, {
    allowKeychainPrompt: false,
  });
  const authChoiceFromPrompt = opts.authChoice === undefined;
  const authChoice =
    opts.authChoice ??
    (await promptAuthChoiceGrouped({
      prompter,
      store: authStore,
      includeSkip: true,
    }));

  const authResult = await applyAuthChoice({
    authChoice,
    config: nextConfig,
    prompter,
    runtime,
    setDefaultModel: true,
    opts: {
      tokenProvider: opts.tokenProvider,
      token: opts.authChoice === "apiKey" && opts.token ? opts.token : undefined,
    },
  });
  nextConfig = authResult.config;

  if (authChoiceFromPrompt) {
    const modelSelection = await promptDefaultModel({
      config: nextConfig,
      prompter,
      allowKeep: true,
      ignoreAllowlist: true,
      preferredProvider: resolvePreferredProviderForAuthChoice(authChoice),
    });
    if (modelSelection.model) {
      nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
    }
  }

  await warnIfModelConfigLooksOff(nextConfig, prompter);

  const gateway = await configureGatewayForOnboarding({
    flow,
    baseConfig,
    nextConfig,
    localPort,
    quickstartGateway,
    prompter,
    runtime,
  });
  nextConfig = gateway.nextConfig;
  const settings = gateway.settings;

  if (opts.skipChannels ?? opts.skipProviders) {
    await prompter.note(t("channels.skippingSetup"), t("channels.title"));
  } else {
    const quickstartAllowFromChannels =
      flow === "quickstart"
        ? listChannelPlugins()
            .filter((plugin) => plugin.meta.quickstartAllowFrom)
            .map((plugin) => plugin.id)
        : [];
    nextConfig = await setupChannels(nextConfig, runtime, prompter, {
      allowSignalInstall: true,
      forceAllowFromChannels: quickstartAllowFromChannels,
      skipDmPolicyPrompt: flow === "quickstart",
      skipConfirm: flow === "quickstart",
      quickstartDefaults: flow === "quickstart",
    });
  }

  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);
  await ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
  });

  if (opts.skipSkills) {
    await prompter.note(t("skills.skippingSetup"), t("skills.title"));
  } else {
    nextConfig = await setupSkills(nextConfig, workspaceDir, runtime, prompter);
  }

  // Setup hooks (session memory on /new)
  nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);

  nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
  await writeConfigFile(nextConfig);

  await finalizeOnboardingWizard({
    flow,
    opts,
    baseConfig,
    nextConfig,
    workspaceDir,
    settings,
    prompter,
    runtime,
  });
}
