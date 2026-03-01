/**
 * Volcengine (火山引擎) TTS via WebSocket binary protocol.
 *
 * Uses the 豆包语音合成模型2.0 endpoint.
 * Binary protocol: 4-byte header + 4-byte payload size + payload.
 * Each WebSocket connection supports only one synthesis task.
 *
 * Protocol: wss://openspeech.bytedance.com/api/v1/tts/ws_binary
 * Docs: https://www.volcengine.com/docs/6561/1329505
 */

import crypto from "node:crypto";
import WebSocket from "ws";

// ─── Constants ────────────────────────────────────────────────────────

const VOLCENGINE_TTS_WS_URL = "wss://openspeech.bytedance.com/api/v1/tts/ws_binary";
const CONNECT_TIMEOUT_MS = 8_000;
const SYNTHESIS_TIMEOUT_MS = 30_000;

// ─── Binary protocol helpers ─────────────────────────────────────────

/**
 * Build a binary frame for the Volcengine WebSocket protocol.
 *
 * Header (4 bytes):
 *   Byte 0: (protocol_version << 4) | header_size   → 0x11
 *   Byte 1: (message_type << 4) | message_flags
 *   Byte 2: (serialization << 4) | compression
 *   Byte 3: 0x00 (reserved)
 * Payload size (4 bytes, big-endian uint32)
 * Payload (N bytes)
 */
function buildFrame(
  messageType: number,
  messageFlags: number,
  serialization: number,
  compression: number,
  payload: Buffer,
): Buffer {
  const header = Buffer.alloc(8);
  header[0] = 0x11; // version 1, header size 1 (×4 = 4 bytes)
  header[1] = (messageType << 4) | (messageFlags & 0x0f);
  header[2] = (serialization << 4) | (compression & 0x0f);
  header[3] = 0x00;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

/** Parse a server response frame. */
function parseFrame(data: Buffer): {
  messageType: number;
  flags: number;
  serialization: number;
  compression: number;
  payload: Buffer;
} | null {
  if (data.length < 8) return null;
  const messageType = (data[1]! >> 4) & 0x0f;
  const flags = data[1]! & 0x0f;
  const serialization = (data[2]! >> 4) & 0x0f;
  const compression = data[2]! & 0x0f;
  const payloadSize = data.readUInt32BE(4);
  const headerSize = (data[0]! & 0x0f) * 4;
  const payload = data.subarray(headerSize, headerSize + payloadSize);
  return { messageType, flags, serialization, compression, payload };
}

// ─── Public API ───────────────────────────────────────────────────────

export interface VolcengineTtsParams {
  text: string;
  voice?: string;
  encoding?: string;
  sampleRate?: number;
  speedRatio?: number;
  pitchRatio?: number;
  emotion?: string;
}

/**
 * Synthesize speech using Volcengine TTS WebSocket binary protocol.
 * Returns base64-encoded audio.
 */
export async function volcengineTtsSynthesize(
  params: VolcengineTtsParams,
): Promise<{ audioBase64: string; format: string }> {
  const {
    text,
    voice = "BV405_streaming",
    encoding = "mp3",
    sampleRate = 24000,
    speedRatio = 1.0,
    pitchRatio,
    emotion = "happy",
  } = params;

  // Read from unified credentials store first, then env vars
  let appId: string | undefined;
  let accessToken: string | undefined;
  try {
    const { getVolcengineVoiceCredentialsSync } =
      await import("../../voice/volcengine-credentials.js");
    const creds = getVolcengineVoiceCredentialsSync();
    if (creds) {
      appId = creds.appId;
      accessToken = creds.accessToken;
    }
  } catch {
    /* ignore */
  }
  if (!appId || !accessToken) {
    appId = process.env.VOLC_APP_ID;
    accessToken = process.env.VOLC_ACCESS_TOKEN;
  }
  if (!appId || !accessToken) {
    throw new Error(
      "未配置火山引擎语音凭证 — 请在模型设置 → 豆包 → 语音服务 Tab 中配置 App ID 和 Access Token",
    );
  }

  return new Promise((resolve, reject) => {
    const reqid = crypto.randomUUID();

    let ws: WebSocket;
    try {
      ws = new WebSocket(VOLCENGINE_TTS_WS_URL, {
        headers: {
          "X-Api-App-Key": appId,
          "X-Api-Access-Key": accessToken,
        },
        handshakeTimeout: CONNECT_TIMEOUT_MS,
      });
    } catch (err) {
      reject(new Error(`火山引擎 TTS WebSocket 创建失败: ${(err as Error).message}`));
      return;
    }

    const audioChunks: Buffer[] = [];
    let done = false;

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        ws.close();
        reject(new Error("火山引擎 TTS 合成超时"));
      }
    }, SYNTHESIS_TIMEOUT_MS);

    ws.on("open", () => {
      // Send full_client_request with TTS parameters
      const request: Record<string, unknown> = {
        appid: appId,
        token: accessToken,
        reqid,
        operation: "submit",
        text,
        voice_type: voice,
        encoding,
        sample_rate: sampleRate,
        speed_ratio: speedRatio,
      };
      if (pitchRatio !== undefined) request.pitch_ratio = pitchRatio;
      if (emotion) request.emotion = emotion;

      const jsonBuf = Buffer.from(JSON.stringify(request), "utf8");
      // message_type=1 (full_client_request), flags=0, serialization=1 (JSON), compression=0 (none)
      const frame = buildFrame(0x1, 0x0, 0x1, 0x0, jsonBuf);
      ws.send(frame);
    });

    ws.on("message", (raw) => {
      if (done) return;

      const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
      const frame = parseFrame(data);
      if (!frame) return;

      const { messageType, flags, payload } = frame;

      // Audio response (message_type 0xB)
      if (messageType === 0xb) {
        if (payload.length > 0) {
          audioChunks.push(payload);
        }
        // Check if last chunk: flags bit 1 (0x2) set
        if (flags & 0x2) {
          done = true;
          clearTimeout(timeout);
          ws.close();
          const audioBuf = Buffer.concat(audioChunks);
          resolve({
            audioBase64: audioBuf.toString("base64"),
            format: encoding,
          });
        }
      }

      // Error response (message_type 0xF)
      if (messageType === 0xf) {
        done = true;
        clearTimeout(timeout);
        ws.close();
        let errMsg = "火山引擎 TTS 合成失败";
        try {
          const msg = JSON.parse(payload.toString("utf8"));
          errMsg = msg?.message ?? msg?.error ?? errMsg;
        } catch {
          /* ignore */
        }
        reject(new Error(errMsg));
      }
    });

    ws.on("error", (err) => {
      if (!done) {
        done = true;
        clearTimeout(timeout);
        reject(new Error(`火山引擎 TTS WebSocket 错误: ${err.message}`));
      }
    });

    ws.on("close", () => {
      if (!done) {
        done = true;
        clearTimeout(timeout);
        // If we got audio chunks, return them even if close came before "last" flag
        if (audioChunks.length > 0) {
          const audioBuf = Buffer.concat(audioChunks);
          resolve({
            audioBase64: audioBuf.toString("base64"),
            format: encoding,
          });
        } else {
          reject(new Error("火山引擎 TTS WebSocket 意外断开"));
        }
      }
    });
  });
}
