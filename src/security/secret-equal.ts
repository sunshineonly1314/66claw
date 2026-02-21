import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret comparison.
 *
 * [MED-11] Uses HMAC pre-processing so both digests are always 32 bytes,
 * eliminating the length-based timing side-channel of the previous
 * Buffer.length !== Buffer.length early-return.
 */
export function safeEqualSecret(
  provided: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }
  const key = randomBytes(32);
  const a = createHmac("sha256", key).update(provided).digest();
  const b = createHmac("sha256", key).update(expected).digest();
  return timingSafeEqual(a, b);
}
