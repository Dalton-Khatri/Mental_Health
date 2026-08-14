FROM python:3.10-slim

# Install system deps (ffmpeg for whisper audio conversion)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download model artifacts from Hugging Face Hub
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='Dalton-Khatri/lucid-models', local_dir='model_artifacts')"

# Copy application code
COPY app.py model.py ./

# HF Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "app.py"]
