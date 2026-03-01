const ACTIVITY_SUMMARY_MAX_CHARS = 500;
const ACTIVITY_SUMMARY_MAX_EVENTS = 5;
function formatActivitySummary(events, agentNames, limit = ACTIVITY_SUMMARY_MAX_EVENTS) {
  if (!events || events.length === 0) return "";
  const recent = events.slice(-limit);
  const lines = [];
  for (const evt of recent) {
    const name = agentNames.get(evt.agentId) ?? shortId(evt.agentId);
    const duration = evt.durationMs != null ? ` (${formatDuration(evt.durationMs)})` : "";
    const status = formatOutcome(evt);
    const method = evt.method ? ` via ${evt.method}` : "";
    lines.push(`${name}${method}: ${status}${duration}`);
  }
  const summary = `Recent team activity:
${lines.join("\n")}`;
  if (summary.length > ACTIVITY_SUMMARY_MAX_CHARS) {
    return summary.slice(0, ACTIVITY_SUMMARY_MAX_CHARS - 3) + "...";
  }
  return summary;
}
function sanitizeForPrompt(s) {
  return s.replace(/[<>]/g, "").replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();
}
function formatOutcome(evt) {
  if (evt.outcome) {
    switch (evt.outcome) {
      case "success":
        return "completed";
      case "failure":
        return evt.error ? `failed (${sanitizeForPrompt(truncate(evt.error, 40))})` : "failed";
      case "timeout":
        return "timed out";
      case "partial":
        return "partial result";
      default:
        return sanitizeForPrompt(evt.outcome);
    }
  }
  if (evt.success === false) {
    return evt.error ? `failed (${sanitizeForPrompt(truncate(evt.error, 40))})` : "failed";
  }
  return "completed";
}
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms < 1e3) return `${Math.round(ms)}ms`;
  const seconds = (ms / 1e3).toFixed(1);
  return `${seconds}s`;
}
function shortId(agentId) {
  const parts = agentId.split("--");
  const raw = parts.length > 1 ? parts[parts.length - 1] : agentId;
  return sanitizeForPrompt(raw);
}
function truncate(s, maxLen) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}
export {
  formatActivitySummary
};
