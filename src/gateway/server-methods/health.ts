import type { GatewayRequestHandlers } from "./types.js";
import { getStatusSummary } from "../../commands/status.js";
import type { StatusSummary } from "../../commands/status.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { HEALTH_REFRESH_INTERVAL_MS } from "../server-constants.js";
import { formatError } from "../server-utils.js";
import { formatForLog } from "../ws-log.js";

const ADMIN_SCOPE = "operator.admin";

// Cache for the `status` RPC — avoids repeated expensive computation.
// getStatusSummary() can take 3-21s depending on channel plugin isConfigured checks.
const STATUS_CACHE_TTL_MS = 10_000;
let _statusCachePublic: StatusSummary | null = null;
let _statusCacheAdmin: StatusSummary | null = null;
let _statusCachePublicAt = 0;
let _statusCacheAdminAt = 0;
// Dedup in-flight: prevent multiple concurrent getStatusSummary calls
let _statusInflightPublic: Promise<StatusSummary> | null = null;
let _statusInflightAdmin: Promise<StatusSummary> | null = null;

export const healthHandlers: GatewayRequestHandlers = {
  health: async ({ respond, context, params }) => {
    const { getHealthCache, refreshHealthSnapshot, logHealth } = context;
    const wantsProbe = params?.probe === true;
    const now = Date.now();
    const cached = getHealthCache();
    if (!wantsProbe && cached && now - cached.ts < HEALTH_REFRESH_INTERVAL_MS) {
      respond(true, cached, undefined, { cached: true });
      void refreshHealthSnapshot({ probe: false }).catch((err) =>
        logHealth.error(`background health refresh failed: ${formatError(err)}`),
      );
      return;
    }
    try {
      const snap = await refreshHealthSnapshot({ probe: wantsProbe });
      respond(true, snap, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  status: async ({ respond, client }) => {
    const scopes = Array.isArray(client?.connect?.scopes) ? client.connect.scopes : [];
    const isAdmin = scopes.includes(ADMIN_SCOPE);
    const now = Date.now();

    // Serve from cache if fresh
    if (isAdmin) {
      if (_statusCacheAdmin && now - _statusCacheAdminAt < STATUS_CACHE_TTL_MS) {
        respond(true, _statusCacheAdmin, undefined);
        return;
      }
    } else {
      if (_statusCachePublic && now - _statusCachePublicAt < STATUS_CACHE_TTL_MS) {
        respond(true, _statusCachePublic, undefined);
        return;
      }
    }

    // Dedup in-flight requests
    const inFlight = isAdmin ? _statusInflightAdmin : _statusInflightPublic;
    if (inFlight) {
      const status = await inFlight;
      respond(true, status, undefined);
      return;
    }

    const req = getStatusSummary({ includeSensitive: isAdmin })
      .then((status) => {
        if (isAdmin) {
          _statusCacheAdmin = status;
          _statusCacheAdminAt = Date.now();
          _statusInflightAdmin = null;
        } else {
          _statusCachePublic = status;
          _statusCachePublicAt = Date.now();
          _statusInflightPublic = null;
        }
        return status;
      })
      .catch((err) => {
        if (isAdmin) _statusInflightAdmin = null;
        else _statusInflightPublic = null;
        throw err;
      });

    if (isAdmin) _statusInflightAdmin = req;
    else _statusInflightPublic = req;

    const status = await req;
    respond(true, status, undefined);
  },
};
