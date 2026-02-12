#ifndef CLAWDBOT_STRING_VAULT_H
#define CLAWDBOT_STRING_VAULT_H

#include <napi.h>
#include <string>
#include <vector>
#include <cstdint>

/**
 * StringVault: Encrypted storage for sensitive strings.
 *
 * Strings are stored XOR-encrypted in the binary.
 * At runtime they are decrypted on-demand into a buffer
 * that is wiped (zeroed) after use.
 *
 * The XOR key is derived from a compile-time seed + runtime entropy,
 * making static analysis of the binary insufficient to extract strings.
 */

namespace clawdbot {

class StringVault {
public:
  /**
   * Encrypt a plaintext string with the given key.
   * Used at build time to prepare encrypted blobs.
   */
  static std::vector<uint8_t> encrypt(const std::string& plaintext,
                                       const std::vector<uint8_t>& key);

  /**
   * Decrypt an encrypted blob back to plaintext.
   * Caller must wipe the returned string when done.
   */
  static std::string decrypt(const std::vector<uint8_t>& encrypted,
                              const std::vector<uint8_t>& key);

  /**
   * Securely wipe a string's memory (fill with zeros).
   */
  static void wipe(std::string& str);

  /**
   * Securely wipe a vector's memory.
   */
  static void wipe(std::vector<uint8_t>& vec);

  /**
   * Derive a runtime key from process entropy.
   * Combines compile-time seed with runtime factors.
   */
  static std::vector<uint8_t> deriveRuntimeKey();

  // --- N-API exports ---
  static Napi::Value DecryptString(const Napi::CallbackInfo& info);
  static Napi::Value WipeBuffer(const Napi::CallbackInfo& info);
};

} // namespace clawdbot

#endif // CLAWDBOT_STRING_VAULT_H
