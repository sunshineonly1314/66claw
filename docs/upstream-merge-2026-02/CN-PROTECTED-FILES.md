# CN Protected Files — Do NOT Auto-Merge

These files contain CN-specific customizations that upstream changes could break.
When cherry-picking upstream commits that touch these files, always do manual 3-way review.

## Tier 1: CN-Core (NEVER auto-merge, always manual)

### Config System
| File | CN Customization |
|------|-----------------|
| `src/config/defaults.ts` | 20+ CN patches: Bing search, Firecrawl fetch, SiliconFlow, proactiveCompaction, agent limits, MCP servers |
| `src/config/region-cn.ts` | CN-only: region detection, security config |
| `src/config/region-cn.test.ts` | CN-only test |
| `src/config/zod-schema.agent-runtime.ts` | Added: "bing" search, "firecrawl" fetch, tools.write, tools.browser |
| `src/config/zod-schema.agent-defaults.ts` | Added: proactiveCompaction |
| `src/config/zod-schema.providers-cn.ts` | CN-only: CN provider Zod schemas |
| `src/config/defaults-cn.test.ts` | CN-only test |
| `src/config/provider-capability-mapping.ts` | CN-only: provider capability cards |
| `src/config/types.agent-defaults.ts` | CN type extensions |
| `src/config/types.agents.ts` | CN type extensions |

### Provider System
| File | CN Customization |
|------|-----------------|
| `src/agents/models-config.providers.ts` | buildKimiCodeProvider(), SiliconFlow providers, input[] stripping |
| `src/agents/siliconflow-models.ts` | SILICONFLOW_RECOMMENDED_MODELS, isVision heuristic (added "kimi") |
| `src/agents/model-compat.ts` | Kimi compat flags (supportsDeveloperRole: false) |
| `src/agents/failover-error.ts` | CN failover logic, Kimi error handling |
| `src/agents/model-fallback.ts` | CN model fallback chain |
| `src/agents/pi-embedded-runner/model.ts` | resolveModel() fallback: input inheritance from matchingModelDef |

### Gateway & Setup
| File | CN Customization |
|------|-----------------|
| `src/gateway/cn-handlers.ts` | CN-only: all CN gateway handlers |
| `src/gateway/setup-wizard.ts` | CN setup wizard flow |
| `src/gateway/setup-wizard-handlers.ts` | CN wizard HTTP handlers |
| `src/gateway/setup-wizard-state.ts` | CN wizard state management |
| `src/gateway/setup-page-components.ts` | CN setup page HTML |
| `src/gateway/server-methods-list.ts` | CN method registrations |
| `src/gateway/server-methods.ts` | CN method dispatch |

### Dispatch (entirely CN-only)
| File | CN Customization |
|------|-----------------|
| `src/dispatch/index.ts` | CN dispatch orchestrator |
| `src/dispatch/capability-registry.ts` | CN capability registry |
| `src/dispatch/capability-registry-remote.ts` | CN remote registry sync |
| `src/dispatch/modality-router.ts` | CN modality routing |
| `src/dispatch/tool-discovery.ts` | CN tool discovery |
| `src/dispatch/tool-filter.ts` | CN tool filtering |
| `src/dispatch/tool-index.ts` | CN tool indexing |
| `src/dispatch/provider-health.ts` | CN provider health monitoring |

## Tier 2: CN-Modified (manual review required)

### Agents
| File | CN Customization |
|------|-----------------|
| `src/agents/system-prompt.ts` | CN system prompt patches |
| `src/agents/tool-policy.ts` | CN tool policy additions |
| `src/agents/agent-scope.ts` | CN agent scope modifications |
| `src/agents/apply-patch.ts` | CN patch application |
| `src/agents/workspace.ts` | CN workspace config |
| `src/agents/workspace-dir.ts` | CN workspace directory logic |
| `src/agents/sandbox-paths.ts` | CN sandbox modifications |
| `src/agents/pi-embedded-runner/run.ts` | CN embedded runner patches |
| `src/agents/pi-embedded-runner/system-prompt.ts` | CN system prompt |
| `src/agents/pi-embedded-runner/google.ts` | CN Google provider patches |
| `src/agents/pi-embedded-helpers/errors.ts` | CN error handling |
| `src/agents/pi-embedded-helpers/types.ts` | CN type extensions |
| `src/agents/pi-embedded-subscribe.handlers.tools.ts` | CN tool handlers |
| `src/agents/cli-runner/helpers.ts` | CN CLI helpers |
| `src/agents/auth-profiles/types.ts` | CN auth type extensions |

### Infrastructure
| File | CN Customization |
|------|-----------------|
| `src/config/paths.ts` | CN installation paths (E:\openclawcn) |
| `src/config/io.ts` | CN config I/O |
| `src/config/agent-limits.ts` | CN agent limits |
| `src/infra/exec-approvals.ts` | CN exec approval modifications |
| `src/infra/exec-approvals-analysis.ts` | CN exec analysis |
| `src/infra/installer-updater.ts` | CN update system |
| `src/infra/home-dir.ts` | CN home directory |
| `src/infra/secure-storage.ts` | CN secure storage |
| `src/infra/state-migrations.ts` | CN state migrations |
| `src/infra/state-store/factory.ts` | CN state store |
| `src/infra/restart.ts` | CN restart logic |
| `src/infra/update-signature.ts` | CN update verification |
| `src/infra/update-startup.ts` | CN startup update check |

### Gateway Methods
| File | CN Customization |
|------|-----------------|
| `src/gateway/server.impl.ts` | CN server implementation |
| `src/gateway/server-http.ts` | CN HTTP server |
| `src/gateway/server-ready.ts` | CN ready check |
| `src/gateway/server-reload-handlers.ts` | CN reload handlers |
| `src/gateway/config-reload.ts` | CN config reload |
| `src/gateway/session-utils.fs.ts` | CN session utilities |
| `src/gateway/server-methods/chat.ts` | CN chat method |
| `src/gateway/server-methods/config.ts` | CN config method |
| `src/gateway/server-methods/diagnose.ts` | CN diagnose method |
| `src/gateway/server-methods/model-config.ts` | CN model config method |
| `src/gateway/server-methods/logs.ts` | CN logs method |

### Plugins
| File | CN Customization |
|------|-----------------|
| `src/plugins/runtime/index.ts` | CN plugin runtime patches |
| `src/plugins/runtime/types.ts` | CN plugin type extensions |
| `src/plugins/registry.ts` | CN plugin registry |
| `src/plugins/config-state.ts` | CN plugin config |

### UI
| File | CN Customization |
|------|-----------------|
| `ui/src/ui/views/chat.ts` | CN chat view customizations |
| `ui/src/ui/app-render.ts` | CN app render |
| `ui/src/ui/app.ts` | CN app setup |
| `ui/src/ui/app-chat.ts` | CN chat integration |
| `ui/src/ui/app-gateway.ts` | CN gateway UI |
| `ui/src/ui/app-view-state.ts` | CN view state |
| `ui/src/ui/app-render.helpers.ts` | CN render helpers |
| `ui/src/ui/controllers/chat.ts` | CN chat controller |
| `ui/src/ui/controllers/model-config.ts` | CN model config controller |
| `ui/src/ui/chat/error-hints.ts` | CN error hints |
| `ui/src/ui/chat/message-extract.ts` | CN message extraction |
| `ui/src/ui/i18n/locales/zh-CN.ts` | CN Chinese translations |
| `ui/src/ui/i18n/locales/en.ts` | CN English overrides |
| `ui/src/ui/icons.ts` | CN icon additions |
| `ui/src/ui/views/agents.ts` | CN agents view |
| `ui/src/ui/views/extensions-card.ts` | CN extensions card |
| `ui/src/ui/views/extensions-page.ts` | CN extensions page |
| `ui/src/ui/views/mcp-marketplace-card.ts` | CN MCP marketplace |
| `ui/src/ui/views/mcp-shared.ts` | CN MCP shared |
| `ui/src/ui/views/mcp-store-section.ts` | CN MCP store |
| `ui/src/ui/views/model-config.ts` | CN model config view |
| `ui/src/styles/*.css` | CN style modifications |
| `ui/vite.config.ts` | CN Vite config |

### Other
| File | CN Customization |
|------|-----------------|
| `src/auto-reply/dispatch.ts` | CN dispatch |
| `src/auto-reply/reply/*.ts` | CN auto-reply pipeline (7 files) |
| `src/logging/*.ts` | CN logging (4 files) |
| `src/mcp/marketplace/*.ts` | CN MCP marketplace (3 files) |
| `src/media-understanding/runner*.ts` | CN media understanding (2 files) |
| `src/security/software-protection-ab.test.ts` | CN security test |
| `src/license/rsa-verify.ts` | CN license verification |
| `src/slack/monitor/context.ts` | CN Slack monitor |
| `src/web/inbound/dedupe.ts` | CN web dedupe |
| `src/browser/trash.ts` | CN browser trash |
| `src/commands/setup.ts` | CN setup command |
| `src/commands/doctor-gateway-services.ts` | CN doctor command |
| `src/cli/gateway-cli/run.ts` | CN gateway CLI |
| `src/utils.ts` | CN utilities |

## Tier 3: CN-Only New Files (no conflict possible)

These files exist only in CN and have no upstream counterpart:
- `src/dispatch/capability-registry*.ts` (3 files)
- `src/dispatch/modality-router.ts`, `tool-discovery.ts`, `tool-filter.ts`, `tool-index.ts`
- `src/gateway/server-methods/capability-matrix.ts`, `log-report.ts`, `license.ts`, `support-qrcode.ts`
- `src/gateway/server-methods/reveal-handler.test.ts`, `update-execute.ts`
- `src/agents/model-context-probe.ts`, `tools/wecom-*.ts`, `tools/memory-upsert-tool.ts`
- `src/auto-reply/reply/memory-extraction.ts`, `memory-consolidation.ts`
- `src/config/provider-capability-mapping.ts`, `zod-schema.providers-cn.ts`
- `src/infra/installer-updater-full.ts`, `update-state.ts`
- `src/logging/log-truncate.ts`, `sanitize.ts`
- `src/media/chat-image-store.ts`
- `src/memory/profile-store.ts`
- `ui/src/ui/chat/compose-card.ts`, `intent-hint.ts`
- `ui/src/ui/controllers/orchestrator.ts`
- `ui/src/ui/views/update-banner.ts`, `update-dialog.ts`
- `ui/src/ui/embedded-qrcodes.ts`
- `ui/src/styles/chat/compose-card.css`
