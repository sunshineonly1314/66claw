/**
 * StringVault: Encrypted storage for sensitive strings
 *
 * All sensitive strings (API URLs, keys, etc.) can be stored
 * encrypted in the binary and decrypted on-demand at runtime.
 * After use, the decrypted buffer is wiped (zeroed).
 */

#include "string_vault.h"

#include <cstring>
#include <random>
#include <chrono>

#ifdef _WIN32
#include <windows.h>
#include <processthreadsapi.h>
#elif defined(__APPLE__)
#include <mach/mach_time.h>
#include <unistd.h>
#else
#include <unistd.h>
#endif

namespace clawdbot {

// ============================================================================
// XOR Encryption/Decryption
// ============================================================================

std::vector<uint8_t> StringVault::encrypt(const std::string& plaintext,
                                           const std::vector<uint8_t>& key) {
  std::vector<uint8_t> result(plaintext.size());
  for (size_t i = 0; i < plaintext.size(); i++) {
    result[i] = static_cast<uint8_t>(plaintext[i]) ^ key[i % key.size()];
  }
  return result;
}

std::string StringVault::decrypt(const std::vector<uint8_t>& encrypted,
                                  const std::vector<uint8_t>& key) {
  std::string result(encrypted.size(), '\0');
  for (size_t i = 0; i < encrypted.size(); i++) {
    result[i] = static_cast<char>(encrypted[i] ^ key[i % key.size()]);
  }
  return result;
}

// ============================================================================
// Secure Memory Wiping
// ============================================================================

void StringVault::wipe(std::string& str) {
  // Use volatile to prevent compiler optimization of the zeroing
  volatile char* p = const_cast<volatile char*>(str.data());
  for (size_t i = 0; i < str.size(); i++) {
    p[i] = '\0';
  }
  str.clear();
}

void StringVault::wipe(std::vector<uint8_t>& vec) {
  volatile uint8_t* p = vec.data();
  for (size_t i = 0; i < vec.size(); i++) {
    p[i] = 0;
  }
  vec.clear();
}

// ============================================================================
// Runtime Key Derivation
// ============================================================================

std::vector<uint8_t> StringVault::deriveRuntimeKey() {
  // Combine multiple entropy sources for the runtime key
  std::vector<uint8_t> key(32);

  // Source 1: High-resolution time
  auto now = std::chrono::high_resolution_clock::now();
  auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(
      now.time_since_epoch()).count();

  // Source 2: Process ID
  uint32_t pid = 0;
#ifdef _WIN32
  pid = static_cast<uint32_t>(GetCurrentProcessId());
#else
  pid = static_cast<uint32_t>(getpid());
#endif

  // Source 3: Compile-time seed (changes with each build)
  const uint8_t compileSeed[] = {
    __TIME__[0], __TIME__[1], __TIME__[3], __TIME__[4],
    __TIME__[6], __TIME__[7], __DATE__[0], __DATE__[1],
  };

  // Mix all sources using a simple PRNG seeded with combined entropy
  uint64_t seed = static_cast<uint64_t>(ns) ^ (static_cast<uint64_t>(pid) << 32);
  for (size_t i = 0; i < sizeof(compileSeed); i++) {
    seed ^= static_cast<uint64_t>(compileSeed[i]) << (i * 8 % 64);
  }

  std::mt19937_64 rng(seed);
  for (size_t i = 0; i < key.size(); i++) {
    key[i] = static_cast<uint8_t>(rng() & 0xFF);
  }

  return key;
}

// ============================================================================
// N-API Exports
// ============================================================================

Napi::Value StringVault::DecryptString(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsBuffer()) {
    Napi::TypeError::New(env, "Expected (encryptedBuffer: Buffer, keyBuffer: Buffer)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  auto encBuf = info[0].As<Napi::Buffer<uint8_t>>();
  auto keyBuf = info[1].As<Napi::Buffer<uint8_t>>();

  std::vector<uint8_t> encrypted(encBuf.Data(), encBuf.Data() + encBuf.Length());
  std::vector<uint8_t> key(keyBuf.Data(), keyBuf.Data() + keyBuf.Length());

  std::string decrypted = decrypt(encrypted, key);

  // Create a Node.js Buffer (not a string) so it can be wiped later
  auto result = Napi::Buffer<char>::Copy(env, decrypted.data(), decrypted.size());

  // Wipe the C++ copies
  wipe(decrypted);
  wipe(encrypted);
  wipe(key);

  return result;
}

Napi::Value StringVault::WipeBuffer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Expected (buffer: Buffer)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  auto buf = info[0].As<Napi::Buffer<uint8_t>>();
  volatile uint8_t* p = buf.Data();
  for (size_t i = 0; i < buf.Length(); i++) {
    p[i] = 0;
  }

  return env.Undefined();
}

} // namespace clawdbot
