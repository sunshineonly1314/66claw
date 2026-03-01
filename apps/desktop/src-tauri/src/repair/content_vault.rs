//! ENC{...} config field decryption for the repair assistant.
//!
//! Mirrors the TS implementation in `src/security/content-vault.ts`.
//! Key derivation: SHA-256(MachineGuid | "openclawcn-content-vault-v1-aes256")
//! Format: ENC{ base64([16-byte IV] + [AES-256-CBC ciphertext]) }

use std::fs;
use std::sync::Mutex;

use base64::Engine;
use sha2::{Sha256, Digest};

const CONTENT_VAULT_SALT: &str = "openclawcn-content-vault-v1-aes256";
const ENC_PREFIX: &str = "ENC{";
const ENC_SUFFIX: &str = "}";

static CACHED_MACHINE_ID: Mutex<Option<String>> = Mutex::new(None);

/// Check if a string value is an ENC{base64} ciphertext wrapper.
pub fn is_encrypted_value(value: &str) -> bool {
    value.len() > ENC_PREFIX.len() + ENC_SUFFIX.len()
        && value.starts_with(ENC_PREFIX)
        && value.ends_with(ENC_SUFFIX)
}

/// Extract the base64 payload from an ENC{...} wrapper.
fn extract_enc_payload(value: &str) -> &str {
    &value[ENC_PREFIX.len()..value.len() - ENC_SUFFIX.len()]
}

/// Decrypt an ENC{base64} config field value, returning the plaintext string.
/// Returns `None` if decryption fails (wrong machine, corrupted data, etc.).
pub fn decrypt_enc_value(enc_value: &str) -> Option<String> {
    if !is_encrypted_value(enc_value) {
        return None;
    }

    let b64 = base64::engine::general_purpose::STANDARD;
    let payload = extract_enc_payload(enc_value);
    let encrypted = b64.decode(payload).ok()?;

    if encrypted.len() < 17 {
        return None; // Too short: need at least 16-byte IV + 1 byte ciphertext
    }

    let key = derive_key()?;
    let iv = &encrypted[..16];
    let ciphertext = &encrypted[16..];

    decrypt_aes256_cbc(&key, iv, ciphertext)
}

/// Derive the AES-256 key from the machine ID.
/// Key = SHA-256(MachineGuid + "|" + salt)
fn derive_key() -> Option<[u8; 32]> {
    let machine_id = get_machine_id()?;
    let input = format!("{}|{}", machine_id, CONTENT_VAULT_SALT);
    let hash = Sha256::digest(input.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    Some(key)
}

/// AES-256-CBC decryption with PKCS7 padding removal.
fn decrypt_aes256_cbc(key: &[u8; 32], iv: &[u8], ciphertext: &[u8]) -> Option<String> {
    use cbc::cipher::{BlockDecryptMut, KeyIvInit};
    type Aes256CbcDec = cbc::Decryptor<aes_gcm::aes::Aes256>;

    let decryptor = Aes256CbcDec::new_from_slices(key, iv).ok()?;
    let mut buf = ciphertext.to_vec();
    let decrypted = decryptor.decrypt_padded_mut::<cbc::cipher::block_padding::Pkcs7>(&mut buf).ok()?;
    String::from_utf8(decrypted.to_vec()).ok()
}

/// Get the machine ID for key derivation.
/// Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
/// Fallback: ~/.openclawcn/.machine-vault-id
fn get_machine_id() -> Option<String> {
    {
        let cache = CACHED_MACHINE_ID.lock().ok()?;
        if let Some(ref id) = *cache {
            return Some(id.clone());
        }
    }

    let id = read_machine_id_platform()
        .or_else(read_fallback_machine_id)?;

    if let Ok(mut cache) = CACHED_MACHINE_ID.lock() {
        *cache = Some(id.clone());
    }

    Some(id)
}

/// Platform-specific machine ID reading.
#[cfg(target_os = "windows")]
fn read_machine_id_platform() -> Option<String> {
    // Read from Windows registry: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
    let output = std::process::Command::new("reg")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(idx) = line.find("REG_SZ") {
            let value = line[idx + 6..].trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn read_machine_id_platform() -> Option<String> {
    let output = std::process::Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("IOPlatformUUID") {
            // Extract UUID from: "IOPlatformUUID" = "XXXXXXXX-..."
            if let Some(start) = line.rfind('"') {
                let prefix = &line[..start];
                if let Some(begin) = prefix.rfind('"') {
                    let uuid = &line[begin + 1..start];
                    if !uuid.is_empty() {
                        return Some(uuid.to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn read_machine_id_platform() -> Option<String> {
    fs::read_to_string("/etc/machine-id")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn read_machine_id_platform() -> Option<String> {
    None
}

/// Read fallback machine ID from ~/.openclawcn/.machine-vault-id
fn read_fallback_machine_id() -> Option<String> {
    let state_dir = super::resolve_state_dir();
    let fallback_path = state_dir.join(".machine-vault-id");
    let content = fs::read_to_string(&fallback_path).ok()?;
    let trimmed = content.trim().to_string();
    if trimmed.len() >= 32 {
        Some(trimmed)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_encrypted_value() {
        assert!(is_encrypted_value("ENC{dGVzdA==}"));
        assert!(is_encrypted_value("ENC{abc123def456==}"));
        assert!(!is_encrypted_value("ENC{}"));
        assert!(!is_encrypted_value("ENC{}")); // too short
        assert!(!is_encrypted_value("sk-abc123"));
        assert!(!is_encrypted_value(""));
        assert!(!is_encrypted_value("ENC"));
    }

    #[test]
    fn test_extract_enc_payload() {
        assert_eq!(extract_enc_payload("ENC{dGVzdA==}"), "dGVzdA==");
        assert_eq!(extract_enc_payload("ENC{abc}"), "abc");
    }

    #[test]
    fn test_decrypt_non_enc_returns_none() {
        assert!(decrypt_enc_value("sk-abc123").is_none());
        assert!(decrypt_enc_value("plain-text-key").is_none());
    }

    #[test]
    fn test_decrypt_too_short_returns_none() {
        // Base64 of only a few bytes (less than 17 total)
        assert!(decrypt_enc_value("ENC{AAAA}").is_none());
    }

    #[test]
    fn test_decrypt_with_known_key() {
        // This tests the full encryption/decryption roundtrip using a known machine ID.
        // We temporarily set the cached machine ID for testing.
        {
            let mut cache = CACHED_MACHINE_ID.lock().unwrap();
            *cache = Some("test-machine-id-for-unit-tests".to_string());
        }

        // Derive key the same way
        let key = derive_key().unwrap();

        // Encrypt a test value using AES-256-CBC
        use cbc::cipher::{BlockEncryptMut, KeyIvInit};
        type Aes256CbcEnc = cbc::Encryptor<aes_gcm::aes::Aes256>;

        let iv: [u8; 16] = [0x42; 16]; // Fixed IV for test reproducibility
        let plaintext = b"test-api-key-12345";

        let encryptor = Aes256CbcEnc::new_from_slices(&key, &iv).unwrap();

        // PKCS7 pad and encrypt
        let mut buf = vec![0u8; plaintext.len() + 16]; // room for padding
        buf[..plaintext.len()].copy_from_slice(plaintext);
        let encrypted = encryptor
            .encrypt_padded_mut::<cbc::cipher::block_padding::Pkcs7>(&mut buf, plaintext.len())
            .unwrap();

        // Build ENC{base64([IV] + [ciphertext])}
        let mut combined = iv.to_vec();
        combined.extend_from_slice(encrypted);

        let b64 = base64::engine::general_purpose::STANDARD;
        let enc_value = format!("ENC{{{}}}", b64.encode(&combined));

        // Decrypt
        let decrypted = decrypt_enc_value(&enc_value);
        assert_eq!(decrypted, Some("test-api-key-12345".to_string()));

        // Clean up
        {
            let mut cache = CACHED_MACHINE_ID.lock().unwrap();
            *cache = None;
        }
    }
}
