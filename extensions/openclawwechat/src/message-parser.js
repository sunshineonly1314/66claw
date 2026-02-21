function parseTelegramUpdate(update, accountId, log) {
  if (!update.message) {
    return null;
  }
  const openid = update.message.from?.username || update.message.from?.id?.toString();
  if (!openid) {
    log?.warn?.(
      `[${accountId}] Skipping message without openid: update_id=${update.update_id}`
    );
    return null;
  }
  const updateId = update.update_id;
  const uploadAPIURL = update.message.chat?.upload_api_url;
  if (!uploadAPIURL) {
    log?.warn?.(
      `[${accountId}] No upload_api_url found in chat object for update_id=${updateId}, chat=${JSON.stringify(update.message.chat)}`
    );
  }
  const mediaUrls = [];
  const mediaTypes = [];
  if (update.message.video) {
    const video = update.message.video;
    if (video.file_id) {
      mediaUrls.push(video.file_id);
      mediaTypes.push(video.mime_type || "video/mp4");
    }
  } else if (update.message.photo && Array.isArray(update.message.photo) && update.message.photo.length > 0) {
    const largestPhoto = update.message.photo[update.message.photo.length - 1];
    if (largestPhoto.file_id) {
      mediaUrls.push(largestPhoto.file_id);
      mediaTypes.push("image/jpeg");
    }
  } else if (update.message.document) {
    const doc = update.message.document;
    const mimeType = doc.mime_type || "";
    if (doc.file_id) {
      mediaUrls.push(doc.file_id);
      mediaTypes.push(mimeType || "application/octet-stream");
    }
  }
  let messageText = update.message.text || "";
  let captionText = update.message.caption || "";
  if (captionText && mediaUrls.length > 0) {
    for (const mediaUrl of mediaUrls) {
      if (captionText.includes(mediaUrl)) {
        captionText = captionText.replace(mediaUrl, "").trim();
        if (captionText === "\n" || captionText === "") {
          captionText = "";
        }
      }
    }
  }
  if (captionText) {
    captionText = captionText.replace(/\[upload_api_url:\s*[^\]]+\]/gi, "").trim();
    captionText = captionText.replace(/\n+/g, "\n").trim();
    if (captionText === "\n" || captionText === "") {
      captionText = "";
    }
  }
  messageText = messageText || captionText;
  const isVideo = mediaTypes.some((type) => type.startsWith("video/"));
  const isImage = mediaTypes.some((type) => type.startsWith("image/"));
  const isDocument = mediaTypes.length > 0 && !isVideo && !isImage;
  return {
    openid,
    updateId,
    text: messageText,
    mediaUrls,
    mediaTypes,
    uploadAPIURL,
    isVideo,
    isDocument
  };
}
export {
  parseTelegramUpdate
};
