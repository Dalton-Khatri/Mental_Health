"""
app.py -- Lucid ML Backend

FastAPI server that provides:
  /api/transcribe   -> Whisper speech-to-text
  /api/screening    -> Transcribe + predict condition & cause
  /api/assessment   -> Transcribe + full assessment (condition, cause, depression)
  /api/analyze-text -> Analyze raw text (no audio) -- used for weekly analysis
  /api/health       -> Health check

Models loaded at startup:
  - Whisper (base) for speech-to-text
  - Phase 4 joint model for condition + cause prediction
  - wav2vec2 for audio embedding extraction
  - Text MLP + Audio MLP + Fusion MLP for depression prediction
"""

import os
import sys

# Prepend backend folder to PATH so Whisper/ffmpeg can be executed successfully
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.environ["PATH"] = backend_dir + os.path.pathsep + os.environ.get("PATH", "")

import shutil
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import numpy as np

# ── Global model holders ──
whisper_model = None
predictor = None       # MentalHealthPredictor instance
wav2vec2_model = None  # wav2vec2 for audio embeddings
wav2vec2_processor = None


#Audio embedding extraction

def extract_audio_embedding(file_path: str) -> np.ndarray:
    """
    Extract a 768-dim wav2vec2 embedding from an audio file.
    """
    if wav2vec2_model is None or wav2vec2_processor is None:
        return None

    import torch
    import librosa

    # Load audio at 16kHz
    audio, sr = librosa.load(file_path, sr=16000)

    # Limit to 30 seconds max (wav2vec2 can handle long audio but this is reasonable)
    max_samples = 30 * 16000
    if len(audio) > max_samples:
        audio = audio[:max_samples]

    # Process through wav2vec2
    inputs = wav2vec2_processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)

    with torch.no_grad():
        outputs = wav2vec2_model(**inputs)
        # Mean-pool over time dimension: (1, time_steps, 768) -> (768,)
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()

    return embedding  # shape: (768,)


# ── Lifespan: load models at startup ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models when the server starts."""
    global whisper_model, predictor, wav2vec2_model, wav2vec2_processor

    print("=" * 60)
    print("  Lucid ML Backend -- Starting Up")
    print("=" * 60)

    # 0. Download model artifacts from HF Hub if not present locally
    artifacts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_artifacts")
    if not os.path.exists(artifacts_dir) or not os.listdir(artifacts_dir):
        print("\n[Startup] Downloading model artifacts from HF Hub...")
        try:
            from huggingface_hub import snapshot_download
            snapshot_download(repo_id="Dalton-Khatri/lucid-models", local_dir=artifacts_dir)
            print("[Startup] OK Model artifacts downloaded")
        except Exception as e:
            print(f"[Startup] WARNING Failed to download models: {e}")

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

    # 2. Load Phase 4 Joint Model + Phase 5/6 Fusion Models
    print("\n[Startup] Loading ML models...")
    try:
        from model import MentalHealthPredictor
        predictor = MentalHealthPredictor()
        print("[Startup] OK ML models loaded successfully")
    except FileNotFoundError as e:
        print(f"[Startup] WARNING {e}")
        print("[Startup]    Prediction will not be available.")
    except Exception as e:
        print(f"[Startup] WARNING Model loading failed: {e}")
        import traceback
        traceback.print_exc()
        print("[Startup]    Prediction will not be available.")

    # 3. Load wav2vec2 for audio embedding extraction
    print("\n[Startup] Loading wav2vec2 for audio embeddings...")
    try:
        from transformers import Wav2Vec2Model, Wav2Vec2Processor
        import logging
        logging.getLogger("transformers.modeling_utils").setLevel(logging.ERROR)

        wav2vec2_processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
        wav2vec2_model = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base-960h")
        wav2vec2_model.eval()
        print("[Startup] OK wav2vec2 loaded")
    except Exception as e:
        print(f"[Startup] WARNING wav2vec2 failed to load: {e}")
        print("[Startup]    Audio depression analysis will not be available.")

    print("\n" + "=" * 60)
    status_parts = []
    status_parts.append(f"Whisper: {'OK' if whisper_model else 'MISSING'}")
    status_parts.append(f"Joint Model: {'OK' if predictor else 'MISSING'}")
    status_parts.append(f"Fusion: {'OK' if predictor and predictor.fusion_available else 'MISSING'}")
    status_parts.append(f"wav2vec2: {'OK' if wav2vec2_model else 'MISSING'}")
    print(f"  Status: {' | '.join(status_parts)}")
    print("  Server ready!")
    print("=" * 60 + "\n")

    yield  # Server runs here

    print("\n[Shutdown] Cleaning up...")


#App

app = FastAPI(title="Lucid ML Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#Helpers

def transcribe_audio(file_path: str) -> str:
    """Transcribe an audio file using Whisper."""
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


#Endpoints

@app.get("/api/health")
def health_check():
    """Health check -- reports what models are loaded."""
    return {
        "status": "healthy",
        "whisper_loaded": whisper_model is not None,
        "predictor_loaded": predictor is not None,
        "fusion_available": predictor.fusion_available if predictor else False,
        "wav2vec2_loaded": wav2vec2_model is not None,
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
    Quick screening: transcribe audio -> predict condition & cause.
    Called by the Node.js server's screeningRoutes.js.
    """
    temp_path = save_upload_to_temp(file)
    try:
        # Step 1: Transcribe
        transcript = transcribe_audio(temp_path)

        # Step 2: Predict condition + cause
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
            return {
                "conditionLabel": "Normal",
                "conditionConfidence": 0.0,
                "causeLabel": "No reason",
                "causeConfidence": 0.0,
                "transcript": transcript,
                "warning": "ML model not loaded",
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screening failed: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/assessment")
async def assessment_endpoint(file: UploadFile = File(...), transcript: str = Form(None)):
    """
    Full assessment: transcribe -> condition + cause + depression fusion.
    Called by the Node.js server's assessmentRoutes.js.

    This is the main endpoint that runs the COMPLETE pipeline:
      Audio -> Whisper -> transcript (or use pre-built transcript if provided)
      Transcript -> Phase 4 -> condition + cause
      Transcript -> text embedding -> Text MLP -> 128-dim features
      Audio -> wav2vec2 -> audio embedding -> Audio MLP -> 128-dim features
      concat(text_features, audio_features) -> Fusion MLP -> depression
    """
    temp_path = save_upload_to_temp(file)
    try:
        # Step 1: Transcribe (skip Whisper if pre-built transcript was provided)
        if transcript and transcript.strip():
            print("[Assessment] Using pre-built transcript (skipping Whisper)")
            transcript = transcript.strip()
        else:
            transcript = transcribe_audio(temp_path)

        if predictor is None or not transcript:
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
                "depressionRisk": None,
                "warning": "ML model not loaded or empty transcript",
            }

        # Step 2: Extract audio embedding (for depression fusion)
        audio_embedding = None
        if wav2vec2_model is not None:
            try:
                audio_embedding = extract_audio_embedding(temp_path)
            except Exception as e:
                print(f"[Assessment] WARNING Audio embedding extraction failed: {e}")

        # Step 3: Run full assessment (Phase 4 + 5 + 6)
        result = predictor.full_assessment(transcript, audio_embedding)

        return {
            "transcript": transcript,
            # Legacy field for backward compat
            "prediction": result["condition"],
            "confidence": result["condition_confidence"],
            # Phase 4: Condition
            "conditionLabel": result["condition"],
            "conditionConfidence": result["condition_confidence"],
            "conditionScores": result["condition_scores"],
            # Phase 4: Cause
            "causeLabel": result["cause"],
            "causeConfidence": result["cause_confidence"],
            "causeScores": result["cause_scores"],
            # Phase 5+6: Depression fusion
            "depressionPrediction": result.get("depression_prediction"),
            "depressionConfidence": result.get("depression_confidence"),
            "depressionRisk": result.get("depression_risk"),
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Assessment failed: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


#Text-only analysis (for weekly analysis)

class TextAnalysisRequest(BaseModel):
    texts: list[str]


@app.post("/api/analyze-text")
async def analyze_text_endpoint(req: TextAnalysisRequest):
    """
    Analyze one or more text strings (no audio).
    Used by the Node.js server's weekly analysis route.
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="ML model not loaded")

    if not req.texts:
        return {"results": [], "summary": {}}

    results = []
    condition_counts = {}
    cause_counts = {}

    for text in req.texts:
        if not text or not text.strip():
            results.append(None)
            continue

        pred = predictor.predict(text)
        results.append(pred)

        cond = pred["condition"]
        cause = pred["cause"]
        condition_counts[cond] = condition_counts.get(cond, 0) + 1
        cause_counts[cause] = cause_counts.get(cause, 0) + 1

    total = sum(condition_counts.values())
    dominant_condition = max(condition_counts, key=condition_counts.get) if condition_counts else "Normal"
    dominant_cause = max(cause_counts, key=cause_counts.get) if cause_counts else "No reason"

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


#MentalBERT Dynamic Chat Engine

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []

def generate_mentalbert_reply(text: str, condition: str, cause: str, cond_conf: float, cause_conf: float) -> str:
    text_lower = text.lower()
    
    # 1. Emergency / Suicidal check
    if condition == "Suicidal" or any(w in text_lower for w in ["suicide", "kill myself", "want to die", "end it all"]):
        return (
            "I hear how much pain you're in right now, and I want you to know you don't have to go through this alone. "
            "Your life has immense value. If you're feeling overwhelmed or having thoughts of harming yourself, please reach out to someone who can help right now:\n\n"
            "• National Crisis Lifeline: Call or text 988 (Available 24/7)\n"
            "• Crisis Text Line: Text HOME to 741741\n"
            "• Emergency Services: Call 911 or visit your nearest emergency room\n\n"
            "Please talk to a trusted friend, family member, or healthcare provider. I'm here to listen, but your safety is the most important thing."
        )

    # 2. Anxiety & Panic
    if condition == "Anxiety" or any(w in text_lower for w in ["anxious", "panic", "worried", "fear", "nervous"]):
        cause_note = f" especially around {cause.lower()}" if cause not in ["No reason", "Normal"] else ""
        return (
            f"It sounds like you're experiencing a lot of anxiety right now{cause_note}. Anxiety can feel overwhelming in your body and mind.\n\n"
            "Try this quick 5-4-3-2-1 grounding exercise with me right now:\n"
            "• Name 5 things you can see around you\n"
            "• 4 things you can physically touch\n"
            "• 3 things you can hear\n"
            "• 2 things you can smell\n"
            "• 1 deep, slow breath\n\n"
            "Take your time. What is one thought or situation causing you the most worry right now?"
        )

    # 3. Depression & Low Mood
    if condition == "Depression" or any(w in text_lower for w in ["depressed", "sad", "hopeless", "lonely", "exhausted", "tired"]):
        cause_note = f" related to {cause.lower()}" if cause not in ["No reason", "Normal"] else ""
        return (
            f"I hear how heavy things feel for you right now{cause_note}. Feeling depressed can make even small daily tasks feel like a mountain.\n\n"
            "Please remember to be gentle with yourself today. You don't need to fix everything all at once. "
            "Focusing on just one small act of self-care—like drinking a glass of water or stepping outside for 2 minutes—is enough.\n\n"
            "Would you like to talk a bit more about what's been weighing on your mind?"
        )

    # 4. Stress & Overwhelm
    if condition == "Stress" or any(w in text_lower for w in ["stress", "overwhelmed", "busy", "work", "pressure", "burnout"]):
        cause_note = f" regarding {cause.lower()}" if cause not in ["No reason", "Normal"] else ""
        return (
            f"It sounds like you're carrying a high level of stress{cause_note}. Chronic stress can take a heavy toll on your energy and focus.\n\n"
            "Here are a few quick stress-relief steps you can take right now:\n"
            "1. Take 3 deep diaphragmatic breaths (4 seconds in, 4 seconds hold, 6 seconds out).\n"
            "2. Step away from screen work for 5 minutes.\n"
            "3. Identify one thing on your to-do list that can wait until tomorrow.\n\n"
            "What feels like the biggest source of pressure for you right now?"
        )

    # 5. General / Warm Conversational Response
    return (
        f"Thank you for sharing that with me. I'm listening. "
        f"It sounds like you're reflecting on things{' related to ' + cause.lower() if cause not in ['No reason', 'Normal'] else ''}. "
        f"How are you feeling overall today, and what kind of support would feel most helpful right now?"
    )


@app.post("/api/chat-response")
async def chat_response_endpoint(req: ChatRequest):
    """
    Generate an intelligent, empathetic chat response powered by MentalBERT analysis.
    """
    user_text = req.message.strip()
    if not user_text:
        return {"reply": "I'm here for you. How can I help you today?"}

    cond = "Normal"
    cause = "No reason"
    cond_conf = 0.0
    cause_conf = 0.0

    if predictor is not None:
        try:
            pred = predictor.predict(user_text)
            cond = pred.get("condition", "Normal")
            cause = pred.get("cause", "No reason")
            cond_conf = pred.get("condition_confidence", 0.0)
            cause_conf = pred.get("cause_confidence", 0.0)
        except Exception as e:
            print(f"[Chat Endpoint] Model prediction error: {e}")

    reply = generate_mentalbert_reply(user_text, cond, cause, cond_conf, cause_conf)
    return {"reply": reply, "analysis": {"condition": cond, "cause": cause, "confidence": cond_conf}}


# ── Run ──

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=(port == 8000))
