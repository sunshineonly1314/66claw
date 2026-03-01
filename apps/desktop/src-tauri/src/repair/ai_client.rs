//! Minimal AI chat client for the repair assistant.
//!
//! Supports OpenAI-compatible and Anthropic Messages API with SSE streaming.
//! Streams tokens to the frontend via Tauri `app.emit("repair-ai-token")`.

use std::time::Duration;

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::provider_discovery::{ApiType, DiscoveredProvider};

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct TokenPayload {
    pub text: String,
    pub done: bool,
    pub error: Option<String>,
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    max_tokens: u32,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<ChatMessage>,
    system: String,
    stream: bool,
    max_tokens: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize)]
struct OpenAiStreamChunk {
    choices: Option<Vec<OpenAiChoice>>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    delta: Option<OpenAiDelta>,
}

#[derive(Deserialize)]
struct OpenAiDelta {
    content: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    delta: Option<AnthropicDelta>,
}

#[derive(Deserialize)]
struct AnthropicDelta {
    #[serde(rename = "type")]
    _delta_type: Option<String>,
    text: Option<String>,
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT: &str = r#"你是 ClawdbotCN 桌面应用的检修助手。用户的 Gateway (Node.js) 服务无法启动或已崩溃。

你会收到以下诊断信息：
1. 系统信息（操作系统、内存、磁盘空间）
2. 自动诊断结果（文件检查、配置验证、权限检查等）
3. 最近的日志摘要
4. 用户描述的问题

基于这些信息，请：
- 分析可能的故障原因（简洁明了）
- 提供具体的修复步骤
- 如果可以自动修复，用 [FIX:fix_id] 标记

可用的自动修复操作：
- [FIX:restart_service] 重启 Gateway 服务
- [FIX:kill_stale_port] 释放被占用的端口
- [FIX:clear_gateway_locks] 清理残留锁文件
- [FIX:clear_cache] 清除缓存和临时文件
- [FIX:repair_config_syntax] 修复配置文件格式
- [FIX:repair_permissions] 修复目录权限
- [FIX:reset_auth_profiles] 重置认证配置
- [FIX:open_state_dir] 打开状态目录
- [FIX:run_doctor] 运行 openclawcn doctor 全面自检修复（配置迁移、认证修复、Gateway 修复等 20+ 项检查）

使用中文回复。回复要简洁实用，不要过于冗长。"#;

// ── Streaming chat ───────────────────────────────────────────────────────────

/// Send a streaming chat request to an AI provider.
/// Tokens are pushed to the frontend via `app.emit("repair-ai-token", ...)`.
pub async fn stream_chat(
    app: &AppHandle,
    provider: &DiscoveredProvider,
    user_message: &str,
    context: &str,
) -> Result<(), String> {
    // Build the full user message with context
    let full_message = if context.is_empty() {
        user_message.to_string()
    } else {
        format!("{}\n\n---\n诊断上下文:\n{}", user_message, context)
    };

    match &provider.api_type {
        ApiType::OpenAiCompat => {
            stream_openai_compat(app, provider, &full_message).await
        }
        ApiType::AnthropicMessages => {
            stream_anthropic(app, provider, &full_message).await
        }
        ApiType::GoogleGemini => {
            stream_google_gemini(app, provider, &full_message).await
        }
    }
}

async fn stream_openai_compat(
    app: &AppHandle,
    provider: &DiscoveredProvider,
    user_message: &str,
) -> Result<(), String> {
    let url = format!("{}/chat/completions", provider.base_url.trim_end_matches('/'));

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: SYSTEM_PROMPT.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        },
    ];

    let request_body = OpenAiRequest {
        model: provider.default_model.clone(),
        messages,
        stream: true,
        max_tokens: 4096,
    };

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        format!("Bearer {}", provider.api_key).parse().unwrap(),
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );
    for (key, value) in &provider.extra_headers {
        if let (Ok(k), Ok(v)) = (key.parse::<reqwest::header::HeaderName>(), value.parse()) {
            headers.insert(k, v);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP 客户端错误: {}", e))?;

    let response = client
        .post(&url)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("AI 服务连接失败: {}", e);
            let _ = app.emit("repair-ai-token", TokenPayload {
                text: String::new(), done: true, error: Some(msg.clone()),
            });
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = format!("AI 服务返回错误 ({}): {}", status, truncate_str(&body, 200));
        let _ = app.emit("repair-ai-token", TokenPayload {
            text: String::new(), done: true, error: Some(msg.clone()),
        });
        return Err(msg);
    }

    // Parse SSE stream
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("流式读取中断: {}", e);
                let _ = app.emit("repair-ai-token", TokenPayload {
                    text: String::new(), done: true, error: Some(msg),
                });
                return Ok(()); // already emitted done:true with error
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    let _ = app.emit("repair-ai-token", TokenPayload {
                        text: String::new(), done: true, error: None,
                    });
                    return Ok(());
                }

                if let Ok(parsed) = serde_json::from_str::<OpenAiStreamChunk>(data) {
                    if let Some(content) = parsed.choices
                        .and_then(|c| c.into_iter().next())
                        .and_then(|c| c.delta)
                        .and_then(|d| d.content)
                    {
                        if !content.is_empty() {
                            let _ = app.emit("repair-ai-token", TokenPayload {
                                text: content, done: false, error: None,
                            });
                        }
                    }
                }
            }
        }
    }

    // Final done signal (stream ended without [DONE] marker)
    let _ = app.emit("repair-ai-token", TokenPayload {
        text: String::new(), done: true, error: None,
    });

    Ok(())
}

async fn stream_anthropic(
    app: &AppHandle,
    provider: &DiscoveredProvider,
    user_message: &str,
) -> Result<(), String> {
    let url = format!("{}/v1/messages", provider.base_url.trim_end_matches('/'));

    let messages = vec![
        ChatMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        },
    ];

    let request_body = AnthropicRequest {
        model: provider.default_model.clone(),
        messages,
        system: SYSTEM_PROMPT.to_string(),
        stream: true,
        max_tokens: 4096,
    };

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("x-api-key", provider.api_key.parse().unwrap());
    headers.insert("anthropic-version", "2023-06-01".parse().unwrap());
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );
    for (key, value) in &provider.extra_headers {
        if let (Ok(k), Ok(v)) = (key.parse::<reqwest::header::HeaderName>(), value.parse()) {
            headers.insert(k, v);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP 客户端错误: {}", e))?;

    let response = client
        .post(&url)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("AI 服务连接失败: {}", e);
            let _ = app.emit("repair-ai-token", TokenPayload {
                text: String::new(), done: true, error: Some(msg.clone()),
            });
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = format!("AI 服务返回错误 ({}): {}", status, truncate_str(&body, 200));
        let _ = app.emit("repair-ai-token", TokenPayload {
            text: String::new(), done: true, error: Some(msg.clone()),
        });
        return Err(msg);
    }

    // Parse SSE stream (Anthropic format)
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("流式读取中断: {}", e);
                let _ = app.emit("repair-ai-token", TokenPayload {
                    text: String::new(), done: true, error: Some(msg),
                });
                return Ok(()); // already emitted done:true with error
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(event) = serde_json::from_str::<AnthropicStreamEvent>(data) {
                    // Handle content_block_delta events
                    if event.event_type.as_deref() == Some("content_block_delta")
                        || event.delta.is_some()
                    {
                        if let Some(text) = event.delta.and_then(|d| d.text) {
                            if !text.is_empty() {
                                let _ = app.emit("repair-ai-token", TokenPayload {
                                    text, done: false, error: None,
                                });
                            }
                        }
                    }

                    // message_stop or message_delta with stop_reason
                    if event.event_type.as_deref() == Some("message_stop") {
                        let _ = app.emit("repair-ai-token", TokenPayload {
                            text: String::new(), done: true, error: None,
                        });
                        return Ok(());
                    }
                }
            }
        }
    }

    // Final done signal (stream ended without message_stop)
    let _ = app.emit("repair-ai-token", TokenPayload {
        text: String::new(), done: true, error: None,
    });

    Ok(())
}

// ── Google Gemini types ───────────────────────────────────────────────────────

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "systemInstruction")]
    system_instruction: GeminiContent,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiStreamChunk {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiResponseContent>,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    parts: Option<Vec<GeminiResponsePart>>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: Option<String>,
}

async fn stream_google_gemini(
    app: &AppHandle,
    provider: &DiscoveredProvider,
    user_message: &str,
) -> Result<(), String> {
    let base = provider.base_url.trim_end_matches('/');
    let url = format!(
        "{}/models/{}:streamGenerateContent?alt=sse",
        base, provider.default_model
    );

    let request_body = GeminiRequest {
        contents: vec![GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart {
                text: user_message.to_string(),
            }],
        }],
        system_instruction: GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart {
                text: SYSTEM_PROMPT.to_string(),
            }],
        },
    };

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );
    // Google Gemini uses x-goog-api-key for authentication
    if let Ok(val) = provider.api_key.parse() {
        headers.insert("x-goog-api-key", val);
    }
    for (key, value) in &provider.extra_headers {
        if let (Ok(k), Ok(v)) = (key.parse::<reqwest::header::HeaderName>(), value.parse()) {
            headers.insert(k, v);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP 客户端错误: {}", e))?;

    let response = client
        .post(&url)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("AI 服务连接失败: {}", e);
            let _ = app.emit("repair-ai-token", TokenPayload {
                text: String::new(), done: true, error: Some(msg.clone()),
            });
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = format!("AI 服务返回错误 ({}): {}", status, truncate_str(&body, 200));
        let _ = app.emit("repair-ai-token", TokenPayload {
            text: String::new(), done: true, error: Some(msg.clone()),
        });
        return Err(msg);
    }

    // Parse SSE stream (Gemini format)
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("流式读取中断: {}", e);
                let _ = app.emit("repair-ai-token", TokenPayload {
                    text: String::new(), done: true, error: Some(msg),
                });
                return Ok(()); // already emitted done:true with error
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(parsed) = serde_json::from_str::<GeminiStreamChunk>(data) {
                    if let Some(text) = parsed.candidates
                        .and_then(|c| c.into_iter().next())
                        .and_then(|c| c.content)
                        .and_then(|c| c.parts)
                        .and_then(|p| p.into_iter().next())
                        .and_then(|p| p.text)
                    {
                        if !text.is_empty() {
                            let _ = app.emit("repair-ai-token", TokenPayload {
                                text, done: false, error: None,
                            });
                        }
                    }
                }
            }
        }
    }

    // Final done signal (stream ended normally)
    let _ = app.emit("repair-ai-token", TokenPayload {
        text: String::new(), done: true, error: None,
    });

    Ok(())
}

fn truncate_str(s: &str, max_chars: usize) -> String {
    let mut char_count = 0;
    let mut byte_end = s.len();
    for (idx, _) in s.char_indices() {
        if char_count >= max_chars {
            byte_end = idx;
            break;
        }
        char_count += 1;
    }
    if char_count <= max_chars && byte_end == s.len() {
        s.to_string()
    } else {
        format!("{}...", &s[..byte_end])
    }
}

/// Parse a single SSE data line in OpenAI format and return extracted content token.
#[cfg(test)]
fn parse_openai_sse_data(data: &str) -> Option<String> {
    if data.trim() == "[DONE]" {
        return None;
    }
    let parsed: OpenAiStreamChunk = serde_json::from_str(data).ok()?;
    parsed.choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.delta)
        .and_then(|d| d.content)
        .filter(|s| !s.is_empty())
}

/// Parse a single SSE data line in Anthropic format and return extracted text token.
#[cfg(test)]
fn parse_anthropic_sse_data(data: &str) -> Option<String> {
    let event: AnthropicStreamEvent = serde_json::from_str(data).ok()?;
    if event.event_type.as_deref() == Some("content_block_delta") || event.delta.is_some() {
        return event.delta.and_then(|d| d.text).filter(|s| !s.is_empty());
    }
    None
}

/// Check if an Anthropic SSE data line signals message completion.
#[cfg(test)]
fn is_anthropic_message_stop(data: &str) -> bool {
    if let Ok(event) = serde_json::from_str::<AnthropicStreamEvent>(data) {
        return event.event_type.as_deref() == Some("message_stop");
    }
    false
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── truncate_str tests ──────────────────────────────────────────

    #[test]
    fn test_truncate_str_short() {
        assert_eq!(truncate_str("hello", 10), "hello");
        assert_eq!(truncate_str("", 5), "");
    }

    #[test]
    fn test_truncate_str_exact() {
        assert_eq!(truncate_str("hello", 5), "hello");
    }

    #[test]
    fn test_truncate_str_long() {
        assert_eq!(truncate_str("hello world", 5), "hello...");
        assert_eq!(truncate_str("abcdefghij", 3), "abc...");
    }

    #[test]
    fn test_truncate_str_cjk_no_panic() {
        // CJK characters are 3 bytes each in UTF-8.
        // Truncating at char boundary must not panic.
        let cjk = "你好世界测试数据";
        let result = truncate_str(cjk, 4);
        assert_eq!(result, "你好世界...");
    }

    #[test]
    fn test_truncate_str_mixed_cjk_ascii() {
        let mixed = "ab你好cd";
        assert_eq!(truncate_str(mixed, 4), "ab你好...");
    }

    // ── OpenAI SSE parsing tests ────────────────────────────────────

    #[test]
    fn test_parse_openai_sse_content_token() {
        let data = r#"{"choices":[{"delta":{"content":"Hello"},"index":0}]}"#;
        assert_eq!(parse_openai_sse_data(data), Some("Hello".to_string()));
    }

    #[test]
    fn test_parse_openai_sse_empty_content() {
        let data = r#"{"choices":[{"delta":{"content":""},"index":0}]}"#;
        assert_eq!(parse_openai_sse_data(data), None);
    }

    #[test]
    fn test_parse_openai_sse_no_content() {
        // First chunk often has role but no content
        let data = r#"{"choices":[{"delta":{"role":"assistant"},"index":0}]}"#;
        assert_eq!(parse_openai_sse_data(data), None);
    }

    #[test]
    fn test_parse_openai_sse_done() {
        assert_eq!(parse_openai_sse_data("[DONE]"), None);
    }

    #[test]
    fn test_parse_openai_sse_invalid_json() {
        assert_eq!(parse_openai_sse_data("not json"), None);
    }

    #[test]
    fn test_parse_openai_sse_empty_choices() {
        let data = r#"{"choices":[]}"#;
        assert_eq!(parse_openai_sse_data(data), None);
    }

    #[test]
    fn test_parse_openai_sse_null_choices() {
        let data = r#"{"choices":null}"#;
        assert_eq!(parse_openai_sse_data(data), None);
    }

    #[test]
    fn test_parse_openai_sse_chinese_content() {
        let data = r#"{"choices":[{"delta":{"content":"你好"},"index":0}]}"#;
        assert_eq!(parse_openai_sse_data(data), Some("你好".to_string()));
    }

    #[test]
    fn test_parse_openai_sse_fix_marker() {
        let data = r#"{"choices":[{"delta":{"content":"[FIX:restart_service]"},"index":0}]}"#;
        assert_eq!(parse_openai_sse_data(data), Some("[FIX:restart_service]".to_string()));
    }

    // ── Anthropic SSE parsing tests ─────────────────────────────────

    #[test]
    fn test_parse_anthropic_content_block_delta() {
        let data = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}"#;
        assert_eq!(parse_anthropic_sse_data(data), Some("Hello".to_string()));
    }

    #[test]
    fn test_parse_anthropic_empty_text() {
        let data = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":""}}"#;
        assert_eq!(parse_anthropic_sse_data(data), None);
    }

    #[test]
    fn test_parse_anthropic_message_start() {
        let data = r#"{"type":"message_start","message":{"id":"msg_01","role":"assistant"}}"#;
        // message_start has no delta, should return None
        assert_eq!(parse_anthropic_sse_data(data), None);
    }

    #[test]
    fn test_anthropic_message_stop_detection() {
        assert!(is_anthropic_message_stop(r#"{"type":"message_stop"}"#));
        assert!(!is_anthropic_message_stop(r#"{"type":"content_block_delta"}"#));
        assert!(!is_anthropic_message_stop("invalid json"));
    }

    // ── SYSTEM_PROMPT validation ────────────────────────────────────

    #[test]
    fn test_system_prompt_contains_all_fix_ids() {
        let fix_ids = [
            "restart_service", "kill_stale_port", "clear_gateway_locks",
            "clear_cache", "repair_config_syntax", "repair_permissions",
            "reset_auth_profiles", "open_state_dir", "run_doctor",
        ];
        for fix_id in &fix_ids {
            assert!(
                SYSTEM_PROMPT.contains(fix_id),
                "SYSTEM_PROMPT should mention fix ID: {}",
                fix_id
            );
        }
    }

    #[test]
    fn test_system_prompt_uses_chinese() {
        assert!(SYSTEM_PROMPT.contains("中文"), "SYSTEM_PROMPT should instruct Chinese replies");
    }

    // ── ChatMessage serialization ───────────────────────────────────

    #[test]
    fn test_chat_message_roundtrip() {
        let msg = ChatMessage {
            role: "user".to_string(),
            content: "测试消息".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: ChatMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.role, "user");
        assert_eq!(deserialized.content, "测试消息");
    }

    // ── TokenPayload serialization ──────────────────────────────────

    #[test]
    fn test_token_payload_serialize() {
        let payload = TokenPayload {
            text: "hello".to_string(),
            done: false,
            error: None,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"text\":\"hello\""));
        assert!(json.contains("\"done\":false"));
        assert!(json.contains("\"error\":null"));
    }

    #[test]
    fn test_token_payload_with_error() {
        let payload = TokenPayload {
            text: String::new(),
            done: true,
            error: Some("连接失败".to_string()),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"done\":true"));
        assert!(json.contains("连接失败"));
    }

    // ── Request body serialization ──────────────────────────────────

    #[test]
    fn test_openai_request_serialization() {
        let req = OpenAiRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                ChatMessage { role: "system".into(), content: "test".into() },
                ChatMessage { role: "user".into(), content: "hello".into() },
            ],
            stream: true,
            max_tokens: 4096,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"model\":\"deepseek-chat\""));
        assert!(json.contains("\"stream\":true"));
        assert!(json.contains("\"max_tokens\":4096"));
    }

    #[test]
    fn test_anthropic_request_serialization() {
        let req = AnthropicRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            messages: vec![
                ChatMessage { role: "user".into(), content: "hello".into() },
            ],
            system: "你是助手".to_string(),
            stream: true,
            max_tokens: 4096,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"system\":"));
        assert!(json.contains("\"stream\":true"));
    }
}
