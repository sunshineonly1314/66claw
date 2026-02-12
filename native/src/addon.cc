/**
 * Clawdbot Native Security Addon — N-API Entry Point
 *
 * Registers all native security functions:
 *   - RSA signature verification (OpenSSL-based)
 *   - File integrity checking (SHA-256)
 *   - Anti-debug detection (OS-level)
 *   - String vault (encrypted storage)
 *
 * Build: cd native && node-gyp rebuild
 * Load:  const addon = require('./build/Release/clawdbot_native.node')
 */

#include <napi.h>

#include "rsa_verify.h"
#include "integrity_check.h"
#include "anti_debug.h"
#include "string_vault.h"

/**
 * Module initialization — register all exports
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // --- RSA Verification ---
  exports.Set("verifySignature",
              Napi::Function::New(env, clawdbot::RsaVerify::VerifySignature));
  exports.Set("isRsaKeyConfigured",
              Napi::Function::New(env, clawdbot::RsaVerify::IsKeyConfigured));

  // --- Integrity Check ---
  exports.Set("computeFileHash",
              Napi::Function::New(env, clawdbot::IntegrityCheck::ComputeHash));
  exports.Set("verifyFileIntegrity",
              Napi::Function::New(env, clawdbot::IntegrityCheck::VerifyFile));
  exports.Set("verifyAllIntegrity",
              Napi::Function::New(env, clawdbot::IntegrityCheck::VerifyAll));

  // --- Anti-Debug ---
  exports.Set("isDebuggerPresent",
              Napi::Function::New(env, clawdbot::AntiDebug::IsDebuggerPresent));
  exports.Set("hasSuspiciousParent",
              Napi::Function::New(env, clawdbot::AntiDebug::HasSuspiciousParent));
  exports.Set("detectTimingAnomaly",
              Napi::Function::New(env, clawdbot::AntiDebug::DetectTimingAnomaly));
  exports.Set("nativeAntiDebugFullCheck",
              Napi::Function::New(env, clawdbot::AntiDebug::FullCheck));

  // --- String Vault ---
  exports.Set("decryptString",
              Napi::Function::New(env, clawdbot::StringVault::DecryptString));
  exports.Set("wipeBuffer",
              Napi::Function::New(env, clawdbot::StringVault::WipeBuffer));

  // --- Module Info ---
  exports.Set("NATIVE_VERSION", Napi::String::New(env, "1.0.0"));
  exports.Set("NATIVE_PLATFORM", Napi::String::New(env,
#ifdef _WIN32
    "win32"
#elif defined(__APPLE__)
    "darwin"
#elif defined(__linux__)
    "linux"
#else
    "unknown"
#endif
  ));

  return exports;
}

NODE_API_MODULE(clawdbot_native, Init)
