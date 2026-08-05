# SerenityScreen — Multimodal Mental Health Screening System

> **Academic Project** | 4th Semester Semester Project  
> **Backbone Models**: MentalBERT (Text Classification) + wav2vec2-base-960h (Vocal Feature Extraction)  
> **Technologies**: React, FastAPI, Node.js Express, Prisma, PostgreSQL, OpenAI Whisper

---

## 🌟 Project Overview

**SerenityScreen** is an end-to-end multimodal mental health screening platform designed to assist in evaluating clinical reflections through a combination of spoken speech characteristics (audio acoustics) and transcribed transcripts (text semantics). 

The system records or accepts a user's verbal reflection, transcribes it, and outputs three critical indicators:
1. **Primary Condition Detected** (Normal, Anxiety, Depression, Stress, Suicidal) — *derived from text semantics using a fine-tuned MentalBERT joint classifier.*
2. **Identified Trigger Cause** (No reason, Bias/Abuse, Jobs/Careers, Medication, Relationship, Alienation) — *derived from text semantics.*
3. **Depression Risk Level** (Minimal, Low, Moderate, High) — *derived from a multimodal late-fusion network merging audio acoustic embeddings (Wav2Vec2) and text semantic embeddings (MentalBERT).*

---

## 📐 Architecture & Pipeline Flow

```
                         Clinical Interview (Audio)
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
                    |  wav2vec2  |     |   MentalBERT (joint,      |
                    |  (audio   |     |   Phase 4 checkpoint)      |
                    | embeddings|     |   shared backbone          |
                    +------------+     +---------------------------+
                           |                    |
                      768-dim vec         768-dim text embedding
                           |               (tapped directly off the
                           |                backbone — fans out to
                           |                all three branches below)
                           |                      |
                           |          ┌───────────┼───────────┐
                           |          |           |           |
                           |          v           v           v
                           |     +---------+ +---------+ +----------+
                           |     | Head 1  | | Head 2  | | Text MLP |
                           |     |Condition| |  Cause  | | 768→256  |
                           |     +---------+ +---------+ +----------+
                           |          |           |           |
                           |          v           v           |
                           |     Condition      Cause          |
                           |      (final,      (final,          |
                           |      no fusion)   no fusion)        |
                           |                                     v
                           v                              intermediate
                   +------------+                        text features
                   | Audio MLP  |                             (128)
                   | 768→256→128|                              |
                   +------------+                              |
                           |                                    |
                    intermediate                                |
                   audio features                                |
                        (128)                                    |
                           |                                     |
                           └───────────────┬─────────────────────┘
                                           v
                   +-------------------------------------------+
                   |   Fusion MLP: concat(128+128) → 64 → 1     |
                   |   (final depressed / not depressed)        |
                   +-------------------------------------------+
```

---

## 📂 Repository File Directory Map

```
Mental_Health/
├── backend/                             # Python FastAPI Machine Learning server
│   ├── model_artifacts/                 # Directory holding fine-tuned model checkpoints (git-ignored)
│   │   ├── best_joint_checkpoint.pt     # Shared MentalBERT backbone + Heads 1 & 2 weights (~420MB)
│   │   ├── text_mlp_checkpoint.pt       # Text feature extraction network (~2.7MB)
│   │   ├── audio_mlp_checkpoint.pt      # Audio feature extraction network (~2.7MB)
│   │   └── fusion_mlp_checkpoint.pt     # Fusion classification network (~70KB)
│   ├── app.py                           # Main FastAPI server; exposes transcription, screening, and fusion endpoints
│   ├── model.py                         # PyTorch model definitions for Joint Classifier, MLPs, and Fusion pipeline
│   ├── ffmpeg.exe                       # Local static ffmpeg binary copy for Windows environment path injection
│   └── requirements.txt                 # Backend Python package requirements (PyTorch, Transformers, Whisper, etc.)
│
├── server/                              # Node.js Express Backend & Database Server
│   ├── prisma/
│   │   ├── schema.prisma                # Database schema defining User, Screening, and Assessment tables
│   │   └── migrations/                  # Automated PostgreSQL database migration history
│   ├── src/
│   │   ├── routes/
│   │   │   ├── authRoutes.js            # Authentication handlers (signup, login, verification, password resets)
│   │   │   ├── screeningRoutes.js       # Saves quick screenings, triggers Python ML analyzer, returns metrics
│   │   │   ├── assessmentRoutes.js      # Saves guided reflections, forwards combined audio to ML pipeline
│   │   │   └── weeklyAnalysisRoutes.js  # Collects rolling 7-day logs and generates AI clinical insights
│   │   ├── index.js                     # Main Express startup file
│   │   ├── prismaClient.js              # Shared client client to interact with PostgreSQL
│   │   └── mailer.js                    # Verification/OTP dispatch handlers
│   └── package.json                     # Server package dependencies (Express, Prisma, JSONWebToken, etc.)
│
├── frontend/                            # React + Vite Client Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomeView.jsx             # Home dashboard view with mood graphs, task tracking, and AI indicators
│   │   │   ├── ConversationView.jsx     # Guided reflection interview flow (5 questions) + 3-card AI results UI
│   │   │   ├── InsightsView.jsx         # Historical transcript reviews, tone analyses, and dynamic summaries
│   │   │   ├── ActivitiesView.jsx       # Breathing, grounding, and mental resilience utilities
│   │   │   ├── Sidebar.jsx              # Navigation controls
│   │   │   └── Modals.jsx               # Modular modals for breathing routines and hotline details
│   │   ├── App.jsx                      # Main React application shell coordinating states, logs, and token loads
│   │   ├── Auth.jsx                     # Form layouts for login, register, and 6-digit email OTP verify views
│   │   ├── index.css                    # Shared CSS variables and base typography
│   │   └── main.jsx                     # Application entry mounting React DOM
│   └── package.json                     # Frontend npm packages
│
├── notebooks/                           # Jupyter Notebooks used during design phase on Kaggle
│   └── train_joint_phase4.ipynb         # Alternating-batch joint training pipeline for Head 1 & Head 2
├── setup_ffmpeg.py                      # One-click script to download full FFmpeg build (~130MB)
└── .gitignore                           # Defines untracked local checkpoints, node_modules, and ffmpeg
```

---

## ⚙️ Setup & Installation

### Prerequisites
* Node.js (v18+)
* Python (v3.10+)
* PostgreSQL (locally active)

### 0. FFmpeg Setup (Required — One Time)
FFmpeg is needed to convert browser-recorded audio (WebM/Opus) to WAV for Whisper. It is **not** included in the repo due to its size (~130MB). Run this once after cloning:
```bash
python setup_ffmpeg.py
```
This downloads a full FFmpeg build and places `ffmpeg.exe` inside `backend/`.

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