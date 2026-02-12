#ifndef CLAWDBOT_INTEGRITY_CHECK_H
#define CLAWDBOT_INTEGRITY_CHECK_H

#include <napi.h>
#include <string>
#include <vector>

/**
 * Native File Integrity Verification
 *
 * Computes SHA-256 hashes of files and compares them against
 * expected values that are hardcoded in the binary.
 *
 * Unlike the JS implementation where hashes are in a JSON file
 * (easily replaced), these hashes live inside compiled C++ code.
 */

namespace clawdbot {

struct FileHashEntry {
  const char* path;
  const char* expectedHash; // hex-encoded SHA-256
};

class IntegrityCheck {
public:
  /**
   * Compute the SHA-256 hash of a file.
   * @param filePath - Absolute path to the file
   * @return Hex-encoded SHA-256 hash, or empty string on error
   */
  static std::string computeFileHash(const std::string& filePath);

  /**
   * Verify a single file against an expected hash.
   */
  static bool verifyFile(const std::string& filePath,
                          const std::string& expectedHash);

  /**
   * Verify all hardcoded critical file hashes.
   * @param baseDir - Base directory (dist/)
   * @return Vector of tampered file paths (empty = all OK)
   */
  static std::vector<std::string> verifyAll(const std::string& baseDir);

  // --- N-API exports ---
  static Napi::Value ComputeHash(const Napi::CallbackInfo& info);
  static Napi::Value VerifyFile(const Napi::CallbackInfo& info);
  static Napi::Value VerifyAll(const Napi::CallbackInfo& info);
};

} // namespace clawdbot

#endif // CLAWDBOT_INTEGRITY_CHECK_H
