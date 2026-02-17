/**
 * 回复发送模块
 *
 * 负责将 AI 生成的回复发送回微信用户
 */

import { getWechatMiniprogramRuntime } from "./runtime.js";
import { resolveMediaPath } from "./media-handler.js";
import { BRIDGE_URL } from "./constants.js";

export interface ReplyConfig {
  apiKey: string;
  uploadAPIURL?: string;
  uploadVideoAPIURL?: string;
  uploadDocumentAPIURL?: string;
}

/**
 * 发送回复（媒体和文本）
 */
export async function sendReply(
  payload: {
    text?: string;
    mediaUrls?: string[];
    mediaUrl?: string;
    mediaTypes?: string[];
  },
  openid: string,
  updateId: number | undefined,
  config: ReplyConfig,
  accountId: string,
  log?: { error?: (msg: string) => void },
): Promise<void> {
  const { apiKey } = config;

  if (!apiKey) {
    throw new Error("API Key not configured");
  }

  const mediaUrls =
    payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
  const mediaTypes = payload.mediaTypes || [];
  const text = payload.text ?? "";

  try {
    if (mediaUrls.length > 0) {
      let first = true;
      for (let i = 0; i < mediaUrls.length; i++) {
        const mediaSource = mediaUrls[i];
        const mediaType = mediaTypes[i] || "";
        const caption = first ? text : "";
        first = false;

        const isVideo = mediaType.startsWith("video/");
        const isImage = mediaType.startsWith("image/");
        const isDocument = !isVideo && !isImage;

        await sendMedia(
          mediaSource,
          caption,
          openid,
          updateId,
          config,
          accountId,
          isVideo,
          isDocument,
          log,
        );
      }
    }

    if (text && (mediaUrls.length === 0 || text.length > 1024)) {
      await sendText(text, openid, updateId, config, accountId, log);
    }
  } catch (sendError) {
    log?.error?.(`[${accountId}] Failed to send reply: ${sendError}`);
    throw sendError;
  }
}

/**
 * 发送媒体消息（图片、视频或文档）
 */
async function sendMedia(
  mediaSource: string,
  caption: string,
  openid: string,
  updateId: number | undefined,
  config: ReplyConfig,
  accountId: string,
  isVideo: boolean,
  isDocument: boolean,
  log?: { error?: (msg: string) => void },
): Promise<void> {
  const { apiKey, uploadAPIURL, uploadVideoAPIURL, uploadDocumentAPIURL } =
    config;

  const isLocalPath =
    !mediaSource.startsWith("http://") &&
    !mediaSource.startsWith("https://");

  const encodedAPIKey = apiKey.replace(/:/g, "%3A");
  let sendMediaURL: string;
  let fieldName: string;
  let defaultFileName: string;

  if (isVideo) {
    sendMediaURL =
      uploadVideoAPIURL ||
      `${BRIDGE_URL}/bot${encodedAPIKey}/sendVideo`;
    fieldName = "video";
    defaultFileName = "video.mp4";
  } else if (isDocument) {
    sendMediaURL =
      uploadDocumentAPIURL ||
      `${BRIDGE_URL}/bot${encodedAPIKey}/sendDocument`;
    fieldName = "document";
    defaultFileName = "document";
  } else {
    sendMediaURL =
      uploadAPIURL || `${BRIDGE_URL}/bot${encodedAPIKey}/sendPhoto`;
    fieldName = "photo";
    defaultFileName = "image.jpg";
  }

  let response: Response;

  if (isLocalPath) {
    const runtime = getWechatMiniprogramRuntime();
    const resolvedMediaPath = resolveMediaPath(mediaSource);
    const media = await runtime.media.loadWebMedia(resolvedMediaPath);

    const boundary = `----formdata-openclawcn-${Date.now()}`;
    const parts: Uint8Array[] = [];
    const encoder = new TextEncoder();

    const contentType =
      media.contentType ||
      (isVideo
        ? "video/mp4"
        : isDocument
          ? "application/octet-stream"
          : "image/jpeg");
    parts.push(encoder.encode(`--${boundary}\r\n`));
    parts.push(
      encoder.encode(
        `Content-Disposition: form-data; name="${fieldName}"; filename="${defaultFileName}"\r\n`,
      ),
    );
    parts.push(encoder.encode(`Content-Type: ${contentType}\r\n\r\n`));
    parts.push(media.buffer);
    parts.push(encoder.encode(`\r\n`));

    parts.push(encoder.encode(`--${boundary}\r\n`));
    parts.push(
      encoder.encode(
        `Content-Disposition: form-data; name="chat_id"\r\n\r\n`,
      ),
    );
    parts.push(encoder.encode(openid));
    parts.push(encoder.encode(`\r\n`));

    if (caption) {
      parts.push(encoder.encode(`--${boundary}\r\n`));
      parts.push(
        encoder.encode(
          `Content-Disposition: form-data; name="caption"\r\n\r\n`,
        ),
      );
      parts.push(encoder.encode(caption));
      parts.push(encoder.encode(`\r\n`));
    }

    if (updateId) {
      parts.push(encoder.encode(`--${boundary}\r\n`));
      parts.push(
        encoder.encode(
          `Content-Disposition: form-data; name="reply_to_message_id"\r\n\r\n`,
        ),
      );
      parts.push(
        encoder.encode(String(parseInt(String(updateId)))),
      );
      parts.push(encoder.encode(`\r\n`));
    }

    parts.push(encoder.encode(`--${boundary}--\r\n`));

    const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    response = await fetch(sendMediaURL, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
  } else {
    const jsonBody: Record<string, unknown> = {
      chat_id: openid,
      caption: caption || undefined,
      reply_to_message_id: updateId
        ? parseInt(String(updateId))
        : undefined,
    };

    if (isVideo) {
      jsonBody.video = mediaSource;
    } else if (isDocument) {
      jsonBody.document = mediaSource;
    } else {
      jsonBody.photo = mediaSource;
    }

    response = await fetch(sendMediaURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonBody),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    const mediaTypeName = isVideo
      ? "video"
      : isDocument
        ? "document"
        : "photo";
    throw new Error(
      `Failed to send ${mediaTypeName}: ${response.status} ${response.statusText}, body=${errorText}`,
    );
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`API error: ${data.description || "Unknown error"}`);
  }
}

/**
 * 发送文本消息
 */
async function sendText(
  text: string,
  openid: string,
  updateId: number | undefined,
  config: ReplyConfig,
  accountId: string,
  log?: { error?: (msg: string) => void },
): Promise<void> {
  const { apiKey } = config;

  const encodedAPIKey = apiKey.replace(/:/g, "%3A");
  const sendMessageURL = `${BRIDGE_URL}/bot${encodedAPIKey}/sendMessage`;

  const response = await fetch(sendMessageURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: openid,
      text,
      reply_to_message_id: updateId
        ? parseInt(String(updateId))
        : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`API error: ${data.description || "Unknown error"}`);
  }
}
