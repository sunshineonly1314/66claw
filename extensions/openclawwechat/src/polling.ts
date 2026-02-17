/**
 * 轮询服务实现
 *
 * 通过 HTTP Polling 从 ClawChat 桥接服务器获取新消息
 */

import { parseTelegramUpdate } from "./message-parser.js";
import { downloadMedia } from "./media-handler.js";
import { injectMessage } from "./message-injector.js";
import { DEFAULT_CONFIG, BRIDGE_URL } from "./constants.js";

/**
 * 启动轮询服务
 */
export async function startPollingService(ctx: any) {
  const { account, abortSignal, log, deps } = ctx;
  const config = account.config;

  log?.info?.(
    `[${account.accountId}] Starting WeChat MiniProgram polling service`,
  );

  const apiKey = config.apiKey;
  const pollInterval =
    config.pollIntervalMs ?? DEFAULT_CONFIG.pollIntervalMs;
  const debug = config.debug ?? DEFAULT_CONFIG.debug;

  const gatewayConfig = (deps as any)?.config?.gateway || {};
  const gatewayPort = gatewayConfig.port || 18789;
  const gatewayToken = gatewayConfig.auth?.token || "";

  if (debug) {
    log?.info?.(
      `[${account.accountId}] Gateway config: port=${gatewayPort}, token=${gatewayToken ? "***" + gatewayToken.slice(-4) : "NOT FOUND"}`,
    );
  }

  if (!apiKey) {
    throw new Error("API Key not configured");
  }

  let offset = 0;
  let pollingTimer: ReturnType<typeof setTimeout> | null = null;
  let pollCount = 0;
  const encodedAPIKey = apiKey.replace(/:/g, "%3A");

  const poll = async () => {
    if (abortSignal.aborted) {
      log?.info?.(`[${account.accountId}] Polling stopped (aborted)`);
      return;
    }

    pollCount++;
    const pollUrl = `${BRIDGE_URL}/bot${encodedAPIKey}/getUpdates?offset=${offset}&limit=100&timeout=1`;

    if (debug && pollCount % 10 === 0) {
      log?.info?.(
        `[${account.accountId}] Polling #${pollCount}: offset=${offset}`,
      );
    }

    try {
      const response = await fetch(pollUrl, {
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        log?.error?.(
          `[${account.accountId}] Polling failed: HTTP ${response.status} ${response.statusText}`,
        );
        throw new Error(`Polling failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (debug && data.result?.length === 0) {
        log?.info?.(
          `[${account.accountId}] Polling response: ok=${data.ok}, result.length=0`,
        );
      }

      if (!data.ok) {
        log?.error?.(
          `[${account.accountId}] API error: ${data.error_code || "unknown"} - ${data.description || "Unknown error"}`,
        );
        throw new Error(
          `API error: ${data.description || "Unknown error"}`,
        );
      }

      if (data.result && data.result.length > 0) {
        const updates = data.result;
        let maxUpdateId = 0;

        for (const update of updates) {
          const parsedMessage = parseTelegramUpdate(
            update,
            account.accountId,
            log,
          );
          if (!parsedMessage) {
            if (debug) {
              log?.info?.(
                `[${account.accountId}] Skipping update without message: update_id=${update.update_id}, type=${Object.keys(update).join(",")}`,
              );
            }
            continue;
          }

          if (parsedMessage.uploadAPIURL) {
            log?.info?.(
              `[${account.accountId}] Backend provided upload API URL: ${parsedMessage.uploadAPIURL}`,
            );
          } else {
            log?.warn?.(
              `[${account.accountId}] No upload API URL provided for update_id=${parsedMessage.updateId}`,
            );
          }

          try {
            const mediaInfo = await downloadMedia(
              parsedMessage.mediaUrls,
              parsedMessage.mediaTypes,
              account.accountId,
              log,
            );

            await injectMessage(
              {
                openid: parsedMessage.openid,
                updateId: parsedMessage.updateId,
                text: parsedMessage.text,
                mediaUrls: mediaInfo.mediaUrls,
                mediaTypes: parsedMessage.mediaTypes,
                mediaPaths: mediaInfo.mediaPaths,
                uploadAPIURL: parsedMessage.uploadAPIURL,
              },
              {
                accountId: account.accountId,
                bridgeUrl: BRIDGE_URL,
                apiKey,
              },
              log,
            );
          } catch (error) {
            log?.error?.(
              `[${account.accountId}] Failed to process message: update_id=${parsedMessage.updateId}, error=${error}`,
            );
          }

          maxUpdateId = Math.max(maxUpdateId, parsedMessage.updateId);
        }

        if (maxUpdateId > 0) {
          offset = maxUpdateId + 1;

          try {
            const messageIds = updates.map((u: any) => u.update_id);
            await fetch(`${BRIDGE_URL}/bot${encodedAPIKey}/markProcessed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message_ids: messageIds }),
            });
          } catch (error) {
            log?.warn?.(
              `[${account.accountId}] Failed to mark messages as processed: ${error}`,
            );
          }
        }
      }
    } catch (error) {
      log?.error?.(`[${account.accountId}] Polling error: ${error}`);

      if (!abortSignal.aborted) {
        const retryDelay = pollInterval * 5;
        log?.warn?.(
          `[${account.accountId}] Retrying in ${retryDelay}ms...`,
        );
        pollingTimer = setTimeout(poll, retryDelay);
      }
      return;
    }

    if (!abortSignal.aborted) {
      pollingTimer = setTimeout(poll, pollInterval);
    }
  };

  poll();

  return {
    running: true,
    lastStartAt: Date.now(),
    cleanup: () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
        pollingTimer = null;
      }
      log?.info?.(
        `[${account.accountId}] Polling service cleaned up`,
      );
    },
  };
}
