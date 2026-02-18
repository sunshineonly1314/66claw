use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// State management
pub struct AppState {
    pub sidecar_port: Mutex<Option<u16>>,
}

// Config types
#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub auto_start: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub platform: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub content: String,
    pub timestamp: i64,
}

// Commands that will replace HTTP API calls
#[tauri::command]
pub async fn get_config() -> Result<Config, String> {
    // TODO: Communicate with Node.js sidecar via IPC
    // For now, return mock data
    Ok(Config {
        api_key: None,
        model: Some("claude-sonnet-4".to_string()),
        auto_start: false,
    })
}

#[tauri::command]
pub async fn update_config(config: Config) -> Result<(), String> {
    // TODO: Send to Node.js sidecar
    println!("Updating config: {:?}", config);
    Ok(())
}

#[tauri::command]
pub async fn get_channels() -> Result<Vec<Channel>, String> {
    // TODO: Get from Node.js sidecar
    Ok(vec![])
}

#[tauri::command]
pub async fn send_message(channel_id: String, content: String) -> Result<(), String> {
    // TODO: Send to Node.js sidecar
    println!("Sending message to {}: {}", channel_id, content);
    Ok(())
}

#[tauri::command]
pub async fn get_messages(channel_id: String, limit: Option<u32>) -> Result<Vec<Message>, String> {
    // TODO: Get from Node.js sidecar
    let _ = (channel_id, limit);
    Ok(vec![])
}

#[tauri::command]
pub async fn get_chat_history(channel_id: String) -> Result<Vec<Message>, String> {
    // TODO: Get from Node.js sidecar
    let _ = channel_id;
    Ok(vec![])
}
