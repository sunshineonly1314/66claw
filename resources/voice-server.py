#!/usr/bin/env python3
"""
ClawdBot GPU Voice Server — FastAPI sidecar for ASR and TTS.

Spawned by the Node.js gateway process. Communicates over HTTP on localhost.
Loads models into VRAM on startup, serves transcription and synthesis requests.

Supports:
  - Qwen3-ASR for speech recognition (streaming and one-shot)
  - Qwen3-TTS for one-shot synthesis (/synthesize)
  - CosyVoice2 for streaming synthesis (/stream-tts)

Usage:
    python voice-server.py --port 50100 \
        --asr-model-dir ~/.openclawcn/voice-models/qwen3-asr-0.6b \
        --tts-model-dir ~/.openclawcn/voice-models/qwen3-tts-0.6b \
        --cosyvoice-model-dir ~/.openclawcn/voice-models/CosyVoice2-0.5B

Endpoints:
    GET  /health              → { "asr": bool, "tts": bool }
    POST /transcribe          → { "audio_base64": str } → { "text": str, "latency_ms": float }
    POST /transcribe-pcm      → { "pcm_base64": str }   → { "text": str, "latency_ms": float }
    POST /synthesize           → { "text": str }          → { "audio_base64": str, ... }
    POST /stream-asr/start    → { "language": str? }      → { "session_id": str }
    POST /stream-asr/feed     → { "session_id", "pcm_base64" } → { "text": str, "changed": bool }
    POST /stream-asr/end      → { "session_id" }          → { "text": str }
    POST /shutdown             → graceful shutdown
"""

import argparse
import base64
import io
import logging
import os
import signal
import sys
import time
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("voice-server")

# ---------------------------------------------------------------------------
# Globals (populated at startup)
# ---------------------------------------------------------------------------

asr_model = None
tts_model = None
cosyvoice_model = None
_cosyvoice_model_type = "unknown"  # "sft" or "zero_shot"
asr_ready = False
tts_ready = False
cosyvoice_ready = False

# ---------------------------------------------------------------------------
# Streaming ASR Session State
# ---------------------------------------------------------------------------

STREAM_ASR_SAMPLE_RATE = 16000
STREAM_ASR_SESSION_TIMEOUT_SEC = 30
STREAM_ASR_UNFIXED_CHUNK_NUM = 2
STREAM_ASR_UNFIXED_TOKEN_NUM = 5


class StreamAsrSession:
    """Mutable state for one streaming ASR session."""
    __slots__ = (
        "session_id", "language", "buffer", "audio_accum", "chunk_id",
        "raw_decoded", "prompt_raw", "chunk_size_samples", "created_at",
    )

    def __init__(self, session_id: str, prompt_raw: str, chunk_size_samples: int, language: str):
        import numpy as np
        self.session_id = session_id
        self.language = language
        self.buffer: "np.ndarray" = np.zeros(0, dtype=np.float32)
        self.audio_accum: "np.ndarray" = np.zeros(0, dtype=np.float32)
        self.chunk_id: int = 0
        self.raw_decoded: str = ""
        self.prompt_raw: str = prompt_raw
        self.chunk_size_samples: int = chunk_size_samples
        self.created_at: float = time.time()


stream_asr_sessions: Dict[str, StreamAsrSession] = {}


def _cleanup_expired_sessions() -> None:
    """Remove sessions older than timeout."""
    now = time.time()
    expired = [
        sid for sid, s in stream_asr_sessions.items()
        if now - s.created_at > STREAM_ASR_SESSION_TIMEOUT_SEC
    ]
    for sid in expired:
        stream_asr_sessions.pop(sid, None)
        logger.info(f"Stream ASR session {sid[:8]} expired")


def _stream_generate(session: StreamAsrSession) -> str:
    """
    Run one transformers generate step for the streaming session.
    Replicates qwen_asr streaming_transcribe logic using transformers backend.
    """
    import numpy as np
    import torch
    from qwen_asr.inference.utils import parse_asr_output

    model = asr_model.model
    processor = asr_model.processor
    tokenizer = processor.tokenizer
    device = asr_model.device
    dtype = asr_model.dtype

    # Build prefix with rollback
    prefix = ""
    if session.chunk_id >= STREAM_ASR_UNFIXED_CHUNK_NUM and session.raw_decoded:
        cur_ids = tokenizer.encode(session.raw_decoded)
        k = STREAM_ASR_UNFIXED_TOKEN_NUM
        while True:
            end_idx = max(0, len(cur_ids) - k)
            prefix = tokenizer.decode(cur_ids[:end_idx]) if end_idx > 0 else ""
            if '\ufffd' not in prefix:
                break
            if end_idx == 0:
                prefix = ""
                break
            k += 1

    prompt = session.prompt_raw + prefix

    inputs = processor(
        text=[prompt], audio=[session.audio_accum],
        return_tensors="pt", padding=True,
    )
    inputs = inputs.to(device).to(dtype)

    try:
        with torch.no_grad():
            output = model.generate(**inputs, max_new_tokens=512)
    except RuntimeError as e:
        if "CUDA out of memory" in str(e) or "OutOfMemoryError" in str(e):
            logger.error(f"CUDA OOM in streaming ASR, clearing cache: {e}")
            torch.cuda.empty_cache()
            # Return last known text rather than crashing
            if session.raw_decoded:
                _lang, text = parse_asr_output(session.raw_decoded, user_language=session.language)
                return text
            return ""
        raise

    decoded = processor.batch_decode(
        output.sequences[:, inputs["input_ids"].shape[1]:],
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )
    gen_text = decoded[0]

    session.raw_decoded = (prefix + gen_text) if prefix else gen_text
    _lang, text = parse_asr_output(session.raw_decoded, user_language=session.language)
    session.chunk_id += 1

    return text


# ---------------------------------------------------------------------------
# Model Loading
# ---------------------------------------------------------------------------


def load_asr_model(model_dir: str) -> bool:
    """Load Qwen3-ASR model using qwen_asr SDK, preferring GPU."""
    global asr_model, asr_ready

    logger.info(f"Loading ASR model from {model_dir}...")
    start = time.time()

    try:
        import torch
        from qwen_asr import Qwen3ASRModel

        # Try GPU first, fall back to CPU
        if torch.cuda.is_available():
            try:
                asr_model = Qwen3ASRModel.from_pretrained(model_dir, device_map="cuda:0")
                logger.info(f"ASR model loaded on GPU ({torch.cuda.get_device_name(0)})")
            except Exception as gpu_err:
                logger.warning(f"GPU load failed ({gpu_err}), falling back to CPU")
                asr_model = Qwen3ASRModel.from_pretrained(model_dir)
        else:
            asr_model = Qwen3ASRModel.from_pretrained(model_dir)

        elapsed = time.time() - start
        asr_ready = True
        device_str = getattr(asr_model, "device", "cpu")
        logger.info(f"ASR model loaded in {elapsed:.1f}s (device={device_str})")
        return True

    except Exception as e:
        logger.error(f"Failed to load ASR model: {e}", exc_info=True)
        return False


def load_tts_model(model_dir: str) -> bool:
    """Load Qwen3-TTS model using qwen_tts SDK."""
    global tts_model, tts_ready

    logger.info(f"Loading TTS model from {model_dir}...")
    start = time.time()

    try:
        import numpy as np
        from qwen_tts import Qwen3TTSModel

        tts_model = Qwen3TTSModel.from_pretrained(model_dir)

        # Pre-compute a default reference audio for voice clone mode.
        # The Base model only supports generate_voice_clone, not generate_voice_design.
        # We use a 1-second 220Hz sine as a neutral reference with x_vector_only_mode.
        sr = 16000
        t = np.linspace(0, 1, sr, dtype=np.float32)
        tts_model._default_ref_audio = (0.1 * np.sin(2 * np.pi * 220 * t), sr)

        elapsed = time.time() - start
        tts_ready = True
        logger.info(f"TTS model loaded in {elapsed:.1f}s")
        return True

    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}", exc_info=True)
        return False


def _patch_cosyvoice_load_wav() -> None:
    """
    Monkey-patch cosyvoice's load_wav to use soundfile directly.

    torchaudio nightly (2.11+) ignores backend='soundfile' and requires torchcodec,
    which is not available on Windows.  Using soundfile avoids this issue.
    """
    try:
        import soundfile as sf
        import torch
        import torchaudio
        import cosyvoice.utils.file_utils as _fu

        def _patched_load_wav(wav, target_sr, min_sr=16000):
            speech_np, sample_rate = sf.read(wav, dtype='float32')
            if speech_np.ndim > 1:
                speech_np = speech_np.mean(axis=1)
            speech = torch.from_numpy(speech_np).unsqueeze(0)
            if sample_rate != target_sr:
                assert sample_rate >= min_sr, (
                    f'wav sample rate {sample_rate} must be >= {min_sr}'
                )
                speech = torchaudio.transforms.Resample(
                    orig_freq=sample_rate, new_freq=target_sr
                )(speech)
            return speech

        _fu.load_wav = _patched_load_wav
        logger.info("Patched cosyvoice load_wav to use soundfile backend")
    except ImportError:
        logger.warning("Could not patch cosyvoice load_wav — soundfile not available")


# Default prompt WAV path (generated on first use)
_cosyvoice_prompt_wav_path: Optional[str] = None


def _get_default_prompt_wav() -> str:
    """
    Return path to a real human-voice prompt WAV for CosyVoice2 instruct2 mode.

    CosyVoice2-0.5B has no built-in SFT speakers; inference_instruct2 needs a
    prompt_wav for speaker embedding extraction.  We use the official
    zero_shot_prompt.wav from the CosyVoice repo, falling back to generating
    a synthetic tone if it's not found.
    """
    global _cosyvoice_prompt_wav_path
    if _cosyvoice_prompt_wav_path and os.path.exists(_cosyvoice_prompt_wav_path):
        return _cosyvoice_prompt_wav_path

    # Try official CosyVoice prompt WAV first (real human voice → much better quality)
    cosyvoice_src = os.environ.get("COSYVOICE_SRC", "")
    candidates = [
        os.path.join(cosyvoice_src, "asset", "zero_shot_prompt.wav") if cosyvoice_src else "",
        # Common install locations
        os.path.join("E:\\openclawcn\\CosyVoice", "asset", "zero_shot_prompt.wav"),
        os.path.join(os.path.dirname(__file__), "..", "third_party", "CosyVoice", "asset", "zero_shot_prompt.wav"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            _cosyvoice_prompt_wav_path = candidate
            logger.info(f"Using real human-voice prompt WAV: {candidate}")
            return candidate

    # Fallback: generate synthetic tone (will produce poor quality)
    import numpy as np
    import soundfile as sf
    import tempfile

    logger.warning("No real human-voice prompt WAV found! Falling back to synthetic tone (poor TTS quality expected)")
    sr = 16000
    duration = 3
    t = np.linspace(0, duration, sr * duration, dtype=np.float32)
    wav_data = 0.3 * np.sin(2 * np.pi * 220 * t)

    path = os.path.join(tempfile.gettempdir(), "cosyvoice_default_prompt.wav")
    sf.write(path, wav_data, sr)
    _cosyvoice_prompt_wav_path = path
    logger.warning(f"Generated fallback synthetic prompt WAV at {path}")
    return path


def load_cosyvoice_model(model_dir: str) -> bool:
    """Load CosyVoice model for streaming TTS.

    Auto-detects model type:
    - cosyvoice2.yaml → CosyVoice2 (zero-shot, needs prompt_wav)
    - cosyvoice.yaml + spk2info.pt → CosyVoice SFT (built-in speakers, best quality)
    """
    global cosyvoice_model, cosyvoice_ready, _cosyvoice_model_type

    logger.info(f"Loading CosyVoice model from {model_dir}...")
    start = time.time()

    try:
        import torch

        # Patch torchaudio issue before importing cosyvoice
        _patch_cosyvoice_load_wav()

        # Auto-detect model type
        has_sft = os.path.exists(os.path.join(model_dir, "spk2info.pt"))
        has_v2_yaml = os.path.exists(os.path.join(model_dir, "cosyvoice2.yaml"))

        if has_sft and not has_v2_yaml:
            # CosyVoice-300M-SFT: has built-in speakers
            from cosyvoice.cli.cosyvoice import CosyVoice
            cosyvoice_model = CosyVoice(model_dir, load_jit=False, load_trt=False)
            _cosyvoice_model_type = "sft"
            spks = cosyvoice_model.list_available_spks()
            logger.info(f"CosyVoice SFT speakers: {spks}")
        else:
            # CosyVoice2-0.5B: zero-shot/instruct
            from cosyvoice.cli.cosyvoice import CosyVoice2
            cosyvoice_model = CosyVoice2(model_dir, load_jit=False, load_trt=False)
            _cosyvoice_model_type = "zero_shot"
            _get_default_prompt_wav()

        elapsed = time.time() - start
        cosyvoice_ready = True
        logger.info(f"CosyVoice model loaded in {elapsed:.1f}s (type={_cosyvoice_model_type})")
        return True

    except Exception as e:
        logger.error(f"Failed to load CosyVoice model: {e}", exc_info=True)
        return False


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup."""
    args = app.state.args

    if args.asr_model_dir and os.path.isdir(args.asr_model_dir):
        load_asr_model(args.asr_model_dir)
    else:
        logger.info("No ASR model directory specified, ASR disabled")

    if args.tts_model_dir and os.path.isdir(args.tts_model_dir):
        load_tts_model(args.tts_model_dir)
    else:
        logger.info("No TTS model directory specified, TTS disabled")

    if getattr(args, 'cosyvoice_model_dir', None) and os.path.isdir(args.cosyvoice_model_dir):
        load_cosyvoice_model(args.cosyvoice_model_dir)
        # Warmup: run a short inference to trigger JIT/CUDA kernel compilation
        # so the first real request doesn't pay a 40-50s cold-start penalty.
        if cosyvoice_ready and cosyvoice_model is not None:
            try:
                warmup_start = time.time()
                logger.info("CosyVoice warmup: running short inference...")
                if _cosyvoice_model_type == "sft":
                    for _ in cosyvoice_model.inference_sft("你好", "中文女", stream=False):
                        pass
                else:
                    prompt_wav = _get_default_prompt_wav()
                    if prompt_wav is not None:
                        for _ in cosyvoice_model.inference_zero_shot("你好", "你好", prompt_wav, stream=False):
                            pass
                warmup_elapsed = time.time() - warmup_start
                logger.info(f"CosyVoice warmup done in {warmup_elapsed:.1f}s")
            except Exception as e:
                logger.warning(f"CosyVoice warmup failed (non-fatal): {e}")
    else:
        logger.info("No CosyVoice2 model directory specified, streaming TTS disabled")

    if not asr_ready and not tts_ready and not cosyvoice_ready:
        logger.warning("No models loaded! Server will only respond to /health")

    yield

    logger.info("Shutting down voice server...")


app = FastAPI(title="ClawdBot Voice Server", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Request Size Limits
# ---------------------------------------------------------------------------

# Max audio payload: 25 MB base64 ≈ ~18 MB raw ≈ ~10 min of 16kHz mono WAV
MAX_AUDIO_BASE64_BYTES = 25 * 1024 * 1024
# Max text for TTS: 2000 chars ≈ ~4 min of speech
MAX_TTS_TEXT_LENGTH = 2000
# Max PCM payload for streaming: 5 MB per feed ≈ ~80s of 16kHz mono
MAX_PCM_BASE64_BYTES = 5 * 1024 * 1024


def _check_audio_size(audio_b64: str, label: str = "audio_base64") -> None:
    """Raise 413 if audio payload exceeds size limit."""
    if len(audio_b64) > MAX_AUDIO_BASE64_BYTES:
        size_mb = len(audio_b64) / (1024 * 1024)
        limit_mb = MAX_AUDIO_BASE64_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"{label} too large: {size_mb:.1f} MB (limit: {limit_mb:.0f} MB)",
        )


class TranscribeRequest(BaseModel):
    audio_base64: str
    language: str = "zh"


# Map short language codes to Qwen3-ASR full names
_LANG_MAP = {
    "zh": "Chinese",
    "en": "English",
    "yue": "Cantonese",
    "ja": "Japanese",
    "ko": "Korean",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "ru": "Russian",
    "ar": "Arabic",
    "id": "Indonesian",
    "it": "Italian",
    "th": "Thai",
    "vi": "Vietnamese",
    "tr": "Turkish",
    "hi": "Hindi",
}


class TranscribeResponse(BaseModel):
    text: str
    latency_ms: float


class TranscribePcmRequest(BaseModel):
    """Raw PCM float32 samples, base64-encoded, 16kHz mono."""
    pcm_base64: str
    sample_rate: int = 16000
    language: str = "zh"


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = None
    sample_rate: int = 24000


class SynthesizeResponse(BaseModel):
    audio_base64: str
    format: str
    latency_ms: float


class HealthResponse(BaseModel):
    asr: bool
    tts: bool
    stream_asr: bool = False
    stream_tts: bool = False
    asr_device: str = "cpu"


class StreamTtsRequest(BaseModel):
    text: str
    voice: str | None = None


class StreamAsrStartRequest(BaseModel):
    language: str = "zh"
    chunk_size_sec: float = 1.0


class StreamAsrStartResponse(BaseModel):
    session_id: str


class StreamAsrFeedRequest(BaseModel):
    session_id: str
    pcm_base64: str  # PCM16 little-endian, base64-encoded


class StreamAsrFeedResponse(BaseModel):
    text: str
    changed: bool
    latency_ms: float = 0.0


class StreamAsrEndRequest(BaseModel):
    session_id: str


class StreamAsrEndResponse(BaseModel):
    text: str
    latency_ms: float = 0.0


# ---------------------------------------------------------------------------
# Language Auto-Detection for TTS
# ---------------------------------------------------------------------------


def _detect_tts_language(text: str) -> str:
    """
    Auto-detect language from text content for TTS.
    Returns full language name as expected by Qwen3-TTS.
    """
    # Count CJK characters
    cjk_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff' or '\u3400' <= c <= '\u4dbf')
    # Count ASCII letters
    latin_count = sum(1 for c in text if c.isascii() and c.isalpha())

    total = cjk_count + latin_count
    if total == 0:
        return "Chinese"  # Default

    if cjk_count / total > 0.3:
        return "Chinese"
    return "English"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health():
    asr_device = "cpu"
    if asr_ready and asr_model is not None:
        asr_device = str(getattr(asr_model, "device", "cpu"))
    return HealthResponse(
        asr=asr_ready,
        tts=tts_ready,
        stream_asr=asr_ready,
        stream_tts=cosyvoice_ready,
        asr_device=asr_device,
    )


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest):
    if not asr_ready or asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    _check_audio_size(req.audio_base64)
    start = time.time()

    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(req.audio_base64)

        import numpy as np
        import soundfile as sf

        audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes))

        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)

        # Ensure float32
        audio_data = audio_data.astype(np.float32)

        # Map short language code to full name if needed
        lang = _LANG_MAP.get(req.language, req.language)

        # Run ASR using qwen_asr SDK
        # transcribe() accepts: str (file path), Tuple[ndarray, int], or List of those
        results = asr_model.transcribe(
            (audio_data, sample_rate),
            language=lang,
        )

        # results is a list of ASRTranscription objects with .text attribute
        text = results[0].text if results else ""
        latency_ms = (time.time() - start) * 1000

        logger.info(f"Transcribed {len(audio_bytes)} bytes in {latency_ms:.0f}ms: {text[:50]}...")

        return TranscribeResponse(text=text, latency_ms=round(latency_ms, 1))

    except RuntimeError as e:
        if "CUDA out of memory" in str(e) or "OutOfMemoryError" in str(e):
            logger.error(f"CUDA OOM during transcription, clearing cache: {e}")
            import torch
            torch.cuda.empty_cache()
            raise HTTPException(status_code=503, detail="GPU memory exhausted, please retry")
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe-pcm", response_model=TranscribeResponse)
async def transcribe_pcm(req: TranscribePcmRequest):
    """Transcribe raw PCM float32 audio directly (used by streaming VAD pipeline)."""
    if not asr_ready or asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    _check_audio_size(req.pcm_base64, label="pcm_base64")
    start = time.time()

    try:
        import numpy as np

        pcm_bytes = base64.b64decode(req.pcm_base64)
        audio_data = np.frombuffer(pcm_bytes, dtype=np.float32)

        if len(audio_data) == 0:
            return TranscribeResponse(text="", latency_ms=0)

        lang = _LANG_MAP.get(req.language, req.language)

        results = asr_model.transcribe(
            (audio_data, req.sample_rate),
            language=lang,
        )

        text = results[0].text if results else ""
        latency_ms = (time.time() - start) * 1000

        logger.info(f"Transcribed PCM {len(audio_data)} samples in {latency_ms:.0f}ms: {text[:50]}...")

        return TranscribeResponse(text=text, latency_ms=round(latency_ms, 1))

    except RuntimeError as e:
        if "CUDA out of memory" in str(e) or "OutOfMemoryError" in str(e):
            logger.error(f"CUDA OOM during PCM transcription, clearing cache: {e}")
            import torch
            torch.cuda.empty_cache()
            raise HTTPException(status_code=503, detail="GPU memory exhausted, please retry")
        logger.error(f"PCM transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"PCM transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest):
    if not tts_ready or tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    if len(req.text) > MAX_TTS_TEXT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Text too long: {len(req.text)} chars (limit: {MAX_TTS_TEXT_LENGTH})",
        )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    start = time.time()

    try:
        import soundfile as sf

        # Auto-detect language from text content
        language = _detect_tts_language(req.text)

        # Use voice clone mode with default reference audio.
        # The Base model only supports generate_voice_clone; generate_voice_design
        # requires the VoiceDesign variant.
        wavs, sample_rate = tts_model.generate_voice_clone(
            text=req.text,
            language=language,
            ref_audio=tts_model._default_ref_audio,
            x_vector_only_mode=True,
        )

        audio_np = wavs[0]  # First result
        if audio_np.ndim > 1:
            audio_np = audio_np.squeeze()

        # Encode to WAV
        buf = io.BytesIO()
        sf.write(buf, audio_np, sample_rate, format="WAV")
        audio_base64 = base64.b64encode(buf.getvalue()).decode("ascii")

        latency_ms = (time.time() - start) * 1000
        logger.info(f"Synthesized {len(req.text)} chars ({language}) in {latency_ms:.0f}ms")

        return SynthesizeResponse(
            audio_base64=audio_base64,
            format="wav",
            latency_ms=round(latency_ms, 1),
        )

    except RuntimeError as e:
        if "CUDA out of memory" in str(e) or "OutOfMemoryError" in str(e):
            logger.error(f"CUDA OOM during synthesis, clearing cache: {e}")
            import torch
            torch.cuda.empty_cache()
            raise HTTPException(status_code=503, detail="GPU memory exhausted, please retry")
        logger.error(f"Synthesis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Synthesis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Streaming TTS Endpoint (CosyVoice2)
# ---------------------------------------------------------------------------


@app.post("/stream-tts")
async def stream_tts(req: StreamTtsRequest):
    """
    Streaming TTS via CosyVoice2.

    Returns a StreamingResponse of length-prefixed PCM16 chunks:
      [4 bytes: chunk_size_le32][chunk_size bytes: PCM16 24kHz mono data]
    repeated until generation is complete.
    """
    if not cosyvoice_ready or cosyvoice_model is None:
        raise HTTPException(status_code=503, detail="CosyVoice2 model not loaded")

    if len(req.text) > MAX_TTS_TEXT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Text too long: {len(req.text)} chars (limit: {MAX_TTS_TEXT_LENGTH})",
        )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    import struct
    import numpy as np

    import asyncio, queue, threading

    async def generate_chunks_async():
        """Async generator: runs CosyVoice inference in a thread, yields chunks without blocking the event loop."""
        start = time.time()
        chunk_count = 0
        total_samples = 0
        q: queue.Queue = queue.Queue()

        # Strip markdown / non-speakable content
        import re
        clean_text = req.text
        clean_text = re.sub(r'[\U00010000-\U0010ffff]', '', clean_text)
        clean_text = re.sub(r'\|[-:\s]+\|[-:\s|]*', '', clean_text)
        clean_text = re.sub(r'\|', '，', clean_text)
        clean_text = re.sub(r'#{1,6}\s*', '', clean_text)
        clean_text = re.sub(r'\*{1,3}', '', clean_text)
        clean_text = re.sub(r'^-{3,}$', '', clean_text, flags=re.MULTILINE)
        clean_text = re.sub(r'^[\s]*[-*+]\s+', '', clean_text, flags=re.MULTILINE)
        clean_text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', clean_text)
        clean_text = re.sub(r'https?://\S+', '', clean_text)
        clean_text = re.sub(r'```[\s\S]*?```', '', clean_text)
        clean_text = re.sub(r'`[^`]*`', '', clean_text)
        clean_text = re.sub(r'[✓✗✔✘→←↑↓•·‣⬤▶►▷▸☐☑☒★☆♠♣♥♦]', '', clean_text)
        clean_text = re.sub(r'[\uAC00-\uD7AF\u1100-\u11FF]', '', clean_text)
        clean_text = re.sub(r'[，,]{2,}', '，', clean_text)
        clean_text = re.sub(r'\s{2,}', ' ', clean_text)
        clean_text = clean_text.strip()
        if not clean_text:
            clean_text = req.text.strip()

        _SENTINEL = object()

        def _run_inference():
            """Run blocking CosyVoice inference in a background thread."""
            try:
                if _cosyvoice_model_type == "sft":
                    tts_iter = cosyvoice_model.inference_sft(
                        clean_text, "中文女", stream=True
                    )
                    logger.info(f"Using inference_sft with speaker=中文女")
                else:
                    prompt_wav_path = _get_default_prompt_wav()
                    prompt_text = "希望你以后能够做的比我还好呦。"
                    tts_iter = cosyvoice_model.inference_zero_shot(
                        clean_text, prompt_text, prompt_wav_path, stream=True,
                    )
                    logger.info(f"Using inference_zero_shot")

                iter_start = time.time()
                for i, result in enumerate(tts_iter):
                    iter_elapsed = (time.time() - iter_start) * 1000
                    speech_tensor = result.get("tts_speech")
                    if speech_tensor is None:
                        logger.info(f"[tts-thread] iter {i}: no speech_tensor after {iter_elapsed:.0f}ms")
                        continue
                    audio_np = speech_tensor.numpy().squeeze()
                    if audio_np.ndim == 0 or len(audio_np) == 0:
                        logger.info(f"[tts-thread] iter {i}: empty audio after {iter_elapsed:.0f}ms")
                        continue
                    audio_np = np.clip(audio_np, -1.0, 1.0)
                    pcm16 = (audio_np * 32767).astype(np.int16)
                    pcm_bytes = pcm16.tobytes()
                    header = struct.pack("<I", len(pcm_bytes))
                    logger.info(f"[tts-thread] iter {i}: putting {len(pcm_bytes)} bytes into queue after {iter_elapsed:.0f}ms")
                    q.put((header + pcm_bytes, len(audio_np)))
                    logger.info(f"[tts-thread] iter {i}: put complete")
            except RuntimeError as e:
                if "CUDA out of memory" in str(e) or "OutOfMemoryError" in str(e):
                    logger.error(f"CUDA OOM during streaming TTS: {e}")
                    import torch
                    torch.cuda.empty_cache()
                else:
                    logger.error(f"Streaming TTS error: {e}", exc_info=True)
            except Exception as e:
                logger.error(f"Streaming TTS error: {e}", exc_info=True)
            finally:
                q.put(_SENTINEL)

        # Start inference in a thread so the event loop stays free
        thread = threading.Thread(target=_run_inference, daemon=True)
        thread.start()

        loop = asyncio.get_event_loop()
        logger.info("[tts-async] entering queue read loop")
        while True:
            # Non-blocking poll: yield control back to event loop between checks
            wait_start = time.time()
            item = await loop.run_in_executor(None, q.get)
            wait_ms = (time.time() - wait_start) * 1000
            if item is _SENTINEL:
                logger.info(f"[tts-async] got SENTINEL after {wait_ms:.0f}ms wait")
                break
            data, n_samples = item
            logger.info(f"[tts-async] got chunk from queue: {len(data)} bytes, waited {wait_ms:.0f}ms")
            chunk_count += 1
            total_samples += n_samples

            if chunk_count == 1:
                first_chunk_ms = (time.time() - start) * 1000
                logger.info(
                    f"Stream TTS first chunk in {first_chunk_ms:.0f}ms "
                    f"({n_samples} samples)"
                )

            yield data

        elapsed_ms = (time.time() - start) * 1000
        duration_sec = total_samples / 24000 if total_samples > 0 else 0
        logger.info(
            f"Stream TTS done: {chunk_count} chunks, {duration_sec:.1f}s audio, "
            f"{elapsed_ms:.0f}ms elapsed, text={req.text[:40]}..."
        )

    from starlette.responses import StreamingResponse

    return StreamingResponse(
        generate_chunks_async(),
        media_type="application/octet-stream",
        headers={
            "X-Audio-Sample-Rate": "24000",
            "X-Audio-Format": "pcm16",
            "X-Audio-Channels": "1",
        },
    )


# ---------------------------------------------------------------------------
# Streaming ASR Endpoints
# ---------------------------------------------------------------------------


@app.post("/stream-asr/start", response_model=StreamAsrStartResponse)
async def stream_asr_start(req: StreamAsrStartRequest):
    """Create a new streaming ASR session."""
    if not asr_ready or asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    _cleanup_expired_sessions()

    lang = _LANG_MAP.get(req.language, req.language)
    prompt_raw = asr_model._build_text_prompt(context="", force_language=lang)
    chunk_size_samples = max(1, int(round(req.chunk_size_sec * STREAM_ASR_SAMPLE_RATE)))

    session_id = str(uuid.uuid4())
    session = StreamAsrSession(
        session_id=session_id,
        prompt_raw=prompt_raw,
        chunk_size_samples=chunk_size_samples,
        language=lang,
    )
    stream_asr_sessions[session_id] = session

    logger.info(
        f"Stream ASR session {session_id[:8]} started "
        f"(chunk={req.chunk_size_sec}s, lang={lang})"
    )
    return StreamAsrStartResponse(session_id=session_id)


@app.post("/stream-asr/feed", response_model=StreamAsrFeedResponse)
async def stream_asr_feed(req: StreamAsrFeedRequest):
    """Feed PCM16 audio to a streaming session. Returns updated text if a chunk was processed."""
    import numpy as np

    if len(req.pcm_base64) > MAX_PCM_BASE64_BYTES:
        raise HTTPException(status_code=413, detail="PCM payload too large")

    _cleanup_expired_sessions()

    session = stream_asr_sessions.get(req.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update last-access time so active sessions don't expire
    session.created_at = time.time()

    # Decode PCM16 base64 -> Int16 -> Float32
    pcm_bytes = base64.b64decode(req.pcm_base64)
    int16_arr = np.frombuffer(pcm_bytes, dtype=np.int16)
    float32_arr = int16_arr.astype(np.float32) / 32768.0

    # Append to buffer
    session.buffer = np.concatenate([session.buffer, float32_arr])

    # Process chunks if buffer has enough samples
    changed = False
    text = ""
    total_latency_ms = 0.0

    while session.buffer.shape[0] >= session.chunk_size_samples:
        chunk = session.buffer[:session.chunk_size_samples]
        session.buffer = session.buffer[session.chunk_size_samples:]

        # Append to cumulative audio
        if session.audio_accum.shape[0] == 0:
            session.audio_accum = chunk
        else:
            session.audio_accum = np.concatenate([session.audio_accum, chunk])

        # Run generate
        t0 = time.time()
        text = _stream_generate(session)
        total_latency_ms += (time.time() - t0) * 1000
        changed = True

        accum_sec = session.audio_accum.shape[0] / STREAM_ASR_SAMPLE_RATE
        logger.info(
            f"Stream ASR {session.session_id[:8]} chunk {session.chunk_id - 1} "
            f"({accum_sec:.1f}s accum, {total_latency_ms:.0f}ms): {text[:60]}"
        )

    if not changed:
        # Return last known text without running generate
        from qwen_asr.inference.utils import parse_asr_output
        if session.raw_decoded:
            _lang, text = parse_asr_output(session.raw_decoded, user_language=session.language)
        else:
            text = ""

    return StreamAsrFeedResponse(text=text, changed=changed, latency_ms=round(total_latency_ms, 1))


@app.post("/stream-asr/end", response_model=StreamAsrEndResponse)
async def stream_asr_end(req: StreamAsrEndRequest):
    """Flush remaining buffer and return final text. Cleans up the session."""
    import numpy as np

    session = stream_asr_sessions.pop(req.session_id, None)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    text = ""
    total_latency_ms = 0.0

    try:
        # Flush remaining buffer (even if shorter than one chunk)
        if session.buffer.shape[0] > 0:
            tail = session.buffer
            session.buffer = np.zeros(0, dtype=np.float32)

            if session.audio_accum.shape[0] == 0:
                session.audio_accum = tail
            else:
                session.audio_accum = np.concatenate([session.audio_accum, tail])

            t0 = time.time()
            text = _stream_generate(session)
            total_latency_ms = (time.time() - t0) * 1000
        else:
            # No remaining buffer — return last known text
            from qwen_asr.inference.utils import parse_asr_output
            if session.raw_decoded:
                _lang, text = parse_asr_output(session.raw_decoded, user_language=session.language)

        logger.info(
            f"Stream ASR {req.session_id[:8]} ended: "
            f"{session.chunk_id} chunks, {total_latency_ms:.0f}ms final, text={text[:60]}"
        )
    except Exception as e:
        logger.error(f"Stream ASR end error: {e}", exc_info=True)
        # Still return whatever text we have
        from qwen_asr.inference.utils import parse_asr_output
        if session.raw_decoded:
            _lang, text = parse_asr_output(session.raw_decoded, user_language=session.language)

    return StreamAsrEndResponse(text=text, latency_ms=round(total_latency_ms, 1))


# ---------------------------------------------------------------------------
# Shutdown
# ---------------------------------------------------------------------------


@app.post("/shutdown")
async def shutdown():
    """Graceful shutdown endpoint, called by Node.js before killing the process."""
    logger.info("Shutdown requested via API")
    os.kill(os.getpid(), signal.SIGTERM)
    return {"status": "shutting_down"}


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------


def parse_args():
    parser = argparse.ArgumentParser(description="ClawdBot GPU Voice Server")
    parser.add_argument("--port", type=int, default=50100, help="HTTP port (default: 50100)")
    parser.add_argument("--asr-model-dir", type=str, default=None, help="Path to ASR model directory")
    parser.add_argument("--tts-model-dir", type=str, default=None, help="Path to TTS model directory")
    parser.add_argument("--cosyvoice-model-dir", type=str, default=None, help="Path to CosyVoice2 model directory")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    return parser.parse_args()


def main():
    args = parse_args()
    app.state.args = args

    logger.info(f"Starting voice server on {args.host}:{args.port}")
    logger.info(f"  ASR model: {args.asr_model_dir or 'disabled'}")
    logger.info(f"  TTS model: {args.tts_model_dir or 'disabled'}")
    logger.info(f"  CosyVoice2: {args.cosyvoice_model_dir or 'disabled'}")

    import uvicorn

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="warning",  # Suppress uvicorn's own logging, we have our own
        access_log=False,
    )


if __name__ == "__main__":
    main()
