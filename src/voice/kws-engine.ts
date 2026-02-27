/**
 * KWS Engine — sherpa-onnx KeywordSpotter singleton wrapper.
 *
 * Lazy-initializes on first use. Runs on CPU with 1 thread.
 * Accepts 16kHz mono Float32 samples via feedAndDecode().
 * Returns detected keyword string or empty string.
 */

import fs from "node:fs";
import path from "node:path";

import { CONFIG_DIR } from "../utils.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("voice/kws");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOICE_MODELS_DIR = path.join(CONFIG_DIR, "voice-models");
const KWS_MODEL_DIR = "sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20";
const ENCODER = "encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx";
const DECODER = "decoder-epoch-13-avg-2-chunk-16-left-64.onnx";
const JOINER = "joiner-epoch-13-avg-2-chunk-16-left-64.int8.onnx";
const TOKENS = "tokens.txt";

// ---------------------------------------------------------------------------
// Lazy sherpa-onnx-node loader
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: external untyped module
type SherpaModule = any;
// biome-ignore lint/suspicious/noExplicitAny: external untyped instance
type KeywordSpotterInstance = any;

let _sherpa: SherpaModule | null = null;
let _kwsInstance: KeywordSpotterInstance | null = null;

function loadSherpa(): SherpaModule {
  if (_sherpa) return _sherpa;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _sherpa = require("sherpa-onnx-node");
    return _sherpa;
  } catch (err) {
    throw new Error(
      `sherpa-onnx-node not installed. Run: npm install sherpa-onnx-node\n${(err as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Keywords file resolution
// ---------------------------------------------------------------------------

function resolveKeywordsFile(): string {
  const candidates = [
    path.join(CONFIG_DIR, "kws-keywords.txt"),
    path.join(import.meta.dirname, "..", "..", "resources", "kws-keywords.txt"),
    path.join(import.meta.dirname, "..", "resources", "kws-keywords.txt"),
    path.join(process.cwd(), "resources", "kws-keywords.txt"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("kws-keywords.txt not found");
}

// ---------------------------------------------------------------------------
// Singleton KeywordSpotter
// ---------------------------------------------------------------------------

function getModelDir(): string {
  return path.join(VOICE_MODELS_DIR, KWS_MODEL_DIR);
}

function getOrCreateKws(): KeywordSpotterInstance {
  if (_kwsInstance) return _kwsInstance;

  const sherpa = loadSherpa();
  const modelDir = getModelDir();
  const keywordsFile = resolveKeywordsFile();

  log.info(`Loading KeywordSpotter from ${modelDir}...`);
  const start = Date.now();

  _kwsInstance = new sherpa.KeywordSpotter({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: path.join(modelDir, ENCODER),
        decoder: path.join(modelDir, DECODER),
        joiner: path.join(modelDir, JOINER),
      },
      tokens: path.join(modelDir, TOKENS),
      numThreads: 1,
      provider: "cpu",
      debug: 0,
    },
    keywordsFile,
    keywordsScore: 1.0,
    keywordsThreshold: 0.25,
  });

  log.info(`KeywordSpotter loaded in ${Date.now() - start}ms`);
  return _kwsInstance;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the KWS model files are present and sherpa-onnx-node is available.
 */
export function isKwsAvailable(): boolean {
  try {
    loadSherpa();
    const dir = getModelDir();
    return (
      fs.existsSync(path.join(dir, ENCODER)) &&
      fs.existsSync(path.join(dir, DECODER)) &&
      fs.existsSync(path.join(dir, JOINER)) &&
      fs.existsSync(path.join(dir, TOKENS))
    );
  } catch {
    return false;
  }
}

/** Per-connection KWS stream handle. */
export type KwsStreamHandle = {
  // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx OnlineStream
  stream: any;
  connId: string;
};

/**
 * Create a new KWS stream for a connection.
 */
export function createKwsStream(connId: string): KwsStreamHandle {
  const kws = getOrCreateKws();
  return { stream: kws.createStream(), connId };
}

/**
 * Feed Float32 samples and check for keyword detection.
 * Returns the detected keyword string, or "" if nothing detected.
 */
export function feedAndDecode(handle: KwsStreamHandle, samples: Float32Array): string {
  const kws = getOrCreateKws();
  handle.stream.acceptWaveform({ sampleRate: 16000, samples });

  while (kws.isReady(handle.stream)) {
    kws.decode(handle.stream);
    const result = kws.getResult(handle.stream);
    if (result.keyword !== "") {
      log.info(`Keyword detected: "${result.keyword}"`);
      kws.reset(handle.stream);
      return result.keyword;
    }
  }
  return "";
}

/**
 * Dispose the singleton KeywordSpotter to free memory.
 */
export function disposeKws(): void {
  if (_kwsInstance) {
    try {
      if (typeof _kwsInstance.free === "function") _kwsInstance.free();
    } catch {
      /* ignore */
    }
    _kwsInstance = null;
    log.info("KeywordSpotter disposed");
  }
}
