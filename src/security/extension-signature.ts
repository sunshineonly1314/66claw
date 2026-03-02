/**
 * Extension Signature Verification (MED-07)
 *
 * Uses Ed25519 to verify that extension packages were built and signed
 * by the OpenClawCN CI pipeline. Prevents supply-chain tampering of
 * extension JS files between build and installation.
 *
 * Flow:
 *   1. CI runs `compile-extensions.ts` → produces clean JS + manifest
 *   2. CI signs the manifest with OPENCLAWCN_EXTENSION_SIGNING_KEY (Ed25519 private key)
 *   3. Signature is stored in extension-build-manifest.json
 *   4. At install/load time, `verifyExtensionSignature()` checks the signature
 *      against the embedded public key
 *
 * Key management:
 *   - Private key: OPENCLAWCN_EXTENSION_SIGNING_KEY env var (base64, CI-only)
 *   - Public key: Embedded in this file (safe to distribute)
 *   - Generate keypair: `node --import tsx src/security/extension-signature.ts --generate-keypair`
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ── Embedded public key ─────────────────────────────────────────────────────
// This is the Ed25519 public key used to verify extension signatures.
// The corresponding private key is stored in CI secrets only.
//
// To regenerate: node --import tsx src/security/extension-signature.ts --generate-keypair
//
// IMPORTANT: Replacing this key requires re-signing all extension manifests.
// [HIGH FIX] In production builds, never read public key from env var.
// Attacker could set OPENCLAWCN_EXTENSION_SIGNING_PUBLIC_KEY to their own key
// and sign malicious extensions, or set it to "" to disable verification entirely.
// Env var override is only allowed in dev builds for testing convenience.
const _isDevBuildExtSig = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;
const EXTENSION_SIGNING_PUBLIC_KEY_B64 = _isDevBuildExtSig
  ? (process.env.OPENCLAWCN_EXTENSION_SIGNING_PUBLIC_KEY ?? "")
  : // Production: hardcoded key only (placeholder until real key is generated and deployed)
    "";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExtensionManifest {
  $comment?: string;
  generatedAt?: string;
  esbuildTarget?: string;
  files: Record<string, string>; // relative path → SHA256 hash
  signature?: string; // Ed25519 signature of the canonical files payload
}

export interface SignatureVerifyResult {
  valid: boolean;
  reason?: string;
}

// ── Canonical payload ───────────────────────────────────────────────────────

/**
 * Build the canonical payload for signing/verification.
 * Deterministic: sorted keys, no whitespace, UTF-8.
 */
function buildCanonicalPayload(files: Record<string, string>): string {
  const sorted = Object.keys(files).sort();
  const entries = sorted.map((k) => `${k}:${files[k]}`);
  return entries.join("\n");
}

// ── Signing (CI-only) ───────────────────────────────────────────────────────

/**
 * Sign an extension build manifest using the Ed25519 private key.
 * Only called during CI builds when OPENCLAWCN_EXTENSION_SIGNING_KEY is set.
 *
 * @param manifest The manifest with `files` populated
 * @returns The base64-encoded signature, or null if no signing key is available
 */
export function signManifest(manifest: ExtensionManifest): string | null {
  const privateKeyB64 = process.env.OPENCLAWCN_EXTENSION_SIGNING_KEY;
  if (!privateKeyB64) {
    return null;
  }

  const payload = buildCanonicalPayload(manifest.files);
  const privateKeyDer = Buffer.from(privateKeyB64, "base64");
  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto.sign(null, Buffer.from(payload, "utf-8"), privateKey);
  return signature.toString("base64");
}

// ── Verification (runtime) ──────────────────────────────────────────────────

/**
 * Verify a signed extension build manifest.
 *
 * @param manifest The manifest with `files` and `signature` fields
 * @returns Verification result
 */
export function verifyManifestSignature(manifest: ExtensionManifest): SignatureVerifyResult {
  if (!manifest.signature) {
    return { valid: false, reason: "No signature in manifest" };
  }

  if (!EXTENSION_SIGNING_PUBLIC_KEY_B64) {
    // [HIGH FIX] In production builds, missing public key = fail-closed.
    // Prevents attackers from bypassing signature verification by clearing the key.
    if (_isDevBuildExtSig) {
      return { valid: true, reason: "No public key configured (dev mode)" };
    }
    return { valid: false, reason: "No signing public key configured in production build" };
  }

  try {
    const publicKeyDer = Buffer.from(EXTENSION_SIGNING_PUBLIC_KEY_B64, "base64");
    const publicKey = crypto.createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });

    const payload = buildCanonicalPayload(manifest.files);
    const signatureBuffer = Buffer.from(manifest.signature, "base64");

    const valid = crypto.verify(null, Buffer.from(payload, "utf-8"), publicKey, signatureBuffer);

    return valid ? { valid: true } : { valid: false, reason: "Signature verification failed" };
  } catch (error) {
    return {
      valid: false,
      reason: `Signature check error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ── File-level verification ─────────────────────────────────────────────────

/**
 * Verify a single extension JS file against the signed manifest.
 *
 * @param jsFilePath Absolute path to the .js file
 * @param rootDir Project root directory
 * @returns Verification result with hash details
 */
export function verifyExtensionFile(
  jsFilePath: string,
  rootDir: string,
  manifest: ExtensionManifest,
): SignatureVerifyResult {
  const relPath = path.relative(rootDir, jsFilePath).replace(/\\/g, "/");

  const expectedHash = manifest.files[relPath];
  if (!expectedHash) {
    return { valid: false, reason: `File not in manifest: ${relPath}` };
  }

  if (!fs.existsSync(jsFilePath)) {
    return { valid: false, reason: `File does not exist: ${relPath}` };
  }

  const content = fs.readFileSync(jsFilePath, "utf-8");
  const actualHash = crypto.createHash("sha256").update(content, "utf-8").digest("hex");

  if (actualHash !== expectedHash) {
    return {
      valid: false,
      reason: `Hash mismatch for ${relPath}: expected ${expectedHash.slice(0, 12)}…, got ${actualHash.slice(0, 12)}…`,
    };
  }

  return { valid: true };
}

/**
 * Load and verify the extension build manifest from disk.
 *
 * @param rootDir Project root directory
 * @returns The manifest (with signature verified), or null if not found/invalid
 */
export function loadAndVerifyManifest(
  rootDir: string,
): { manifest: ExtensionManifest; signatureResult: SignatureVerifyResult } | null {
  const manifestPath = path.join(rootDir, "config", "extension-build-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest: ExtensionManifest = JSON.parse(raw);
    const signatureResult = manifest.signature
      ? verifyManifestSignature(manifest)
      : { valid: false as const, reason: "Unsigned manifest" };

    return { manifest, signatureResult };
  } catch {
    return null;
  }
}

// ── Keypair generation utility ──────────────────────────────────────────────

function generateKeypair(): void {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" });
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });

  const privateKeyB64 = Buffer.from(privateKeyDer).toString("base64");
  const publicKeyB64 = Buffer.from(publicKeyDer).toString("base64");

  console.log("\n🔑 Ed25519 Keypair Generated for Extension Signing\n");
  console.log("━━━ PRIVATE KEY (CI secret: OPENCLAWCN_EXTENSION_SIGNING_KEY) ━━━");
  console.log(privateKeyB64);
  console.log("\n━━━ PUBLIC KEY (embed in extension-signature.ts) ━━━");
  console.log(publicKeyB64);
  console.log("\n━━━ Instructions ━━━");
  console.log("1. Store the PRIVATE key in your CI/CD secrets as OPENCLAWCN_EXTENSION_SIGNING_KEY");
  console.log(
    "2. Store the PUBLIC key in CI/CD secrets as OPENCLAWCN_EXTENSION_SIGNING_PUBLIC_KEY",
  );
  console.log("3. Run the build pipeline — compile-extensions.ts will auto-sign the manifest");
  console.log("4. Extension verification will use the public key to validate signatures\n");
}

// CLI mode
if (process.argv.includes("--generate-keypair")) {
  generateKeypair();
}
