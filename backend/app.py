"""
app.py — SerenityScreen ML Backend

FastAPI server that provides:
  /api/transcribe   → Whisper speech-to-text
  /api/screening    → Transcribe + predict condition & cause
  /api/assessment   → Transcribe + full assessment (condition, cause, transcript)
  /api/analyze-text → Analyze raw text (no audio) — used for weekly analysis
  /api/health       → Health check

The Phase 4 joint model (.pt file) is loaded ONCE at startup and stays
in RAM. Each request just runs a forward pass (~50ms on CPU).
"""

import os
import shutil
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ── Global model holders ──
whisper_model = None
predictor = None  # MentalHealthPredictor instance


# ── Lifespan: load models at startup ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models when the server starts."""
    global whisper_model, predictor

    print("=" * 60)
    print("  SerenityScreen ML Backend — Starting Up")
    print("=" * 60)

    # 1. Load Whisper
    print("\n[Startup] Loading Whisper model...")
    try:
        import whisper
        import torch as _torch
        device = "cuda" if _torch.cuda.is_available() else "cpu"
        whisper_model = whisper.load_model("base", device=device)
        print(f"[Startup] OK Whisper loaded on {device}")
    except Exception as e:
        print(f"[Startup] WARNING Whisper failed to load: {e}")
        print("[Startup]    Transcription will not be available.")

    # 2. Load Phase 4 Joint Model
    print("\n[Startup] Loading Phase 4 joint model...")
    try:
        from model import MentalHealthPredictor
        predictor = MentalHealthPredictor()
        print("[Startup] OK Phase 4 model loaded successfully")
    except FileNotFoundError as e:
        print(f"[Startup] WARNING {e}")
        print("[Startup]    Condition/cause prediction will not be available.")
    except Exception as e:
        print(f"[Startup] WARNING Model loading failed: {e}")
        print("[Startup]    Condition/cause prediction will not be available.")

    print("\n" + "=" * 60)
    print("  Server ready!")
    print("=" * 60 + "\n")

    yield  # Server runs here

    # Cleanup on shutdown
    print("\n[Shutdown] Cleaning up...")


# ── App ──

app = FastAPI(title="SerenityScreen ML Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: transcribe audio file ──

def transcribe_audio(file_path: str) -> str:
    """Transcribe an audio file using Whisper. Returns transcript text."""
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="Whisper model not available")

    result = whisper_model.transcribe(file_path, fp16=False)
    return result.get("text", "").strip()


def save_upload_to_temp(file: UploadFile) -> str:
    """Save an uploaded file to a temp path. Caller must delete it."""
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        return tmp.name


# ── Endpoints ──

@app.get("/api/health")
def health_check():
    """Health check — reports what models are loaded."""
    return {
        "status": "healthy",
        "whisper_loaded": whisper_model is not None,
        "predictor_loaded": predictor is not None,
        "ffmpeg_installed": shutil.which("ffmpeg") is not None,
    }


@app.post("/api/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    """Transcribe audio to text using Whisper."""
    temp_path = save_upload_to_temp(file)
    try:
        transcript = transcribe_audio(temp_path)
        return {"transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/screening")
async def screening_endpoint(file: UploadFile = File(...)):
    """
    Quick screening: transcribe audio → predict condition & cause.

    Called by the Node.js server when a user does a quick voice screening.
    Returns the format that screeningRoutes.js expects.
    """
    temp_path = save_upload_to_temp(file)
    try:
        # Step 1: Transcribe
        transcript = transcribe_audio(temp_path)

        # Step 2: Predict (if model is loaded)
        if predictor is not None and transcript:
            result = predictor.predict(transcript)
            return {
                "conditionLabel": result["condition"],
                "conditionConfidence": result["condition_confidence"],
                "causeLabel": result["cause"],
                "causeConfidence": result["cause_confidence"],
                "conditionScores": result["condition_scores"],
                "causeScores": result["cause_scores"],
                "transcript": transcript,
            }
        else:
            # Model not loaded — return transcript only with defaults
            return {
                "conditionLabel": "Normal",
                "conditionConfidence": 0.0,
                "causeLabel": "No reason",
                "causeConfidence": 0.0,
                "transcript": transcript,
                "warning": "ML model not loaded — returning defaults",
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screening failed: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/assessment")
async def assessment_endpoint(file: UploadFile = File(...)):
    """
    Full assessment: transcribe audio → predict condition & cause.

    Called by the Node.js server when a user completes a voice reflection
    session (ConversationView). Returns the format assessmentRoutes.js expects.
    """
    temp_path = save_upload_to_temp(file)
    try:
        # Step 1: Transcribe
        transcript = transcribe_audio(temp_path)

        # Step 2: Predict
        if predictor is not None and transcript:
            result = predictor.predict(transcript)
            return {
                "transcript": transcript,
                "prediction": result["condition"],
                "confidence": result["condition_confidence"],
                "conditionLabel": result["condition"],
                "conditionConfidence": result["condition_confidence"],
                "conditionScores": result["condition_scores"],
                "causeLabel": result["cause"],
                "causeConfidence": result["cause_confidence"],
                "causeScores": result["cause_scores"],
                # Phase 6 placeholder — will be filled when fusion model is ready
                "depressionPrediction": None,
                "depressionConfidence": None,
            }
        else:
            return {
                "transcript": transcript,
                "prediction": "Normal",
                "confidence": 0.0,
                "conditionLabel": "Normal",
                "conditionConfidence": 0.0,
                "causeLabel": "No reason",
                "causeConfidence": 0.0,
                "depressionPrediction": None,
                "depressionConfidence": None,
                "warning": "ML model not loaded — returning defaults",
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assessment failed: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Text-only analysis (for weekly analysis) ──

class TextAnalysisRequest(BaseModel):
    """Request body for /api/analyze-text."""
    texts: list[str]


@app.post("/api/analyze-text")
async def analyze_text_endpoint(req: TextAnalysisRequest):
    """
    Analyze one or more text strings (no audio).

    Used by the Node.js server's weekly analysis route: it collects
    all transcripts from the past 7 days and sends them here for
    batch classification. Returns per-text predictions + aggregated summary.
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="ML model not loaded")

    if not req.texts:
        return {"results": [], "summary": {}}

    # Predict each text
    results = []
    condition_counts = {}
    cause_counts = {}

    for text in req.texts:
        if not text or not text.strip():
            results.append(None)
            continue

        pred = predictor.predict(text)
        results.append(pred)

        # Aggregate
        cond = pred["condition"]
        cause = pred["cause"]
        condition_counts[cond] = condition_counts.get(cond, 0) + 1
        cause_counts[cause] = cause_counts.get(cause, 0) + 1

    # Build summary
    total = sum(condition_counts.values())
    dominant_condition = max(condition_counts, key=condition_counts.get) if condition_counts else "Normal"
    dominant_cause = max(cause_counts, key=cause_counts.get) if cause_counts else "No reason"

    # Risk level based on dominant condition
    risk_map = {
        "Normal": "low",
        "Stress": "moderate",
        "Anxiety": "moderate",
        "Depression": "high",
        "Suicidal": "critical",
    }

    summary = {
        "totalAnalyzed": total,
        "dominantCondition": dominant_condition,
        "dominantCause": dominant_cause,
        "riskLevel": risk_map.get(dominant_condition, "unknown"),
        "conditionDistribution": {
            k: {"count": v, "percentage": round(100 * v / total, 1)}
            for k, v in condition_counts.items()
        },
        "causeDistribution": {
            k: {"count": v, "percentage": round(100 * v / total, 1)}
            for k, v in cause_counts.items()
        },
    }

    return {"results": results, "summary": summary}


# ── Run ──

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
