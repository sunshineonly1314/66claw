/**
 * Normalize user-pasted secret values (API keys, tokens, passwords).
 * Strips line breaks (\r, \n, Unicode line/paragraph separators) that
 * commonly sneak in when pasting from terminals or password managers.
 */
export function normalizeSecretInput(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[\r\n\u2028\u2029]+/g, "").trim();
}

export function normalizeOptionalSecretInput(value: unknown): string | undefined {
  const normalized = normalizeSecretInput(value);
  return normalized ? normalized : undefined;
}
