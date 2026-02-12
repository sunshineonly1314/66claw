#ifndef CLAWDBOT_RSA_VERIFY_H
#define CLAWDBOT_RSA_VERIFY_H

#include <napi.h>
#include <string>

/**
 * RSA Signature Verification — Native Implementation
 *
 * The RSA-2048 public key is embedded directly in the compiled binary,
 * making it significantly harder to locate and replace compared to
 * a JavaScript string literal.
 *
 * Uses OpenSSL (bundled with Node.js) for cryptographic operations.
 */

namespace clawdbot {

class RsaVerify {
public:
  /**
   * Verify an RSA-SHA256 signature.
   *
   * @param signContent - The content that was signed (UTF-8 string)
   * @param signature   - The signature to verify (base64 encoded)
   * @return true if the signature is valid
   */
  static bool verify(const std::string& signContent,
                     const std::string& signature);

  /**
   * Check if the embedded public key is configured (not a placeholder).
   */
  static bool isKeyConfigured();

  /**
   * Get the public key fingerprint for diagnostics.
   */
  static std::string getKeyFingerprint();

  // --- N-API exports ---
  static Napi::Value VerifySignature(const Napi::CallbackInfo& info);
  static Napi::Value IsKeyConfigured(const Napi::CallbackInfo& info);
};

} // namespace clawdbot

#endif // CLAWDBOT_RSA_VERIFY_H
