import { getWechatMiniprogramRuntime } from "./runtime.js";
import { resolveMediaPath } from "./media-handler.js";
import { BRIDGE_URL } from "./constants.js";
async function sendReply(payload, openid, updateId, config, accountId, log) {
  const { apiKey } = config;
  if (!apiKey) {
    throw new Error("API Key not configured");
  }
  const mediaUrls = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
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
          log
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
async function sendMedia(mediaSource, caption, openid, updateId, config, accountId, isVideo, isDocument, log) {
  const { apiKey, uploadAPIURL, uploadVideoAPIURL, uploadDocumentAPIURL } = config;
  const isLocalPath = !mediaSource.startsWith("http://") && !mediaSource.startsWith("https://");
  const encodedAPIKey = apiKey.replace(/:/g, "%3A");
  let sendMediaURL;
  let fieldName;
  let defaultFileName;
  if (isVideo) {
    sendMediaURL = uploadVideoAPIURL || `${BRIDGE_URL}/bot${encodedAPIKey}/sendVideo`;
    fieldName = "video";
    defaultFileName = "video.mp4";
  } else if (isDocument) {
    sendMediaURL = uploadDocumentAPIURL || `${BRIDGE_URL}/bot${encodedAPIKey}/sendDocument`;
    fieldName = "document";
    defaultFileName = "document";
  } else {
    sendMediaURL = uploadAPIURL || `${BRIDGE_URL}/bot${encodedAPIKey}/sendPhoto`;
    fieldName = "photo";
    defaultFileName = "image.jpg";
  }
  let response;
  if (isLocalPath) {
    const runtime = getWechatMiniprogramRuntime();
    const resolvedMediaPath = resolveMediaPath(mediaSource);
    const media = await runtime.media.loadWebMedia(resolvedMediaPath);
    const boundary = `----formdata-openclawcn-${Date.now()}`;
    const parts = [];
    const encoder = new TextEncoder();
    const contentType = media.contentType || (isVideo ? "video/mp4" : isDocument ? "application/octet-stream" : "image/jpeg");
    parts.push(encoder.encode(`--${boundary}\r
`));
    parts.push(
      encoder.encode(
        `Content-Disposition: form-data; name="${fieldName}"; filename="${defaultFileName}"\r
`
      )
    );
    parts.push(encoder.encode(`Content-Type: ${contentType}\r
\r
`));
    parts.push(media.buffer);
    parts.push(encoder.encode(`\r
`));
    parts.push(encoder.encode(`--${boundary}\r
`));
    parts.push(
      encoder.encode(
        `Content-Disposition: form-data; name="chat_id"\r
\r
`
      )
    );
    parts.push(encoder.encode(openid));
    parts.push(encoder.encode(`\r
`));
    if (caption) {
      parts.push(encoder.encode(`--${boundary}\r
`));
      parts.push(
        encoder.encode(
          `Content-Disposition: form-data; name="caption"\r
\r
`
        )
      );
      parts.push(encoder.encode(caption));
      parts.push(encoder.encode(`\r
`));
    }
    if (updateId) {
      parts.push(encoder.encode(`--${boundary}\r
`));
      parts.push(
        encoder.encode(
          `Content-Disposition: form-data; name="reply_to_message_id"\r
\r
`
        )
      );
      parts.push(
        encoder.encode(String(parseInt(String(updateId))))
      );
      parts.push(encoder.encode(`\r
`));
    }
    parts.push(encoder.encode(`--${boundary}--\r
`));
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
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      },
      body
    });
  } else {
    const jsonBody = {
      chat_id: openid,
      caption: caption || void 0,
      reply_to_message_id: updateId ? parseInt(String(updateId)) : void 0
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
      body: JSON.stringify(jsonBody)
    });
  }
  if (!response.ok) {
    const errorText = await response.text();
    const mediaTypeName = isVideo ? "video" : isDocument ? "document" : "photo";
    throw new Error(
      `Failed to send ${mediaTypeName}: ${response.status} ${response.statusText}, body=${errorText}`
    );
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`API error: ${data.description || "Unknown error"}`);
  }
}
async function sendText(text, openid, updateId, config, accountId, log) {
  const { apiKey } = config;
  const encodedAPIKey = apiKey.replace(/:/g, "%3A");
  const sendMessageURL = `${BRIDGE_URL}/bot${encodedAPIKey}/sendMessage`;
  const response = await fetch(sendMessageURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: openid,
      text,
      reply_to_message_id: updateId ? parseInt(String(updateId)) : void 0
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`API error: ${data.description || "Unknown error"}`);
  }
}
export {
  sendReply
};
