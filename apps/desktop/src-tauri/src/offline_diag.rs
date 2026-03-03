//! Offline diagnostics: upload crash logs when Gateway (Node) is down.
//!
//! When the Gateway sidecar is not running, the user cannot use the WebSocket
//! JSON-RPC `log_report.submit` method. This module provides a Rust-native
//! fallback that directly POSTs to the remote server using `reqwest`.
//!
//! Log files are read from `~/.openclawcn/logs/` (crash.log, app.jsonl,
//! desktop-debug.log), truncated to ≤100 KB, basic-sanitized, and submitted
//! to `https://www.obplugins.cn/api/api/v1/log-report/submit`.
//!
//! The ticket code returned by the server is persisted locally so the UI
//! can poll for results even after app restart.

use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};

// ── Constants ────────────────────────────────────────────────────────────────

const REPORT_API_BASE_URL: &str = "https://www.obplugins.cn/api/api/v1/log-report";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_TOTAL_BYTES: usize = 100 * 1024; // 100 KB budget for all log entries
const MAX_READ_PER_FILE: usize = 200 * 1024; // read last 200 KB from each file
const MAX_LOG_ENTRIES: usize = 500;
const USER_AGENT: &str = "OpenClawCN-Desktop/1.0";

// ── State directory helpers ──────────────────────────────────────────────────

fn resolve_state_dir() -> PathBuf {
    if let Ok(val) = std::env::var("OPENCLAWCN_STATE_DIR") {
        let trimmed = val.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    // OPENCLAWCN_HOME is set by init_portable_env() for portable mode
    if let Ok(val) = std::env::var("OPENCLAWCN_HOME") {
        let trimmed = val.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join(".openclawcn");
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openclawcn")
}

fn resolve_logs_dir() -> PathBuf {
    resolve_state_dir().join("logs")
}

/// Read the persisted device ID from `<stateDir>/.device_id`.
/// Returns a placeholder if the file is missing (first run before Gateway).
/// If a fallback ID is generated, it is persisted so the same device always
/// gets the same ID even across restarts.
fn read_device_id() -> String {
    let path = resolve_state_dir().join(".device_id");
    match fs::read_to_string(&path) {
        Ok(id) if id.trim().len() >= 16 => id.trim().to_string(),
        _ => {
            // Fallback: generate a simple hash from hostname + platform
            let hostname = get_hostname();
            let source = format!("{}|{}", hostname, std::env::consts::OS);
            let hash = hex_hash(&source);
            let fallback_id = format!("offline-{}", &hash[..16]);

            // Persist so subsequent calls return the same ID
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&path, &fallback_id);

            fallback_id
        }
    }
}

// ── Log file reading ─────────────────────────────────────────────────────────

/// Read the tail of a log file, returning individual lines.
fn read_tail_lines(path: &Path, max_bytes: usize) -> Vec<String> {
    let mut file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let meta = match file.metadata() {
        Ok(m) => m,
        Err(_) => return Vec::new(),
    };
    let size = meta.len() as usize;
    if size == 0 {
        return Vec::new();
    }

    let start = if size > max_bytes { size - max_bytes } else { 0 };
    if start > 0 {
        let _ = file.seek(SeekFrom::Start(start as u64));
    }

    let read_len = size - start;
    let mut buf = vec![0u8; read_len];
    let bytes_read = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return Vec::new(),
    };
    buf.truncate(bytes_read);

    let text = String::from_utf8_lossy(&buf);
    let mut lines: Vec<String> = text.lines().map(|l| l.to_string()).collect();

    // If we started mid-file, the first line is likely incomplete — drop it.
    if start > 0 && lines.len() > 1 {
        lines.remove(0);
    }

    lines
}

/// Collect log lines from all unified log sources, respecting the byte budget.
fn collect_log_entries() -> Vec<String> {
    let logs_dir = resolve_logs_dir();
    let sources = [
        ("app.jsonl", logs_dir.join("app.jsonl")),
        ("crash.log", logs_dir.join("crash.log")),
        ("desktop-debug.log", logs_dir.join("desktop-debug.log")),
    ];

    let mut all_lines: Vec<String> = Vec::new();

    for (label, path) in &sources {
        let lines = read_tail_lines(path, MAX_READ_PER_FILE);
        if !lines.is_empty() {
            all_lines.push(format!("=== {} ===", label));
            all_lines.extend(lines);
        }
    }

    if all_lines.is_empty() {
        return vec!["[no log data available]".to_string()];
    }

    // Truncate to fit within the byte budget and entry count limit.
    let mut result: Vec<String> = Vec::new();

    // Keep error/fatal lines with higher priority: scan from the end
    // (most recent lines are most valuable for crash diagnostics).
    // Simple strategy: take lines from the end first, then fill from start.
    let mut tail_lines: Vec<String> = Vec::new();
    let mut head_lines: Vec<String> = Vec::new();
    let tail_budget = MAX_TOTAL_BYTES * 7 / 10; // 70% for tail
    let head_budget = MAX_TOTAL_BYTES * 3 / 10; // 30% for head

    // Tail (most recent)
    let mut tail_bytes = 0usize;
    for line in all_lines.iter().rev() {
        let line_bytes = line.len() + 1;
        if tail_bytes + line_bytes > tail_budget {
            break;
        }
        tail_lines.push(line.clone());
        tail_bytes += line_bytes;
    }
    tail_lines.reverse();

    // Head (startup context / section headers)
    let mut head_bytes = 0usize;
    let tail_start_idx = all_lines.len().saturating_sub(tail_lines.len());
    for line in all_lines.iter().take(tail_start_idx) {
        let line_bytes = line.len() + 1;
        if head_bytes + line_bytes > head_budget {
            break;
        }
        head_lines.push(line.clone());
        head_bytes += line_bytes;
    }

    // Combine: head + gap marker + tail
    result.extend(head_lines);
    let head_count = result.len();
    if head_count > 0 && head_count < tail_start_idx {
        let omitted = tail_start_idx - head_count;
        result.push(format!("[...{} lines omitted...]", omitted));
    }
    result.extend(tail_lines);

    // Apply entry count limit
    if result.len() > MAX_LOG_ENTRIES {
        let kept = MAX_LOG_ENTRIES - 1;
        let omitted = result.len() - kept;
        result.truncate(kept);
        result.push(format!("[...{} entries truncated...]", omitted));
    }

    // Basic sanitization: mask obvious secrets in-place
    for line in result.iter_mut() {
        *line = basic_sanitize(line);
    }

    result
}

/// Minimal sanitization for Rust-side upload. Masks common secret patterns.
/// The full 20-pattern sanitization runs on the Node side; this catches
/// the most critical patterns to avoid sending raw API keys in crash logs.
fn basic_sanitize(line: &str) -> String {
    // Pattern 1: API keys / tokens in env-style assignments
    // e.g. OPENAI_API_KEY=sk-abc123... → OPENAI_API_KEY=***
    let mut result = line.to_string();

    // Bearer tokens — loop to handle multiple occurrences
    loop {
        let lower = result.to_lowercase();
        let idx = match lower.find("bearer ") {
            Some(i) => i,
            None => break,
        };
        let start = idx + 7;
        if start >= result.len() {
            break;
        }
        let end = result[start..]
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .map(|i| start + i)
            .unwrap_or(result.len());
        if end <= start + 4 {
            break; // token too short to redact, stop to avoid infinite loop
        }
        result.replace_range(start..end, "***");
    }

    // Key=value patterns for common secret env vars — loop for each prefix.
    // Track search_from to avoid re-matching already-redacted regions.
    for prefix in &[
        "API_KEY=", "api_key=", "SECRET=", "secret=", "TOKEN=", "token=",
        "PASSWORD=", "password=", "APIKEY=", "apikey=",
    ] {
        let mut search_from = 0;
        loop {
            let idx = match result[search_from..].find(prefix) {
                Some(i) => search_from + i,
                None => break,
            };
            let val_start = idx + prefix.len();
            if val_start >= result.len() {
                break;
            }
            let end = result[val_start..]
                .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ',' || c == '}')
                .map(|i| val_start + i)
                .unwrap_or(result.len());
            if end <= val_start {
                // Nothing to redact; skip past this match to avoid infinite loop
                search_from = val_start;
                continue;
            }
            result.replace_range(val_start..end, "***");
            // Advance past the replacement to prevent re-matching "PREFIX=***"
            search_from = val_start + 3; // len("***")
        }
    }

    // sk-... style API keys (OpenAI, Anthropic patterns)
    // Use a simple regex-like scan: find "sk-" followed by 20+ alphanumeric chars.
    // Rebuild the string to avoid borrow issues.
    loop {
        let bytes = result.as_bytes();
        let mut found = None;
        let mut i = 0;
        while i + 3 < bytes.len() {
            if bytes[i] == b's' && bytes[i + 1] == b'k' && bytes[i + 2] == b'-' {
                let start = i + 3;
                let mut end = start;
                while end < bytes.len()
                    && (bytes[end].is_ascii_alphanumeric()
                        || bytes[end] == b'-'
                        || bytes[end] == b'_')
                {
                    end += 1;
                }
                if end - start >= 20 {
                    found = Some((i, end));
                    break;
                }
            }
            i += 1;
        }
        match found {
            Some((sk_start, sk_end)) => {
                let prefix_end = (sk_start + 6).min(result.len());
                let prefix_part = result[sk_start..prefix_end].to_string();
                result = format!("{}{}***{}", &result[..sk_start], prefix_part, &result[sk_end..]);
            }
            None => break,
        }
    }

    result
}

// ── API types ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct SubmitRequest {
    id: String,
    #[serde(rename = "deviceId")]
    device_id: String,
    description: String,
    #[serde(rename = "logEntries")]
    log_entries: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    attachments: Vec<String>,
    context: SubmitContext,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Serialize)]
struct SubmitContext {
    version: String,
    platform: String,
    hostname: String,
    timestamp: String,
}

#[derive(Deserialize)]
struct SubmitResponse {
    success: bool,
    #[serde(rename = "reportId")]
    report_id: Option<String>,
    #[serde(rename = "ticketCode")]
    ticket_code: Option<String>,
    message: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct StatusResponse {
    success: bool,
    report: Option<StatusReport>,
    message: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct StatusReport {
    #[serde(rename = "ticketCode")]
    pub ticket_code: String,
    pub status: String,
    pub description: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub reply: Option<StatusReply>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct StatusReply {
    pub content: String,
    #[serde(rename = "repliedAt")]
    pub replied_at: String,
}

// ── Local ticket persistence ─────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Default)]
struct LocalTicketStore {
    tickets: Vec<LocalTicket>,
}

#[derive(Serialize, Deserialize, Clone)]
struct LocalTicket {
    ticket_code: String,
    report_id: String,
    description: String,
    created_at: String,
    last_status: String,
    reply: Option<StatusReply>,
}

/// Process-level mutex to prevent concurrent ticket store reads/writes.
static TICKET_STORE_LOCK: Mutex<()> = Mutex::new(());

fn ticket_store_path() -> PathBuf {
    resolve_state_dir().join("log-reports").join("offline-tickets.json")
}

fn load_ticket_store() -> LocalTicketStore {
    let path = ticket_store_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => LocalTicketStore::default(),
    }
}

fn save_ticket_store(store: &LocalTicketStore) {
    let path = ticket_store_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, serde_json::to_string_pretty(store).unwrap_or_default());
}

/// Load + mutate + save the ticket store under a lock.
fn with_ticket_store<F, R>(f: F) -> R
where
    F: FnOnce(&mut LocalTicketStore) -> R,
{
    let _guard = TICKET_STORE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut store = load_ticket_store();
    let result = f(&mut store);
    save_ticket_store(&store);
    result
}

// ── Public API (Tauri IPC commands) ──────────────────────────────────────────

/// Result returned to the frontend from `upload_crash_logs`.
#[derive(Serialize)]
pub struct UploadResult {
    pub success: bool,
    pub ticket_code: Option<String>,
    pub message: String,
}

/// Result returned to the frontend from `poll_ticket_status`.
#[derive(Serialize)]
pub struct PollResult {
    pub found: bool,
    pub status: Option<String>,
    pub reply: Option<StatusReply>,
    pub message: String,
}

/// All log sources we care about, ordered by diagnostic priority.
/// Collected from the Node.js gateway source (diagnose.ts, log-truncate.ts).
fn build_log_sources() -> Vec<(&'static str, std::path::PathBuf)> {
    let logs_dir = resolve_logs_dir();
    // Also probe the Tauri desktop log dir (LocalAppData on Windows, ~/Library on macOS)
    let desktop_log_dir = resolve_desktop_log_dir();

    let mut sources: Vec<(&'static str, std::path::PathBuf)> = vec![
        // High-priority: errors most visible here
        ("app.jsonl",           logs_dir.join("app.jsonl")),
        ("crash.log",           logs_dir.join("crash.log")),
        ("gateway.log",         logs_dir.join("gateway.log")),
        ("gateway.err.log",     logs_dir.join("gateway.err.log")),
        // Config / audit
        ("config-audit.jsonl",  logs_dir.join("config-audit.jsonl")),
        // Desktop sidecar debug log
        ("desktop-debug.log",   logs_dir.join("desktop-debug.log")),
        // Agent/session payload logs
        ("anthropic-payload.jsonl", logs_dir.join("anthropic-payload.jsonl")),
        ("raw-stream.jsonl",    logs_dir.join("raw-stream.jsonl")),
    ];

    if let Some(dld) = desktop_log_dir {
        sources.push(("desktop-gateway.log", dld.join("gateway.log")));
    }

    sources
}

/// Resolve the Tauri desktop log dir (platform-specific, may not exist).
fn resolve_desktop_log_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = std::path::PathBuf::from(local_app_data)
                .join("com.clawdbot.cn.desktop")
                .join("logs");
            if p.is_dir() { return Some(p); }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let p = home.join("Library")
                .join("Logs")
                .join("com.clawdbot.cn.desktop");
            if p.is_dir() { return Some(p); }
        }
    }
    None
}

// ── Batch log result (returned to frontend) ───────────────────────────────────

/// Result of a single log batch request.
#[derive(serde::Serialize, Clone)]
pub struct LogBatchResult {
    /// Batch index (0-based), same as the `batch` parameter.
    pub batch: u32,
    /// Total number of batches available across all log sources.
    pub total_batches: u32,
    /// Combined text of this batch (sanitized, from-end of logs).
    pub text: String,
    /// How many bytes of raw log data exist in total across all sources.
    pub total_raw_bytes: u64,
    /// Whether there is a next batch to fetch.
    pub has_more: bool,
    /// Short summary of which files contributed to this batch.
    pub sources_summary: String,
}

/// Get a batch of recent log data for incremental AI analysis.
///
/// Reads all known log sources **from the end** (most recent first),
/// packages up to `BATCH_BYTES` per call, and supports pagination via
/// the `batch` index so the frontend can ask "give me batch 0, then 1, …"
/// until `has_more` is false.
///
/// Batch 0 = most recent BATCH_BYTES of logs (tail of all files)
/// Batch 1 = the preceding BATCH_BYTES, etc.
pub fn get_logs_batch(batch: u32) -> LogBatchResult {
    const BATCH_BYTES: usize = 80 * 1024; // 80 KB per batch
    const MAX_READ_PER_FILE: usize = 512 * 1024; // read up to 512 KB per file

    let sources = build_log_sources();

    // Collect all lines from all sources, prefixed with their source label.
    // We read from the tail of each file so the most recent content dominates.
    let mut all_lines: Vec<String> = Vec::new();
    let mut total_raw_bytes: u64 = 0;
    let mut present_sources: Vec<&str> = Vec::new();

    for (label, path) in &sources {
        let file_size = std::fs::metadata(path)
            .map(|m| m.len())
            .unwrap_or(0);
        if file_size == 0 {
            continue;
        }
        total_raw_bytes += file_size;
        present_sources.push(label);

        let lines = read_tail_lines(path, MAX_READ_PER_FILE);
        if !lines.is_empty() {
            all_lines.push(format!("=== {} ({} KB) ===", label, file_size / 1024));
            for line in lines {
                all_lines.push(basic_sanitize(&line));
            }
        }
    }

    if all_lines.is_empty() {
        return LogBatchResult {
            batch,
            total_batches: 1,
            text: "[无可用日志]".to_string(),
            total_raw_bytes: 0,
            has_more: false,
            sources_summary: String::new(),
        };
    }

    // Build a flat byte buffer from all lines (tail = most recent).
    // We work in reverse so batch 0 always gets the newest content.
    let full_text: String = all_lines.join("\n");
    let full_bytes = full_text.as_bytes();
    let total_len = full_bytes.len();

    let total_batches = ((total_len + BATCH_BYTES - 1) / BATCH_BYTES).max(1) as u32;
    let batch = batch.min(total_batches - 1);

    // Batch 0 = last BATCH_BYTES, batch 1 = preceding BATCH_BYTES, etc.
    let end = total_len.saturating_sub(batch as usize * BATCH_BYTES);
    let start = end.saturating_sub(BATCH_BYTES);

    // Snap to a UTF-8 character boundary (avoid splitting multi-byte chars).
    let start = snap_to_utf8_boundary(full_bytes, start, false);
    let end   = snap_to_utf8_boundary(full_bytes, end,   true);

    let batch_text = String::from_utf8_lossy(&full_bytes[start..end]).to_string();

    // Prepend a brief header so the AI knows where it is.
    let position_hint = if total_batches == 1 {
        "（全部日志）".to_string()
    } else {
        format!(
            "（批次 {}/{}，从日志末尾往前第 {} 批，共约 {} KB 原始日志）",
            batch + 1,
            total_batches,
            batch + 1,
            total_raw_bytes / 1024,
        )
    };

    let sources_summary = present_sources.join(", ");
    let text = format!(
        "=== 日志分析 {} ===\n来源: {}\n\n{}",
        position_hint, sources_summary, batch_text
    );

    LogBatchResult {
        batch,
        total_batches,
        text,
        total_raw_bytes,
        has_more: batch + 1 < total_batches,
        sources_summary,
    }
}

/// Snap byte offset to a valid UTF-8 character boundary.
/// `forward=true`  → move forward until boundary
/// `forward=false` → move backward until boundary
fn snap_to_utf8_boundary(bytes: &[u8], mut pos: usize, forward: bool) -> usize {
    if pos == 0 || pos >= bytes.len() {
        return pos;
    }
    if forward {
        while pos < bytes.len() && (bytes[pos] & 0xC0) == 0x80 { pos += 1; }
    } else {
        while pos > 0 && (bytes[pos] & 0xC0) == 0x80 { pos -= 1; }
    }
    pos
}

/// Get a summary of recent logs suitable for AI-assisted diagnosis.
/// Keeps backward compat with the existing `repair_get_recent_logs` command.
/// Now uses build_log_sources() instead of hardcoded 3 files.
pub fn get_recent_logs_summary() -> String {
    // Reuse the batch mechanism — batch 0 = most recent 80KB.
    // Then filter to error/warn lines to stay within the old ~4KB spirit
    // but use a much more generous 16KB limit so critical errors aren't lost.
    const MAX_SUMMARY_BYTES: usize = 16 * 1024;

    let sources = build_log_sources();
    const MAX_READ_BYTES: usize = 50 * 1024;

    let mut result_lines: Vec<String> = Vec::new();
    let mut total_bytes: usize = 0;

    for (label, path) in &sources {
        let lines = read_tail_lines(path, MAX_READ_BYTES);
        if lines.is_empty() {
            continue;
        }

        // Filter to error/warn/fatal lines (case-insensitive)
        let important: Vec<&String> = lines.iter().filter(|line| {
            let lower = line.to_lowercase();
            lower.contains("error") || lower.contains("warn") || lower.contains("fatal")
                || lower.contains("fail") || lower.contains("crash") || lower.contains("panic")
                || lower.contains("exception")
        }).collect();

        let selected = if important.is_empty() {
            let start = lines.len().saturating_sub(5);
            lines[start..].iter().collect::<Vec<_>>()
        } else {
            let start = important.len().saturating_sub(30);
            important[start..].to_vec()
        };

        if selected.is_empty() {
            continue;
        }

        let header = format!("=== {} ===", label);
        let header_bytes = header.len() + 1;
        if total_bytes + header_bytes > MAX_SUMMARY_BYTES {
            break;
        }
        result_lines.push(header);
        total_bytes += header_bytes;

        for line in selected {
            let sanitized = basic_sanitize(line);
            let line_bytes = sanitized.len() + 1;
            if total_bytes + line_bytes > MAX_SUMMARY_BYTES {
                result_lines.push("[...truncated...]".to_string());
                break;
            }
            result_lines.push(sanitized);
            total_bytes += line_bytes;
        }
    }

    if result_lines.is_empty() {
        return "[无可用日志]".to_string();
    }

    result_lines.join("\n")
}

/// Collect local logs, sanitize, truncate to ≤100KB, and POST to the remote
/// log-report API. This works even when Gateway is down.
///
/// `description`: user-provided problem description (5-2000 chars).
/// `attachments`: optional base64 data-URL encoded screenshots (max 3).
pub async fn upload_crash_logs(
    description: String,
    attachments: Vec<String>,
) -> Result<UploadResult, String> {
    // Validate description (use char count, not byte length, for CJK text)
    let desc = description.trim().to_string();
    if desc.chars().count() < 5 {
        return Ok(UploadResult {
            success: false,
            ticket_code: None,
            message: "问题描述至少需要5个字符".to_string(),
        });
    }

    // Collect and truncate logs
    let log_entries = collect_log_entries();

    // Build request
    let device_id = read_device_id();
    let now = chrono_now_iso();
    let report_id = format!("rpt-offline-{}", &now[..19].replace([':', '-', 'T'], ""));

    // Anonymize hostname: just use first 6 chars of a simple hash
    let hostname_raw = get_hostname();
    let hostname_anon = format!("host-{}", &hex_hash(&hostname_raw)[..6]);

    // Validate & limit attachments (max 3, must start with data:image/)
    let safe_attachments: Vec<String> = attachments
        .into_iter()
        .filter(|a| a.starts_with("data:image/"))
        .take(3)
        .collect();

    let request = SubmitRequest {
        id: report_id.clone(),
        device_id: device_id.clone(),
        description: basic_sanitize(&desc),
        log_entries,
        attachments: safe_attachments,
        context: SubmitContext {
            version: env!("CARGO_PKG_VERSION").to_string(),
            platform: std::env::consts::OS.to_string(),
            hostname: hostname_anon,
            timestamp: now.clone(),
        },
        created_at: now,
    };

    // POST to remote
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .post(&format!("{}/submit", REPORT_API_BASE_URL))
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = response.status();
    let body: SubmitResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if body.success {
        let ticket_code = body.ticket_code.clone().unwrap_or_default();

        // Persist ticket locally (under lock to prevent concurrent corruption)
        if !ticket_code.is_empty() {
            let tc = ticket_code.clone();
            let ri = report_id.clone();
            let dc = desc.clone();
            with_ticket_store(|store| {
                store.tickets.push(LocalTicket {
                    ticket_code: tc,
                    report_id: ri,
                    description: dc,
                    created_at: chrono_now_iso(),
                    last_status: "pending".to_string(),
                    reply: None,
                });
                // Keep at most 20 tickets
                if store.tickets.len() > 20 {
                    store.tickets = store.tickets.split_off(store.tickets.len() - 20);
                }
            });
        }

        Ok(UploadResult {
            success: true,
            ticket_code: Some(ticket_code.clone()),
            message: body.message.unwrap_or_else(|| {
                format!("日志已上传，工单号: {}", ticket_code)
            }),
        })
    } else {
        Ok(UploadResult {
            success: false,
            ticket_code: None,
            message: body.message.unwrap_or_else(|| {
                format!("上传失败 (HTTP {}): {}", status.as_u16(), body.error.unwrap_or_default())
            }),
        })
    }
}

/// Poll the remote server for the status of a previously submitted ticket.
pub async fn poll_ticket_status(ticket_code: String) -> Result<PollResult, String> {
    let code = ticket_code.trim().to_uppercase();
    if code.len() != 6 {
        return Ok(PollResult {
            found: false,
            status: None,
            reply: None,
            message: "请输入6位工单号".to_string(),
        });
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&format!("{}/status", REPORT_API_BASE_URL))
        .query(&[("ticketCode", &code)])
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let body: StatusResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if let Some(report) = body.report {
        // Update local ticket store (under lock to prevent concurrent corruption)
        let status_clone = report.status.clone();
        let reply_clone = report.reply.clone();
        let code_clone = code.clone();
        with_ticket_store(|store| {
            if let Some(ticket) = store.tickets.iter_mut().find(|t| t.ticket_code == code_clone) {
                ticket.last_status = status_clone.clone();
                ticket.reply = reply_clone.clone();
            }
        });

        Ok(PollResult {
            found: true,
            status: Some(report.status),
            reply: report.reply,
            message: "查询成功".to_string(),
        })
    } else {
        Ok(PollResult {
            found: false,
            status: None,
            reply: None,
            message: body.message.unwrap_or_else(|| "未找到该工单".to_string()),
        })
    }
}

/// Get all locally stored ticket codes (for the offline diagnostics UI).
pub fn get_local_tickets() -> Vec<serde_json::Value> {
    let _guard = TICKET_STORE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let store = load_ticket_store();
    store
        .tickets
        .iter()
        .rev() // newest first
        .map(|t| {
            serde_json::json!({
                "ticketCode": t.ticket_code,
                "description": t.description,
                "createdAt": t.created_at,
                "status": t.last_status,
                "hasReply": t.reply.is_some(),
            })
        })
        .collect()
}

// ── Utility functions ────────────────────────────────────────────────────────

fn chrono_now_iso() -> String {
    // Simple ISO 8601 timestamp without chrono crate dependency
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.subsec_millis();

    // Convert to UTC date-time components
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Simple day-count to Y-M-D (good enough for timestamps, not calendar math)
    let (year, month, day) = days_to_ymd(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, month, day, hours, minutes, seconds, millis
    )
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from https://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Cross-platform hostname retrieval without extra crate dependencies.
fn get_hostname() -> String {
    // Try COMPUTERNAME (Windows) then HOSTNAME (Unix)
    if let Ok(name) = std::env::var("COMPUTERNAME") {
        if !name.is_empty() {
            return name;
        }
    }
    if let Ok(name) = std::env::var("HOSTNAME") {
        if !name.is_empty() {
            return name;
        }
    }
    "unknown".to_string()
}

fn hex_hash(input: &str) -> String {
    // Simple non-crypto hash for hostname anonymization
    let mut hash: u64 = 0xcbf29ce484222325; // FNV-1a offset basis
    for b in input.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3); // FNV-1a prime
    }
    format!("{:016x}", hash)
}
