/**
 * Agent-team fallback stub handlers — registered directly in CN handlers
 * so the gateway never returns "unknown method" when the agent-team plugin
 * fails to load (e.g. .jsc bytecode mismatch, corrupted build).
 *
 * When the agent-team plugin loads successfully via the plugin system,
 * pluginRegistry.gatewayHandlers overrides these (higher precedence in
 * server.impl.ts merge order).
 */

import type { GatewayRequestHandlers } from "./types.js";

const PLUGIN_NOT_LOADED_ERROR = {
  code: "PLUGIN_NOT_LOADED",
  message: "Agent-team plugin not loaded. Please restart the application or reinstall.",
};

export const agentTeamStubHandlers: GatewayRequestHandlers = {
  // ── List / query methods: return empty results ──────────────────────

  "team.project.list": ({ respond }) => {
    respond(true, { projects: [] }, undefined);
  },

  "team.route.summary": ({ respond }) => {
    respond(true, { routes: [] }, undefined);
  },

  // ── Mutating / detail methods: return friendly error ────────────────

  "team.project.get": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.create": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.createFromPlan": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.update": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.delete": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.pause": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.resume": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.health": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.stats": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.activity": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.shared-memory.list": ({ respond }) => {
    respond(true, { entries: [] }, undefined);
  },

  "team.shared-memory.clear": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.federation.create": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.files.list": ({ respond }) => {
    respond(true, { files: [] }, undefined);
  },

  "team.project.learning": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },

  "team.project.optimize": ({ respond }) => {
    respond(false, undefined, PLUGIN_NOT_LOADED_ERROR);
  },
};
