import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { detectInstalledModel, speechToText } from "../../agents/tools/asr-tool.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

export const asrHandlers: GatewayRequestHandlers = {
  /**
   * Check whether an ASR model is installed (filesystem-only, no native module loaded).
   */
  "asr.status": async ({ respond }) => {
    try {
      const model = detectInstalledModel();
      respond(true, {
        available: model !== null,
        model: model?.label ?? null,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Transcribe a base64-encoded audio clip to text.
   * Expects: { audioBase64: string, format?: string }
   */
  "asr.transcribe": async ({ params, respond }) => {
    const audioBase64 = typeof params.audioBase64 === "string" ? params.audioBase64 : "";
    if (!audioBase64) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "audioBase64 is required"));
      return;
    }

    // 10 MB base64 limit (~7.5 MB decoded) — well above 30s 16kHz mono WAV (~960 KB)
    const MAX_BASE64_LENGTH = 10 * 1024 * 1024;
    if (audioBase64.length > MAX_BASE64_LENGTH) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "audioBase64 exceeds 10 MB limit"),
      );
      return;
    }

    const rawFormat = typeof params.format === "string" ? params.format : "wav";
    // Sanitize format to alphanumeric only — prevent path traversal via extension
    const format = rawFormat.replace(/[^a-zA-Z0-9]/g, "") || "wav";
    const tmpPath = path.join(
      os.tmpdir(),
      `openclawcn-asr-rpc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${format}`,
    );

    try {
      // Decode base64 → write temp file
      const buffer = Buffer.from(audioBase64, "base64");
      fs.writeFileSync(tmpPath, buffer);

      // Run speech-to-text
      const result = speechToText(tmpPath);

      if (result.success && result.text != null) {
        respond(true, {
          text: result.text,
          latencyMs: result.latencyMs,
          model: result.model,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "Transcription failed"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore cleanup errors */
      }
    }
  },
};
