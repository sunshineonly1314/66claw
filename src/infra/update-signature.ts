/**
 * Update Package Ed25519 Signature Verification
 *
 * Verifies Ed25519 signatures on delta tarballs and checksums files
 * downloaded during installer updates.
 *
 * Security model:
 * - Ed25519 public key is hardcoded (same as RSA key in license module)
 * - CI signs delta tarballs and checksums with the corresponding private key
 * - Client downloads .sig file alongside each artifact and verifies before applying
 *
 * Ed25519 was chosen over RSA for update signatures because:
 * - 64-byte signatures (vs 256+ for RSA)
 * - Faster verification
 * - Simpler, less room for implementation errors
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("infra:update-signature");

/**
 * Ed25519 public key for update package verification.
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !! PLACEHOLDER — MUST BE REPLACED BEFORE PRODUCTION RELEASE      !!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * Current status: PLACEHOLDER key. All signature verification is BYPASSED
 * via `isUpdateSigningKeyConfigured()` returning false. This means update
 * packages are NOT cryptographically verified in the current build.
 *
 * To enable signature verification:
 *   1. Generate a keypair:
 *        openssl genpkey -algorithm Ed25519 -out update-signing.pem
 *        openssl pkey -in update-signing.pem -pubout -out update-signing.pub
 *   2. Replace the placeholder below with the contents of update-signing.pub
 *   3. Store the private key (update-signing.pem) as the CI secret
 *      UPDATE_SIGNING_PRIVATE_KEY — used by scripts/release-deploy.ts to sign artifacts
 *   4. NEVER commit the private key to the repository
 *
 * The corresponding private key is stored in CI secrets (UPDATE_SIGNING_PRIVATE_KEY)
 * and used by build scripts to sign delta packages and checksums.
 *
 * IMPORTANT: Update this key when rotating signing keys.
 * Old clients will reject packages signed with new keys (intentional — forces upgrade).
 */
const UPDATE_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAplaceholder_replace_with_real_key_before_release000=
-----END PUBLIC KEY-----`;

/**
 * Check whether the Ed25519 public key has been configured (not placeholder).
 * During development, signature verification is skipped if the key is a placeholder.
 */
export function isUpdateSigningKeyConfigured(): boolean {
  return !UPDATE_ED25519_PUBLIC_KEY.includes("placeholder_replace_with_real_key");
}

/**
 * Verify an Ed25519 signature over a file.
 *
 * @param filePath - Path to the file that was signed
 * @param signatureBase64 - Base64-encoded Ed25519 signature
 * @returns true if signature is valid
 */
export async function verifyFileSignature(
  filePath: string,
  signatureBase64: string,
): Promise<boolean> {
  if (!isUpdateSigningKeyConfigured()) {
    log.warn(
      "Ed25519 update signing key is placeholder — skipping signature verification (dev mode)",
    );
    return true;
  }

  try {
    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) {
      log.error(`Invalid Ed25519 signature length: ${signature.length} (expected 64)`);
      return false;
    }

    // Read file content using streaming to handle large files
    const fileContent = await readFileAsBuffer(filePath);

    const isValid = crypto.verify(
      null, // Ed25519 does not use a separate hash algorithm
      fileContent,
      UPDATE_ED25519_PUBLIC_KEY,
      signature,
    );

    if (isValid) {
      log.debug(`Ed25519 signature verified for: ${filePath}`);
    } else {
      log.error(`Ed25519 signature verification FAILED for: ${filePath}`);
    }

    return isValid;
  } catch (error) {
    log.error(`Ed25519 signature verification error: ${error}`);
    return false;
  }
}

/**
 * Verify an Ed25519 signature over raw content (e.g. checksums JSON).
 *
 * @param content - The content that was signed (UTF-8 string or Buffer)
 * @param signatureBase64 - Base64-encoded Ed25519 signature
 * @returns true if signature is valid
 */
export function verifyContentSignature(content: string | Buffer, signatureBase64: string): boolean {
  if (!isUpdateSigningKeyConfigured()) {
    log.warn(
      "Ed25519 update signing key is placeholder — skipping signature verification (dev mode)",
    );
    return true;
  }

  try {
    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) {
      log.error(`Invalid Ed25519 signature length: ${signature.length} (expected 64)`);
      return false;
    }

    const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;

    const isValid = crypto.verify(null, data, UPDATE_ED25519_PUBLIC_KEY, signature);

    if (isValid) {
      log.debug("Ed25519 content signature verified");
    } else {
      log.error("Ed25519 content signature verification FAILED");
    }

    return isValid;
  } catch (error) {
    log.error(`Ed25519 content signature verification error: ${error}`);
    return false;
  }
}

/**
 * Download and verify a .sig file for a given artifact URL.
 *
 * Convention: signature file URL = artifact URL + ".sig"
 * The .sig file contains the base64-encoded Ed25519 signature as plain text.
 *
 * @param artifactPath - Local path to the downloaded artifact
 * @param sigUrl - URL to the .sig signature file
 * @param fetchFn - Fetch function (injected for testability, defaults to global fetch)
 * @param timeoutMs - Timeout for downloading the signature file
 * @returns true if signature verification passes
 */
export async function downloadAndVerifySignature(
  artifactPath: string,
  sigUrl: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<boolean> {
  if (!isUpdateSigningKeyConfigured()) {
    log.warn(
      "Ed25519 update signing key is placeholder — skipping signature verification (dev mode)",
    );
    return true;
  }

  try {
    const res = await fetchFn(sigUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      log.error(`Failed to download signature file: HTTP ${res.status} from ${sigUrl}`);
      return false;
    }

    const signatureBase64 = (await res.text()).trim();
    if (!signatureBase64 || signatureBase64.length < 10) {
      log.error("Signature file is empty or too short");
      return false;
    }

    return await verifyFileSignature(artifactPath, signatureBase64);
  } catch (error) {
    log.error(`Failed to download/verify signature from ${sigUrl}: ${error}`);
    return false;
  }
}

/**
 * Read entire file into a Buffer (for signature verification).
 * Uses streaming for large files to avoid excessive memory allocation.
 */
async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  const stat = await fs.stat(filePath);

  // For files under 50MB, read directly
  if (stat.size < 50 * 1024 * 1024) {
    return fs.readFile(filePath);
  }

  // For larger files, stream into a buffer
  const chunks: Buffer[] = [];
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
