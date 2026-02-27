import type { ConfigUiHints } from "../types";
import { tMaybe } from "../i18n/index.js";

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: JsonSchema | boolean;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
};

export function schemaType(schema: JsonSchema): string | undefined {
  if (!schema) return undefined;
  if (Array.isArray(schema.type)) {
    const filtered = schema.type.filter((t) => t !== "null");
    return filtered[0] ?? schema.type[0];
  }
  return schema.type;
}

export function defaultValue(schema?: JsonSchema): unknown {
  if (!schema) return "";
  if (schema.default !== undefined) return schema.default;
  const type = schemaType(schema);
  switch (type) {
    case "object":
      return {};
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "string":
      return "";
    default:
      return "";
  }
}

export function pathKey(path: Array<string | number>): string {
  return path.filter((segment) => typeof segment === "string").join(".");
}

export function hintForPath(path: Array<string | number>, hints: ConfigUiHints) {
  const key = pathKey(path);
  const direct = hints[key];
  if (direct) return direct;
  const segments = key.split(".");
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes("*")) continue;
    const hintSegments = hintKey.split(".");
    if (hintSegments.length !== segments.length) continue;
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== "*" && hintSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) return hint;
  }
  return undefined;
}

export function humanize(raw: string) {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (m) => m.toUpperCase());
}

export function resolveLabel(
  path: Array<string | number>,
  hint: { label?: string } | undefined,
  schema: { title?: string },
  fallbackKey?: string,
): string {
  const key = pathKey(path);
  const i18nKey = `config.field.${key}`;
  const translated = tMaybe(i18nKey);
  if (translated !== i18nKey) return translated;

  // For array paths (containing numeric indices), try wildcard variants:
  //   path ["agents","list",0,"tools","profile"]
  //   → "config.field.agents.list.*.tools.profile"   (star variant)
  //   → "config.field.agents.list[].tools.profile"    (bracket variant)
  if (path.some((s) => typeof s === "number")) {
    const starKey = `config.field.${path.map((s) => (typeof s === "number" ? "*" : s)).join(".")}`;
    const starResult = tMaybe(starKey);
    if (starResult !== starKey) return starResult;

    const bracketParts: string[] = [];
    for (const seg of path) {
      if (typeof seg === "number") {
        if (bracketParts.length > 0) bracketParts[bracketParts.length - 1] += "[]";
      } else {
        bracketParts.push(seg);
      }
    }
    const bracketKey = `config.field.${bracketParts.join(".")}`;
    const bracketResult = tMaybe(bracketKey);
    if (bracketResult !== bracketKey) return bracketResult;
  }

  return hint?.label ?? schema.title ?? humanize(fallbackKey ?? String(path.at(-1)));
}

/**
 * Resolves a human-friendly label for a config field's value.
 * Looks up i18n key `config.value.<dotted.path>.<value>`, falls back to raw value.
 */
export function resolveValueLabel(
  path: Array<string | number>,
  value: unknown,
): string {
  const raw = String(value ?? "");
  const dotPath = path.filter((s) => typeof s === "string").join(".");
  const i18nKey = `config.value.${dotPath}.${raw}`;
  const translated = tMaybe(i18nKey);
  if (translated !== i18nKey) return translated;
  return raw;
}

export function isSensitivePath(path: Array<string | number>): boolean {
  const key = pathKey(path).toLowerCase();
  return (
    key.includes("token") ||
    key.includes("password") ||
    key.includes("secret") ||
    key.includes("apikey") ||
    key.endsWith("key")
  );
}
