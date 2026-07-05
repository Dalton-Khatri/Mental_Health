import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="SerenityScreen Transcription Backend")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Programmatically add winget FFmpeg paths to PATH to ensure it works without shell restart
winget_ffmpeg_path = r"C:\Users\acer\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"
if os.path.exists(winget_ffmpeg_path) and winget_ffmpeg_path not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + winget_ffmpeg_path

whisper_model = None
ffmpeg_available = shutil.which("ffmpeg") is not None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        if not ffmpeg_available:
            print("[WARNING] ffmpeg is not installed or not in PATH.")
            print("Whisper requires ffmpeg to process audio files.")
            print("Please install ffmpeg (e.g. via 'scoop install ffmpeg', 'choco install ffmpeg', or downloading from ffmpeg.org) and add it to your PATH.")
        
        print("Loading Whisper 'base' model...")
        import whisper
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")
        whisper_model = whisper.load_model("base", device=device)
        print("Whisper model loaded successfully!")
    return whisper_model

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "ffmpeg_installed": ffmpeg_available,
        "model_loaded": whisper_model is not None
    }

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not ffmpeg_available:
        # Return a friendly error message if ffmpeg is missing
        raise HTTPException(
            status_code=500,
            detail="ffmpeg is not installed on the server. Whisper requires ffmpeg to process audio files. Please install ffmpeg and restart the server."
        )

    # Save uploaded file to a temporary location
    try:
        suffix = os.path.splitext(file.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded audio: {str(e)}")

    try:
        # Debug audio loading & content
        try:
            import librosa
            y, sr = librosa.load(temp_path, sr=16000)
            rms = (y ** 2).mean() ** 0.5 if len(y) > 0 else 0
            print(f"[DEBUG AUDIO] Loaded successfully via librosa: {len(y)} samples, SR={sr}, RMS={rms:.6f}")
            if rms < 0.0005:
                print("[DEBUG AUDIO] WARNING: The recorded audio seems to be completely silent.")
        except Exception as audio_err:
            print(f"[DEBUG AUDIO] Failed to decode audio file: {audio_err}")

        # Load and run Whisper model
        model = get_whisper_model()
        print(f"Transcribing audio file: {temp_path}")
        result = model.transcribe(temp_path, fp16=False)
        transcript = result.get("text", "").strip()
        print(f"Transcription result: {transcript}")
        return {"transcript": transcript}
    except Exception as e:
        print(f"Error during transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                print(f"Failed to remove temp file {temp_path}: {e}")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
