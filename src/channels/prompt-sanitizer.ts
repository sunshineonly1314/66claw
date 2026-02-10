/**
 * Prompt Injection Sanitizer
 *
 * Sanitizes untrusted user/channel metadata before injecting into system prompts
 * to prevent prompt injection attacks.
 *
 * Performance optimizations:
 * - LRU cache for frequently sanitized values (channel names, usernames)
 * - Early exit on forbidden patterns
 * - Optimized regex patterns
 *
 * See: SECURITY_AUDIT_BATCH_1_PHASE_2.md - Vulnerability #9
 */

/**
 * Maximum length for untrusted metadata fields
 */
const MAX_METADATA_LENGTH = 500;

/**
 * Simple LRU cache for sanitized values
 * Prevents re-sanitizing the same channel names/usernames repeatedly
 */
class SanitizationCache {
  private cache = new Map<string, string | null>();
  private readonly maxSize = 100;

  get(key: string): string | null | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string | null): void {
    // Simple LRU: delete oldest when full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

const sanitizationCache = new SanitizationCache();

/**
 * Forbidden patterns that indicate potential prompt injection attempts
 *
 * Performance note: Patterns are ordered by likelihood (most common attacks first)
 * to optimize early exit in validation loop
 */
const FORBIDDEN_PATTERNS = [
  /ignore.*previous.*instruction/i,  // Most common attack
  /you are now/i,                     // Common jailbreak
  /ignore.*all.*instruction/i,
  /override.*instruction/i,
  /switch.*mode/i,
  /system.*alert/i,
  /admin.*mode/i,
  /developer.*mode/i,
  /disregard.*previous/i,
  /reset.*instruction/i,
  /new.*instruction/i,
] as const;

/**
 * Sanitize untrusted text for safe inclusion in system prompts
 *
 * This function provides multiple layers of protection:
 * 1. Length limiting (prevents excessive metadata)
 * 2. Markdown header prevention (removes ## ### etc)
 * 3. XML tag stripping (prevents structured injection)
 * 4. Newline limiting (prevents prompt section splitting)
 * 5. Control character removal (prevents invisible attacks)
 *
 * @param text - Untrusted user/channel metadata
 * @param options - Sanitization options
 * @returns Sanitized text safe for prompt injection
 */
export function sanitizeUntrustedMetadata(
  text: string | null | undefined,
  options: {
    /** Maximum length (default: 500) */
    maxLength?: number;
    /** Allow newlines (default: false) */
    allowNewlines?: boolean;
    /** Validate against forbidden patterns (default: true) */
    validatePatterns?: boolean;
    /** Use cache for performance (default: true) */
    useCache?: boolean;
  } = {},
): string | null {
  if (!text || typeof text !== "string") return null;

  const maxLength = options.maxLength ?? MAX_METADATA_LENGTH;
  const allowNewlines = options.allowNewlines ?? false;
  const validatePatterns = options.validatePatterns ?? true;
  const useCache = options.useCache ?? true;

  // Check cache for performance (channel names, usernames are often reused)
  if (useCache) {
    const cacheKey = `${text}:${maxLength}:${allowNewlines}:${validatePatterns}`;
    const cached = sanitizationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Step 1: Trim whitespace
  let sanitized = text.trim();
  if (!sanitized) return null;

  // Step 2: Check forbidden patterns (early return for obvious attacks)
  if (validatePatterns) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized)) {
        // Log the attempt (in production, this should go to security logs)
        console.warn("[SECURITY] Prompt injection attempt blocked:", {
          pattern: pattern.source,
          text: sanitized.slice(0, 100),
        });
        return null; // Reject the entire text
      }
    }
  }

  // Step 3: Remove control characters (except newline/tab)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Step 4: Remove XML/HTML tags (prevents structured injection)
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Step 5: Prevent Markdown headers (## ### etc)
  // Replace consecutive # with single #
  sanitized = sanitized.replace(/#{2,}/g, "#");

  // Step 6: Limit consecutive newlines (prevents prompt section splitting)
  if (allowNewlines) {
    // Allow newlines but limit to max 2 consecutive
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
  } else {
    // Replace all newlines with spaces
    sanitized = sanitized.replace(/\n+/g, " ");
    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, " ");
  }

  // Step 7: Length limiting
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    // Add ellipsis to indicate truncation
    sanitized = sanitized + "...";
  }

  // Step 8: Final trim
  sanitized = sanitized.trim();

  const result = sanitized || null;

  // Cache the result for performance
  if (useCache) {
    const cacheKey = `${text}:${maxLength}:${allowNewlines}:${validatePatterns}`;
    sanitizationCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Sanitize admin-configured system prompt
 *
 * Admin config should have more lenient rules than user metadata,
 * but still needs validation to prevent accidental or malicious injection.
 *
 * @param prompt - Admin-configured system prompt
 * @returns Sanitized prompt or null
 */
export function sanitizeAdminSystemPrompt(
  prompt: string | null | undefined,
): string | null {
  if (!prompt || typeof prompt !== "string") return null;

  const trimmed = prompt.trim();
  if (!trimmed) return null;

  // Allow newlines for admin prompts (they may want multi-line instructions)
  // But limit length to prevent abuse
  const maxLength = 2000;

  // Check for obvious injection attempts even in admin config
  const dangerousPatterns = [
    /ignore.*previous.*instruction/i,
    /disregard.*previous/i,
    /reset.*instruction/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn("[SECURITY] Suspicious admin prompt detected:", {
        pattern: pattern.source,
        prompt: trimmed.slice(0, 100),
      });
      // For admin prompts, we warn but don't block
      // (admin may legitimately need these phrases in rare cases)
    }
  }

  // Length limiting
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
}

/**
 * Create a safely delimited metadata section for system prompts
 *
 * Uses XML-style tags to clearly delimit untrusted content,
 * making it harder for injection payloads to escape.
 *
 * @param label - Section label (e.g., "channel_description")
 * @param content - Sanitized content
 * @returns Delimited section or null
 */
export function createDelimitedMetadataSection(
  label: string,
  content: string | null,
): string | null {
  if (!content) return null;

  // Ensure label is safe (alphanumeric + underscore only)
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");

  return `<${safeLabel}>${content}</${safeLabel}>`;
}

/**
 * Validate a full system prompt for injection risks
 *
 * This is a final safety check before using a system prompt.
 *
 * @param prompt - Complete system prompt
 * @returns True if safe, false if risky
 */
export function validateSystemPromptSafety(prompt: string): boolean {
  if (!prompt) return true;

  // Check for multiple consecutive markdown headers (sign of injection)
  const headerCount = (prompt.match(/^#{2,}\s/gm) || []).length;
  if (headerCount > 10) {
    console.warn("[SECURITY] Excessive markdown headers in prompt:", headerCount);
    return false;
  }

  // Check for suspiciously long prompt (> 50KB)
  if (prompt.length > 50_000) {
    console.warn("[SECURITY] Prompt too long:", prompt.length);
    return false;
  }

  return true;
}

/**
 * Clear the sanitization cache
 *
 * Useful for testing or when memory pressure is high
 */
export function clearSanitizationCache(): void {
  sanitizationCache.clear();
}

/**
 * Export for testing
 */
export const __testing = {
  sanitizationCache,
  FORBIDDEN_PATTERNS,
  MAX_METADATA_LENGTH,
} as const;
