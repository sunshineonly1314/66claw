import { randomUUID } from "node:crypto";
const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
function generateProjectId() {
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const rand = randomUUID().slice(0, 8);
  return `proj-${date}-${rand}`;
}
function sanitizeProjectId(projectId) {
  if (!VALID_ID_RE.test(projectId)) {
    throw new Error(
      `Invalid projectId: "${projectId}" \u2014 must contain only alphanumeric, hyphens, underscores`
    );
  }
  return projectId;
}
function isValidProjectId(projectId) {
  return VALID_ID_RE.test(projectId);
}
export {
  generateProjectId,
  isValidProjectId,
  sanitizeProjectId
};
