# Lucid — Multimodal Mental Health Screening System

> **Academic Project** | 4th Semester Project  
> **Technologies**: React, FastAPI, Node.js Express, Prisma, PostgreSQL, OpenAI Whisper

---

## 🌟 Project Overview

**Lucid** is an end-to-end multimodal mental health screening platform designed to assist in evaluating clinical reflections through a combination of spoken speech characteristics (audio acoustics) and transcribed transcripts (text semantics). 

1. **Mental Health Condition** (Normal, Anxiety, Depression, Stress, Suicidal) — classified from the transcribed text using a domain-specific language model.
2. **Trigger Cause** (No reason, Bias/Abuse, Jobs/Careers, Medication, Relationship, Alienation) — identified from the transcribed text.
3. **Depression Risk Level** (Minimal, Low, Moderate, High) — determined by combining both text and audio analysis through a multimodal fusion approach.

---

## 📐 System Architecture

```
                         User Voice Recording
                                   |
                          +------------------+
                          |  OpenAI Whisper   |
                          |  (speech-to-text) |
                          +------------------+
                           /                \
                          v                  v
                   [Raw Audio]         [Transcript Text]
                          |                  |
                          v                  v
                   +------------+     +---------------------------+
                   |  wav2vec2  |     |   MentalBERT              |
                   |  (audio   |     |   (domain-specific text    |
                   |  analysis)|     |    analysis model)         |
                   +------------+     +---------------------------+
                          |                  |
                   Audio Features      Text Features
                          |           /            \
                          |          v              v
                          |     Condition        Cause
                          |     Prediction       Prediction
                          |
                          └─────────┬───────────┘
                                    v
                          +-------------------+
                          |  Multimodal       |
                          |  Fusion Model     |
                          +-------------------+
                                    |
                                    v
                          Depression Risk Level
                    (Minimal / Low / Moderate / High)
```

---

## 📂 Repository Structure

```
Mental_Health/
├── backend/                  # Python FastAPI — AI/ML inference server
│   ├── model_artifacts/      # Fine-tuned model checkpoints (git-ignored)
│   ├── app.py                # FastAPI server with transcription, screening, and assessment endpoints
│   ├── model.py              # PyTorch model definitions and inference pipeline
│   ├── ffmpeg.exe            # Local FFmpeg binary for audio format conversion
│   └── requirements.txt      # Python dependencies
│
├── server/                   # Node.js Express — API and database server
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema (User, Screening, Assessment, etc.)
│   │   └── migrations/       # PostgreSQL migration history
│   ├── src/
│   │   ├── routes/           # Auth, Screening, Assessment, and Weekly Analysis routes
│   │   ├── index.js          # Express server entry point
│   │   └── prismaClient.js   # Shared database client
│   └── package.json
│
├── frontend/                 # React + Vite — Client application
│   ├── src/
│   │   ├── components/       # Dashboard, Conversation, Insights, Activities views
│   │   ├── App.jsx           # Main application shell
│   │   ├── Auth.jsx          # Login, Register, and OTP verification
│   │   └── index.css         # Global styles
│   └── package.json
│
├── notebooks/                # Kaggle training notebooks
├── setup_ffmpeg.py           # One-click FFmpeg download script
└── .gitignore
```

---

## ⚙️ Setup & Installation

### Prerequisites
* Node.js (v18+)
* Python (v3.10+)
* PostgreSQL (locally active)

### 0. FFmpeg Setup (Required — One Time)
FFmpeg is needed to convert browser-recorded audio (WebM/Opus) to WAV for Whisper. Run this once after cloning:
```bash
python setup_ffmpeg.py
```

### 1. Database Setup (`/server`)
Create a database in PostgreSQL and add a `.env` file under `/server`:
```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/<db_name>?schema=public"
JWT_SECRET="your_jwt_secret_token"
PORT=5000
FRONTEND_URL="http://localhost:5173"
```
Apply migrations and run the server:
```bash
cd server
npm install
npx prisma migrate dev
node src/index.js
```

### 2. ML Backend Setup (`/backend`)
Place the fine-tuned `.pt` checkpoints inside `backend/model_artifacts/`. Install dependencies and boot uvicorn:
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 3. Frontend Setup (`/frontend`)
Install Vite packages and start hot-reloading:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173/`** to run the application.