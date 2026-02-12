/**
 * Native File Integrity Verification
 *
 * Computes SHA-256 hashes using OpenSSL and compares against
 * hardcoded expected values in the compiled binary.
 */

#include "integrity_check.h"

#include <openssl/evp.h>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <cstdio>

namespace clawdbot {

/**
 * Hardcoded file hashes for critical modules.
 *
 * IMPORTANT: These are populated at build time by
 * scripts/update-native-hashes.ts which reads the integrity-hashes.json
 * and generates a C++ header with the values.
 *
 * For now, we use a runtime approach: the hashes are passed from JS
 * at initialization time and stored in native memory. This is still
 * more secure than a JSON file because:
 * 1. The verification logic itself is in native code (hard to patch)
 * 2. The hash comparison happens in C++ (not patchable JS)
 *
 * Future: embed hashes directly in C++ at build time.
 */

// Internal hash storage (populated from JS at init, locked after first set)
static std::vector<std::pair<std::string, std::string>> g_expectedHashes;
static bool g_hashesLocked = false;

std::string IntegrityCheck::computeFileHash(const std::string& filePath) {
  std::ifstream file(filePath, std::ios::binary);
  if (!file.is_open()) {
    return "";
  }

  EVP_MD_CTX* ctx = EVP_MD_CTX_new();
  if (!ctx) {
    return "";
  }

  if (EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr) != 1) {
    EVP_MD_CTX_free(ctx);
    return "";
  }

  char buffer[8192];
  while (file.read(buffer, sizeof(buffer)) || file.gcount() > 0) {
    if (EVP_DigestUpdate(ctx, buffer, static_cast<size_t>(file.gcount())) != 1) {
      EVP_MD_CTX_free(ctx);
      return "";
    }
  }

  unsigned char hash[EVP_MAX_MD_SIZE];
  unsigned int hashLen = 0;
  if (EVP_DigestFinal_ex(ctx, hash, &hashLen) != 1) {
    EVP_MD_CTX_free(ctx);
    return "";
  }

  EVP_MD_CTX_free(ctx);

  // Convert to hex string
  std::ostringstream oss;
  for (unsigned int i = 0; i < hashLen; i++) {
    oss << std::hex << std::setfill('0') << std::setw(2)
        << static_cast<int>(hash[i]);
  }

  return oss.str();
}

bool IntegrityCheck::verifyFile(const std::string& filePath,
                                 const std::string& expectedHash) {
  std::string actualHash = computeFileHash(filePath);
  if (actualHash.empty()) {
    return false; // File not found or read error
  }
  return actualHash == expectedHash;
}

std::vector<std::string> IntegrityCheck::verifyAll(const std::string& baseDir) {
  std::vector<std::string> tampered;

  for (const auto& [relPath, expectedHash] : g_expectedHashes) {
    std::string fullPath = baseDir;
    // Append path separator if needed
    if (!fullPath.empty() && fullPath.back() != '/' && fullPath.back() != '\\') {
      fullPath += '/';
    }
    fullPath += relPath;

    if (!verifyFile(fullPath, expectedHash)) {
      tampered.push_back(relPath);
    }
  }

  return tampered;
}

// --- N-API Exports ---

Napi::Value IntegrityCheck::ComputeHash(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected (filePath: string)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string filePath = info[0].As<Napi::String>().Utf8Value();
  std::string hash = computeFileHash(filePath);

  if (hash.empty()) {
    return env.Null();
  }
  return Napi::String::New(env, hash);
}

Napi::Value IntegrityCheck::VerifyFile(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Expected (filePath: string, expectedHash: string)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string filePath = info[0].As<Napi::String>().Utf8Value();
  std::string expectedHash = info[1].As<Napi::String>().Utf8Value();

  bool result = verifyFile(filePath, expectedHash);
  return Napi::Boolean::New(env, result);
}

Napi::Value IntegrityCheck::VerifyAll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected (baseDir: string)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  // Optional second argument: array of {path, hash} to set expected hashes.
  // Once set, hashes are locked and cannot be overwritten — prevents an attacker
  // from calling verifyAllIntegrity(baseDir, []) to clear all hashes.
  if (info.Length() >= 2 && info[1].IsArray() && !g_hashesLocked) {
    Napi::Array hashArray = info[1].As<Napi::Array>();
    g_expectedHashes.clear();
    g_expectedHashes.reserve(hashArray.Length());

    for (uint32_t i = 0; i < hashArray.Length(); i++) {
      Napi::Object entry = hashArray.Get(i).As<Napi::Object>();
      std::string path = entry.Get("path").As<Napi::String>().Utf8Value();
      std::string hash = entry.Get("hash").As<Napi::String>().Utf8Value();
      g_expectedHashes.emplace_back(path, hash);
    }

    if (!g_expectedHashes.empty()) {
      g_hashesLocked = true; // Lock: no further modifications allowed
    }
  }

  std::string baseDir = info[0].As<Napi::String>().Utf8Value();
  std::vector<std::string> tampered = verifyAll(baseDir);

  Napi::Array result = Napi::Array::New(env, tampered.size());
  for (size_t i = 0; i < tampered.size(); i++) {
    result.Set(static_cast<uint32_t>(i), Napi::String::New(env, tampered[i]));
  }

  return result;
}

} // namespace clawdbot
