/**
 * OpenClawCN: Networking Center RPC handlers.
 *
 * 5 methods for the 组网中心 page:
 *   gateway.network.status     — aggregated network state
 *   gateway.network.discover   — mDNS / Tailnet discovery
 *   gateway.network.probe      — test reachability of a remote gateway
 *   gateway.network.configure  — write bind/auth config (triggers restart)
 *   gateway.network.interfaces — enumerate local network interfaces
 *
 * Registered via cn-handlers.ts (extraHandlers), NOT in core server-methods.ts.
 */

import os from "node:os";
import type { GatewayRequestHandlers } from "./types.js";
import { respondUnavailableOnThrow } from "./nodes.helpers.js";
import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  writeConfigFile,
  validateConfigObjectWithPlugins,
} from "../../config/config.js";
import { applyMergePatch } from "../../config/merge-patch.js";
import { discoverGatewayBeacons } from "../../infra/bonjour-discovery.js";
import { findTailscaleBinary } from "../../infra/tailscale.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { diffConfigPaths, buildGatewayReloadPlan } from "../config-reload.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if an IPv4 address is in the Tailscale CGNAT range (100.64-127.x.x). */
function isTailnetAddress(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts[0] === 100 && (parts[1] ?? 0) >= 64 && (parts[1] ?? 0) <= 127;
}

/** Pick the primary non-internal IPv4 address from os.networkInterfaces(). */
function pickPrimaryLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && !isTailnetAddress(entry.address)) {
        return entry.address;
      }
    }
  }
  return null;
}

/** Pick the primary Tailnet IPv4 address from os.networkInterfaces(). */
function pickTailnetIp(): string | null {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && isTailnetAddress(entry.address)) {
        return entry.address;
      }
    }
  }
  return null;
}

/** Resolve bind config value to a display mode. */
function resolveBindMode(bind: unknown): "loopback" | "lan" | "tailnet" {
  const s = String(bind ?? "loopback").toLowerCase();
  if (s === "lan" || s === "0.0.0.0" || s === "auto") return "lan";
  if (s === "tailnet" || s === "tailscale") return "tailnet";
  return "loopback";
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const networkingHandlers: GatewayRequestHandlers = {
  /**
   * gateway.network.status — Aggregated network status.
   * Returns bind mode, IP addresses, device/node counts, Tailscale state.
   */
  "gateway.network.status": async ({ respond, context }) => {
    await respondUnavailableOnThrow(respond, async () => {
      const cfg = loadConfig();
      const gw = (cfg as Record<string, unknown>).gateway as Record<string, unknown> | undefined;
      const bind = gw?.bind ?? "loopback";
      const port = Number(gw?.port) || 18789;
      const tls = !!gw?.tls;
      const auth = gw?.auth as Record<string, unknown> | undefined;
      const hasAuthToken = !!auth?.token;

      const mode = resolveBindMode(bind);
      const localIp = pickPrimaryLanIp();
      const tailnetIp = pickTailnetIp();

      // Tailscale detection
      let tailscaleAvailable = false;
      let tailscaleConnected = false;
      try {
        const binary = await findTailscaleBinary();
        tailscaleAvailable = !!binary;
        // If binary found, assume connected if we have a tailnet IP
        if (binary && tailnetIp) {
          tailscaleConnected = true;
        }
      } catch {
        // ignore detection failure
      }

      // mDNS detection from config
      const discovery = (cfg as Record<string, unknown>).discovery as
        | Record<string, unknown>
        | undefined;
      const mdns = discovery?.mdns as Record<string, unknown> | undefined;
      const mdnsEnabled = mdns?.mode !== "off";

      // Count connected nodes
      const connectedNodes = context.nodeRegistry.listConnected();

      // Count online devices from health cache
      const health = context.getHealthCache();
      const presenceEntries = (health as Record<string, unknown> | null)?.presence;
      const onlineDeviceCount = Array.isArray(presenceEntries) ? presenceEntries.length : 0;

      respond(true, {
        mode,
        gatewayBind: String(bind),
        gatewayPort: port,
        gatewayTls: tls,
        onlineDeviceCount,
        onlineNodeCount: connectedNodes.length,
        mdnsEnabled,
        tailscaleAvailable,
        tailscaleConnected,
        localIp,
        tailnetIp,
        hasAuthToken,
        platform: process.platform,
      });
    });
  },

  /**
   * gateway.network.discover — Scan LAN / Tailnet for other gateways.
   */
  "gateway.network.discover": async ({ params, respond }) => {
    await respondUnavailableOnThrow(respond, async () => {
      const timeoutMs = Number(params?.timeoutMs) || 5000;
      const beacons = await discoverGatewayBeacons({ timeoutMs });
      respond(true, {
        gateways: beacons.map((b) => ({
          instanceName: b.instanceName ?? "",
          displayName: b.displayName ?? b.instanceName ?? "",
          host: b.host ?? "",
          port: b.gatewayPort ?? b.port ?? 0,
          domain: b.domain ?? "local.",
          tailnetDns: b.tailnetDns,
          lanHost: b.lanHost,
          role: b.role,
          platform: b.txt?.platform,
          version: b.txt?.version,
          gatewayTls: b.gatewayTls,
        })),
      });
    });
  },

  /**
   * gateway.network.probe — Test if a remote gateway is reachable.
   * Sends an HTTP health check to the target.
   */
  "gateway.network.probe": async ({ params, respond }) => {
    const targetHost = String(params?.targetHost ?? "").trim();
    if (!targetHost) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "targetHost is required"));
      return;
    }

    const start = Date.now();
    try {
      // Try HTTPS first, then HTTP
      const protocol = targetHost.includes(":443") ? "https" : "http";
      const url = `${protocol}://${targetHost}/health`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        const latencyMs = Date.now() - start;
        let gatewayVersion: string | undefined;
        try {
          const body = (await res.json()) as Record<string, unknown>;
          gatewayVersion = String(body?.version ?? "");
        } catch {
          // ignore parse failure
        }
        respond(true, {
          targetHost,
          reachable: res.ok,
          latencyMs,
          gatewayVersion: gatewayVersion || undefined,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      respond(true, {
        targetHost,
        reachable: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /**
   * gateway.network.configure — Write network-related config.
   * Uses the same read-merge-validate-write flow as config.patch.
   * May trigger a gateway restart via SIGUSR1.
   */
  "gateway.network.configure": async ({ params, respond }) => {
    await respondUnavailableOnThrow(respond, async () => {
      const bind = params?.bind as string | undefined;
      const authToken = params?.authToken as string | undefined;
      const generateAuthToken = params?.generateAuthToken as boolean | undefined;

      // Build a merge-patch object for the config
      const mergePatch: Record<string, unknown> = {};
      const applied: string[] = [];

      if (bind) {
        const validBinds = ["loopback", "lan", "tailnet"];
        if (!validBinds.includes(bind)) {
          respond(
            false,
            undefined,
            errorShape(
              ErrorCodes.INVALID_REQUEST,
              `invalid bind value: ${bind}. Must be one of: ${validBinds.join(", ")}`,
            ),
          );
          return;
        }

        // LAN/Tailnet mode requires an auth token
        if (bind !== "loopback") {
          const cfg = loadConfig();
          const gw = (cfg as Record<string, unknown>).gateway as
            | Record<string, unknown>
            | undefined;
          const existingAuth = gw?.auth as Record<string, unknown> | undefined;
          const hasToken = !!existingAuth?.token || !!authToken || !!generateAuthToken;
          if (!hasToken) {
            respond(
              false,
              undefined,
              errorShape(
                ErrorCodes.INVALID_REQUEST,
                "Switching to LAN/Tailnet mode requires an auth token. " +
                  "Provide authToken or set generateAuthToken: true.",
              ),
            );
            return;
          }
        }

        const bindHost = bind === "loopback" ? "127.0.0.1" : "0.0.0.0";
        if (!mergePatch.gateway) mergePatch.gateway = {};
        (mergePatch.gateway as Record<string, unknown>).bind = bindHost;
        applied.push(`gateway.bind=${bindHost}`);
      }

      // Resolve auth token
      let resolvedToken = authToken;
      if (!resolvedToken && generateAuthToken) {
        const { randomBytes } = await import("node:crypto");
        resolvedToken = randomBytes(32).toString("base64url");
      }
      if (resolvedToken) {
        if (!mergePatch.gateway) mergePatch.gateway = {};
        const gw = mergePatch.gateway as Record<string, unknown>;
        if (!gw.auth) gw.auth = {};
        (gw.auth as Record<string, unknown>).token = resolvedToken;
        applied.push("gateway.auth.token=***");
      }

      if (applied.length === 0) {
        respond(true, { applied: [], restartRequired: false });
        return;
      }

      // Read → merge → validate → write (same flow as config.patch)
      const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
      if (!snapshot.valid) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Config file is invalid; fix before changing network settings.",
          ),
        );
        return;
      }

      const merged = applyMergePatch(snapshot.config, mergePatch, {
        mergeObjectArraysById: true,
      });
      const validated = validateConfigObjectWithPlugins(merged);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after merge", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config, writeOptions);

      // Determine if restart is needed
      const changedPaths = diffConfigPaths(snapshot.config, validated.config);
      const needsRestart =
        changedPaths.length > 0 && buildGatewayReloadPlan(changedPaths).restartGateway;

      if (needsRestart) {
        scheduleGatewaySigusr1Restart({
          delayMs: 500,
          reason: "gateway.network.configure",
        });
      }

      respond(true, {
        applied,
        restartRequired: needsRestart,
        restartScheduledMs: needsRestart ? 500 : undefined,
      });
    });
  },

  /**
   * gateway.network.interfaces — Enumerate local network interfaces.
   */
  "gateway.network.interfaces": ({ respond }) => {
    const nets = os.networkInterfaces();
    const interfaces: Array<Record<string, unknown>> = [];
    for (const [name, entries] of Object.entries(nets)) {
      for (const entry of entries ?? []) {
        interfaces.push({
          name,
          address: entry.address,
          family: entry.family,
          internal: entry.internal,
          netmask: entry.netmask,
          mac: entry.mac,
          isTailnet: entry.family === "IPv4" && isTailnetAddress(entry.address),
        });
      }
    }
    respond(true, { interfaces });
  },
};
