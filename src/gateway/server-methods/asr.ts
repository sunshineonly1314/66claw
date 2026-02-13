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

    const format = typeof params.format === "string" ? params.format : "wav";
    const tmpPath = path.join(
      os.tmpdir(),
      `clawdbot-asr-rpc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`,
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
