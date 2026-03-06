import type { GatewayRequestHandlers, GatewayRequestOptions } from "./server-methods/types.js";
import { ErrorCodes, errorShape, errorShapeFromError } from "./protocol/index.js";
import { applyEnforcementDelay, shouldBlockService } from "../security/delayed-enforcement.js";
import { defaultRuntime } from "../runtime.js";

// ---------------------------------------------------------------------------
// Server-side RPC handler timeout
// ---------------------------------------------------------------------------
// All handlers should respond well within this limit.  "chat.send" replies
// with an immediate ACK (~ms) and runs the agent in the background, so 120s
// is generous even for the heaviest synchronous handler
// (modelConfig.provider.detect ~8s, skills.market.refresh ~0.5s, etc.).
//
// Without this guard, a stuck handler keeps the server-side `respond` closure
// alive indefinitely.  The client has its own 5-minute timeout
// (PENDING_TIMEOUT_MS in client.ts), but the server side leaks memory and
// blocks the log timer (requests show up as "7481209ms" in the logs).
const RPC_HANDLER_TIMEOUT_MS = 120_000;
import { agentHandlers } from "./server-methods/agent.js";
import { agentsHandlers } from "./server-methods/agents.js";
import { browserHandlers } from "./server-methods/browser.js";
import { channelsHandlers } from "./server-methods/channels.js";
import { chatHandlers } from "./server-methods/chat.js";
import { configHandlers } from "./server-methods/config.js";
import { connectHandlers } from "./server-methods/connect.js";
import { cronHandlers } from "./server-methods/cron.js";
import { deviceHandlers } from "./server-methods/devices.js";
import { execApprovalsHandlers } from "./server-methods/exec-approvals.js";
import { healthHandlers } from "./server-methods/health.js";
import { logsHandlers } from "./server-methods/logs.js";
import { modelsHandlers } from "./server-methods/models.js";
import { nodeHandlers } from "./server-methods/nodes.js";
import { sendHandlers } from "./server-methods/send.js";
import { sessionsHandlers } from "./server-methods/sessions.js";
import { skillsHandlers } from "./server-methods/skills.js";
import { systemHandlers } from "./server-methods/system.js";
import { talkHandlers } from "./server-methods/talk.js";
import { ttsHandlers } from "./server-methods/tts.js";
import { updateHandlers } from "./server-methods/update.js";
import { usageHandlers } from "./server-methods/usage.js";
import { voicewakeHandlers } from "./server-methods/voicewake.js";
import { webHandlers } from "./server-methods/web.js";
import { wizardHandlers } from "./server-methods/wizard.js";
import { mcpHandlers } from "./server-methods/mcp-methods.js";
import { routeHandlers } from "./server-methods/route.js";
import { terminalHandlers } from "./server-methods/terminal.js";

const ADMIN_SCOPE = "operator.admin";
const READ_SCOPE = "operator.read";
const WRITE_SCOPE = "operator.write";
const APPROVALS_SCOPE = "operator.approvals";
const PAIRING_SCOPE = "operator.pairing";

const APPROVAL_METHODS = new Set([
  "exec.approval.request",
  "exec.approval.waitDecision",
  "exec.approval.resolve",
]);
const NODE_ROLE_METHODS = new Set(["node.invoke.result", "node.event", "skills.bins"]);
const PAIRING_METHODS = new Set([
  "node.pair.request",
  "node.pair.list",
  "node.pair.approve",
  "node.pair.reject",
  "node.pair.verify",
  "device.pair.list",
  "device.pair.approve",
  "device.pair.reject",
  "device.token.rotate",
  "device.token.revoke",
  "node.rename",
]);
const ADMIN_METHOD_PREFIXES = ["exec.approvals."];
const READ_METHODS = new Set([
  "health",
  "logs.tail",
  "diagnose.logs",
  "channels.status",
  "status",
  "usage.status",
  "usage.cost",
  "tts.status",
  "tts.providers",
  "models.list",
  "agents.list",
  "agent.identity.get",
  "skills.status",
  "voicewake.get",
  "sessions.list",
  "sessions.preview",
  "cron.list",
  "cron.status",
  "cron.runs",
  "system-presence",
  "last-heartbeat",
  "node.list",
  "node.describe",
  "chat.history",
  "media.list",
  "config.get",
  "talk.config",
  // OpenClawCN: Networking Center read methods
  "gateway.network.status",
  "gateway.network.discover",
  "gateway.network.probe",
  "gateway.network.interfaces",
  // Channel route read methods
  "route.getChannelAgents",
]);
const WRITE_METHODS = new Set([
  "send",
  "agent",
  "agent.wait",
  "wake",
  "talk.mode",
  "tts.enable",
  "tts.disable",
  "tts.convert",
  "tts.setProvider",
  "voicewake.set",
  "node.invoke",
  "chat.send",
  "chat.abort",
  "browser.request",
  // OpenClawCN: Networking Center write methods
  "gateway.network.configure",
  // Channel route write methods
  "route.setChannelAgent",
]);

function authorizeGatewayMethod(method: string, client: GatewayRequestOptions["client"]) {
  if (!client?.connect) {
    return null;
  }
  const role = client.connect.role ?? "operator";
  const scopes = client.connect.scopes ?? [];
  if (NODE_ROLE_METHODS.has(method)) {
    if (role === "node") {
      return null;
    }
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role === "node") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role !== "operator") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (scopes.includes(ADMIN_SCOPE)) {
    return null;
  }
  if (APPROVAL_METHODS.has(method) && !scopes.includes(APPROVALS_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.approvals");
  }
  if (PAIRING_METHODS.has(method) && !scopes.includes(PAIRING_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.pairing");
  }
  if (READ_METHODS.has(method) && !(scopes.includes(READ_SCOPE) || scopes.includes(WRITE_SCOPE))) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.read");
  }
  if (WRITE_METHODS.has(method) && !scopes.includes(WRITE_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.write");
  }
  if (APPROVAL_METHODS.has(method)) {
    return null;
  }
  if (PAIRING_METHODS.has(method)) {
    return null;
  }
  if (READ_METHODS.has(method)) {
    return null;
  }
  if (WRITE_METHODS.has(method)) {
    return null;
  }
  if (ADMIN_METHOD_PREFIXES.some((prefix) => method.startsWith(prefix))) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.admin");
  }
  if (
    method.startsWith("config.") ||
    method.startsWith("wizard.") ||
    method.startsWith("update.") ||
    method.startsWith("mcp.") ||
    method === "channels.logout" ||
    method === "agents.create" ||
    method === "agents.update" ||
    method === "agents.delete" ||
    method === "skills.install" ||
    method === "skills.update" ||
    method === "skills.import" ||
    method === "skills.browse" ||
    method === "cron.add" ||
    method === "cron.update" ||
    method === "cron.remove" ||
    method === "cron.run" ||
    method === "sessions.patch" ||
    method === "sessions.reset" ||
    method === "sessions.delete" ||
    method === "sessions.compact"
  ) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.admin");
  }
  return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.admin");
}

export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,
  ...logsHandlers,
  ...voicewakeHandlers,
  ...healthHandlers,
  ...channelsHandlers,
  ...chatHandlers,
  ...cronHandlers,
  ...deviceHandlers,
  ...execApprovalsHandlers,
  ...webHandlers,
  ...modelsHandlers,
  ...configHandlers,
  ...wizardHandlers,
  ...talkHandlers,
  ...ttsHandlers,
  ...skillsHandlers,
  ...sessionsHandlers,
  ...systemHandlers,
  ...updateHandlers,
  ...nodeHandlers,
  ...sendHandlers,
  ...usageHandlers,
  ...agentHandlers,
  ...agentsHandlers,
  ...browserHandlers,
  ...mcpHandlers,
  ...routeHandlers,
  ...terminalHandlers,
};

export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers?: GatewayRequestHandlers },
): Promise<void> {
  const { req, respond, client, isWebchatConnect, context } = opts;

  // [Knife 7] 延迟惩罚系统：累积安全违规后对所有请求注入随机延迟，直至封锁服务
  // 设计意图：让破解者无法确定是哪个检查触发了惩罚（随机延迟掩盖因果关系）
  if (shouldBlockService()) {
    respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "service unavailable"));
    return;
  }
  await applyEnforcementDelay();

  const authError = authorizeGatewayMethod(req.method, client);
  if (authError) {
    respond(false, undefined, authError);
    return;
  }
  const handler = opts.extraHandlers?.[req.method] ?? coreGatewayHandlers[req.method];
  if (!handler) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `unknown method: ${req.method}`),
    );
    return;
  }

  // Guard: wrap `respond` so it can only be called once.
  // If the handler already responded before the timeout fires, the timeout
  // response becomes a no-op — no duplicate frames sent to the client.
  let responded = false;
  const guardedRespond: typeof respond = (ok, payload, error, meta) => {
    if (responded) return;
    responded = true;
    respond(ok, payload, error, meta);
  };

  // Server-side handler timeout: prevents requests from hanging indefinitely
  // when a handler stalls (e.g. blocking sync I/O, deadlocked async).
  const started = Date.now();
  const timer = setTimeout(() => {
    if (!responded) {
      const elapsed = Date.now() - started;
      defaultRuntime.error(
        `[rpc-timeout] handler "${req.method}" timed out after ${elapsed}ms (limit ${RPC_HANDLER_TIMEOUT_MS}ms), id=${req.id}`,
      );
      guardedRespond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `request timed out after ${RPC_HANDLER_TIMEOUT_MS}ms`),
      );
    }
  }, RPC_HANDLER_TIMEOUT_MS);

  try {
    await handler({
      req,
      params: (req.params ?? {}) as Record<string, unknown>,
      client,
      isWebchatConnect,
      respond: guardedRespond,
      context,
    });
  } catch (err) {
    // CN: 统一的 handler 错误捕获 — 自动分类 + 中文翻译，避免一律返回 UNAVAILABLE
    guardedRespond(false, undefined, errorShapeFromError(ErrorCodes.INTERNAL_ERROR, err));
  } finally {
    clearTimeout(timer);
  }
}
