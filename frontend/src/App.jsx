import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trash2,
  Pencil,
  Check,
  Gauge,
  Heart,
  Wind,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Import modular components
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Auth from "./Auth";
import HomeView from "./components/HomeView";
import InsightsView from "./components/InsightsView";
import ActivitiesView from "./components/ActivitiesView";
import ResourcesView from "./components/ResourcesView";
import SupportView from "./components/SupportView";
import RecordingOverlay from "./components/RecordingOverlay";
import { 
  ArticleModal, 
  BreathingModal, 
  GroundingModal, 
  ReframingModal, 
  BodyScanModal, 
  GratitudeModal, 
  HotlinesModal, 
  ChatModal 
} from "./components/Modals";
import { ARTICLES } from "./components/ResourcesView";

const SERVER_API = "http://localhost:5000/api";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const MOODS = [
  { emoji: "😔", label: "Very Low", value: 1 },
  { emoji: "😕", label: "Low", value: 2 },
  { emoji: "😐", label: "Neutral", value: 3 },
  { emoji: "🙂", label: "Good", value: 4 },
  { emoji: "😊", label: "Great", value: 5 },
];

const ENCOURAGEMENTS = [
  "Every check-in is a step toward understanding yourself better 💚",
  "Your feelings are valid — let's explore them together 🌿",
  "Taking time for yourself is an act of strength 🌸",
  "Small steps lead to big changes — you're doing great 🌱",
  "Your voice matters, and so does your wellbeing 🕊️",
];

const MOCK_SCREENINGS = [
  {
    id: "mock-1",
    title: "Wellness check — May 24",
    url: "",
    peaks: [0.2, 0.4, 0.6, 0.5, 0.3, 0.2, 0.4, 0.8, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.2, 0.4, 0.6, 0.5, 0.3, 0.2, 0.4, 0.5, 0.7, 0.8, 0.6, 0.4, 0.2, 0.1],
    duration: 24,
    mood: 4,
    score: 78,
    createdAt: new Date("2026-05-24T08:30:00"),
    transcript: "I've been feeling quite grounded today. The morning air was crisp and I feel like my energy is balanced. I'm looking forward to the quiet tasks ahead of me without feeling the usual rush...",
  },
  {
    id: "mock-2",
    title: "Wellness check — May 25",
    url: "",
    peaks: [0.1, 0.2, 0.3, 0.5, 0.6, 0.4, 0.3, 0.2, 0.1, 0.2, 0.4, 0.5, 0.6, 0.4, 0.2, 0.3, 0.5, 0.6, 0.4, 0.2, 0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.1],
    duration: 15,
    mood: 3,
    score: 65,
    createdAt: new Date("2026-05-25T11:15:00"),
    transcript: "Work was a bit busy today. I felt slightly anxious in the afternoon due to some upcoming deadlines, but doing some box breathing helped me recenter.",
  },
  {
    id: "mock-3",
    title: "Wellness check — May 26",
    url: "",
    peaks: [0.3, 0.5, 0.7, 0.8, 0.9, 0.8, 0.6, 0.5, 0.4, 0.3, 0.5, 0.7, 0.8, 0.7, 0.5, 0.4, 0.6, 0.8, 0.9, 0.8, 0.6, 0.5, 0.4, 0.3, 0.5, 0.6, 0.5, 0.3],
    duration: 32,
    mood: 5,
    score: 88,
    createdAt: new Date("2026-05-26T09:00:00"),
    transcript: "Had a great run in the morning. I feel very energized and clear-headed. Today is going to be a productive day, and I'm happy with how things are going.",
  },
  {
    id: "mock-4",
    title: "Wellness check — May 27",
    url: "",
    peaks: [0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.7, 0.6, 0.5, 0.4, 0.5, 0.6, 0.8, 0.9, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.4, 0.6, 0.8, 0.7, 0.5, 0.3, 0.2, 0.1],
    duration: 20,
    mood: 4,
    score: 75,
    createdAt: new Date("2026-05-27T08:15:00"),
    transcript: "Feeling calm and stable today. The morning routines are working well, and I'm starting to build a consistent habit of checking in.",
  }
];

function formatTime(totalSeconds) {
  if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatWhen(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function downsample(peaks, count) {
  if (peaks.length <= count) return peaks;
  const out = [];
  const block = peaks.length / count;
  for (let i = 0; i < count; i++) {
    let max = 0;
    const start = Math.floor(i * block);
    const end = Math.floor((i + 1) * block);
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j] || 0);
    out.push(max);
  }
  return out;
}

async function extractPeaks(blob, count) {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const raw = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(raw.length / count));
    const peaks = [];
    for (let i = 0; i < count; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(raw[start + j] || 0);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    const maxPeak = Math.max(...peaks, 0.0001);
    const normalized = peaks.map((p) => Math.min(1, Math.max(0.06, p / maxPeak)));
    return { peaks: normalized, duration: audioBuffer.duration };
  } finally {
    ctx.close();
  }
}

/* ─── Encouragement Banner ─── */
function EncouragementBanner() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ENCOURAGEMENTS.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % ENCOURAGEMENTS.length);
        setVisible(true);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`sr-encouragement ${visible ? "sr-encouragement--visible" : ""}`}>
      <Sparkles size={15} />
      <span>{ENCOURAGEMENTS[idx]}</span>
    </div>
  );
}

/* ─── Waveform ─── */
function Waveform({ peaks, progress = 0, onSeek, height = 56, active = false }) {
  return (
    <div
      className="sr-wave"
      style={{ height }}
      onClick={
        onSeek
          ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const fraction = (e.clientX - rect.left) / rect.width;
            onSeek(Math.min(1, Math.max(0, fraction)));
          }
          : undefined
      }
    >
      {peaks.map((p, i) => {
        const played = i / peaks.length < progress;
        return (
          <span
            key={i}
            className={`sr-bar ${played ? "sr-bar--played" : ""} ${active ? "sr-bar--live" : ""}`}
            style={{ height: `${Math.max(6, p * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

/* ─── Note Modal (Detail View) ─── */
function NoteModal({ note, onClose, onRename }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [volume, setVolume] = useState(90);
  const [mutedVol, setMutedVol] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = SPEEDS[speedIdx];
  }, [speedIdx]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !note.url) return; // ignore mock notes with no audio URL
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Play failed:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setCurrent(audio.currentTime);
    setProgress(audio.currentTime / audio.duration);
  };

  const handleSeek = (fraction) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = fraction * audio.duration;
    setProgress(fraction);
    setCurrent(audio.currentTime);
  };

  const toggleMute = () => {
    if (mutedVol === null) {
      setMutedVol(volume);
      setVolume(0);
    } else {
      setVolume(mutedVol);
      setMutedVol(null);
    }
  };

  const cycleSpeed = () => setSpeedIdx((i) => (i + 1) % SPEEDS.length);

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    
    /* FUTURE BACKEND CONNECTION NOTE:
       When renaming a screening, send a PATCH request to the backend database:
       
       fetch(`http://localhost:8000/api/screenings/${note.id}`, {
         method: "PATCH",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ title: trimmed })
       })
       .then(res => res.json())
       .then(data => {
         onRename(note.id, data.title);
       });
    */
    onRename(note.id, trimmed.length ? trimmed : note.title);
    setEditingTitle(false);
  };

  const mood = MOODS.find((m) => m.value === note.mood);

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal" role="dialog" aria-modal="true" style={{ position: "relative" }}>
        {note.url && (
          <audio
            ref={audioRef}
            src={note.url}
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); const a = audioRef.current; if (a) { a.currentTime = 0; setProgress(0); setCurrent(0); } }}
            onTimeUpdate={handleTimeUpdate}
            onError={(e) => console.error("Audio playback error:", e.target.error)}
          />
        )}

        <div className="sr-modal-head">
          {editingTitle ? (
            <div className="sr-title-edit">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                className="sr-edit-title-input"
              />
              <button className="sr-iconbtn" onClick={saveTitle} aria-label="Save name">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="sr-title-edit">
              <h2>{note.title}</h2>
              <button
                className="sr-iconbtn"
                onClick={() => { setTitleDraft(note.title); setEditingTitle(true); }}
                aria-label="Rename note"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        
        <div className="sr-modal-meta">
          {mood && <span className="sr-modal-mood">{mood.emoji} {mood.label}</span>}
          <span>{formatWhen(note.createdAt)}</span>
        </div>

        {/* Player controls (only show if audio URL exists, otherwise show simulated waveform player) */}
        <div className="sr-player">
          <Waveform peaks={note.peaks} progress={progress} onSeek={note.url ? handleSeek : undefined} height={88} />

          <div className="sr-transport">
            <button 
              className={`sr-playbtn ${!note.url ? "sr-playbtn--disabled" : ""}`} 
              onClick={togglePlay} 
              disabled={!note.url}
              aria-label={playing ? "Pause" : "Play"}
              title={!note.url ? "Mock note has no audio playback payload" : ""}
            >
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>

            <span className="sr-mono sr-time">
              {formatTime(current)} <span className="sr-time-sep">/</span> {formatTime(note.duration)}
            </span>

            <button className="sr-speedbtn" onClick={cycleSpeed} aria-label="Playback speed" disabled={!note.url}>
              <Gauge size={14} />
              {SPEEDS[speedIdx]}×
            </button>

            <div className="sr-volume">
              <button className="sr-iconbtn" onClick={toggleMute} aria-label={volume === 0 ? "Unmute" : "Mute"} disabled={!note.url}>
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                className="sr-range"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => { setMutedVol(null); setVolume(Number(e.target.value)); }}
                disabled={!note.url}
              />
            </div>
          </div>
          {!note.url && (
            <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 8, fontStyle: "italic", textAlign: "center" }}>
              Audio streaming playback is only available for live screenings recorded in this session.
            </div>
          )}
        </div>

        {/* Wellness score display */}
        {note.score !== undefined && (
          <div className="sr-score-section">
            <div className="sr-score-ring">
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(91,154,139,0.15)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="6"
                  strokeDasharray={`${(note.score / 100) * 213.6} 213.6`}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <span className="sr-score-value">{note.score}%</span>
            </div>
            <span className="sr-score-label">Wellness Score</span>
          </div>
        )}

        <div className="sr-transcript">
          <div className="sr-transcript-label">Transcript</div>
          <div className={`sr-transcript-body ${!note.transcript ? "sr-transcript-body--empty" : ""}`}>
            {note.transcript || "Transcription will appear here once your model has processed this recording."}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App Component ─── */
export default function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  // Notes/Screenings State
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${SERVER_API}/screenings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const mapped = data.map((s) => ({
          id: s.id,
          title: `Wellness check — ${new Date(s.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}`,
          url: s.audioUrl,
          peaks: Array(60).fill(0.2),
          duration: 0,
          mood: 3,
          score: s.conditionConfidence ? Math.round(s.conditionConfidence * 100) : undefined,
          createdAt: new Date(s.createdAt),
          transcript: s.transcript || "",
        }));
        setNotes(mapped);
      })
      .catch((err) => console.error("Failed to load screenings:", err));
  }, [token]);

  // Today's Focus Checklist State (Persisted in LocalStorage)
  const [focusTasks, setFocusTasks] = useState(() => {
    const saved = localStorage.getItem("focusTasks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { breathwork: true, trends: false };
      }
    }
    return { breathwork: true, trends: false };
  });

  useEffect(() => {
    localStorage.setItem("focusTasks", JSON.stringify(focusTasks));
  }, [focusTasks]);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveLevels, setLiveLevels] = useState(Array(40).fill(0.06));
  const [micError, setMicError] = useState("");
  const [selectedMood, setSelectedMood] = useState(null);

  // Active Modals state
  const [activeNote, setActiveNote] = useState(null); // past screening player
  const [activeModal, setActiveModal] = useState(null); // activities, articles, help modals

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const mimeTypeRef = useRef("audio/webm");

  const cleanupRecording = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const tickLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const bars = 40;
    const loop = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / bars));
      const levels = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        levels.push(Math.max(0.06, sum / step / 255));
      }
      setLiveLevels(levels);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, []);

  const startRecording = async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      let chosenMime = "";
      for (const t of preferredTypes) {
        if (MediaRecorder.isTypeSupported(t)) { chosenMime = t; break; }
      }
      mimeTypeRef.current = chosenMime || "audio/webm";

      const mrOptions = chosenMime ? { mimeType: chosenMime } : {};
      const mr = new MediaRecorder(stream, mrOptions);
      chunksRef.current = [];
      cancelledRef.current = false;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = handleRecordingStop;
      mediaRecorderRef.current = mr;
      mr.start(250);

      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
      tickLevels();
    } catch (err) {
      setMicError("Couldn't access your microphone. Check your browser permissions and try again.");
    }
  };

  const handleRecordingStop = async () => {
    cleanupRecording();
    setIsRecording(false);
    if (cancelledRef.current) return;

    setIsProcessing(true);

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    console.log("Recording blob:", blob.size, "bytes, type:", blob.type);

    // Convert to data URL for reliable cross-browser playback
    const url = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    let peaks = Array(60).fill(0.2);
    let duration = elapsed;
    try {
      const extracted = await extractPeaks(blob, 60);
      peaks = extracted.peaks;
      duration = extracted.duration;
    } catch (e) {
      // fall back to flat waveform if decoding isn't supported
    }

    const noteId = `${Date.now()}`;
    const newNote = {
      id: noteId,
      title: `Wellness check — ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}`,
      url,
      peaks,
      duration,
      mood: selectedMood || 3, // default to neutral if none selected
      score: undefined, // score will be calculated and saved alongside transcription
      createdAt: new Date(),
      transcript: "Transcribing...",
    };

    setNotes((prev) => [newNote, ...prev]);
    setSelectedMood(null);

    // Send audio blob to Python FastAPI backend for Whisper transcription
    const formData = new FormData();
    const fileExtension = mimeTypeRef.current.includes("webm") ? "webm" : mimeTypeRef.current.includes("ogg") ? "ogg" : "mp4";
    formData.append("file", blob, `checkin.${fileExtension}`);

    /* FUTURE BACKEND CONNECTION NOTE:
       When integrating the database, this POST request will hit the `/api/screenings` endpoint 
       with the audio file and mood metadata. The backend should save the audio, transcribe it, 
       calculate the acoustic sentiment Wellness Score, save it in SQLite, and return the complete object:
       
       formData.append("mood", selectedMood || 3);
       fetch("http://localhost:8000/api/screenings", { ... })
    */
    fetch("http://localhost:8000/api/transcribe", {
      method: "POST",
      body: formData,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.detail || "Server error");
          });
        }
        return res.json();
      })
      .then((data) => {
        // Calculate a realistic simulated wellness score in the frontend (since backend calculations are deferred)
        const moodWeight = newNote.mood ? newNote.mood * 8 : 24;
        const mockScore = Math.min(100, Math.max(45, 55 + moodWeight + Math.floor(Math.random() * 8)));

        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, transcript: data.transcript, score: mockScore } : n))
        );

        // Unlock the "Review Voice Trends" checklist item
        setFocusTasks((prev) => ({ ...prev, trends: false }));

        const saveFormData = new FormData();
        saveFormData.append("audio", blob, `checkin.${fileExtension}`);
        saveFormData.append("conditionLabel", "pending");
        saveFormData.append("conditionConfidence", "0");
        saveFormData.append("causeLabel", "pending");
        saveFormData.append("causeConfidence", "0");

        fetch(`${SERVER_API}/screenings`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: saveFormData,
        }).catch((err) => console.error("Failed to save screening to database:", err));
      })
      .catch((err) => {
        console.error("Transcription error:", err);
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, transcript: `[Transcription failed: ${err.message}]`, score: 50 } : n))
        );
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  const stopRecording = () => {
    cancelledRef.current = false;
    mediaRecorderRef.current && mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    mediaRecorderRef.current && mediaRecorderRef.current.stop();
  };

  const deleteNote = (id) => {
    /* FUTURE BACKEND CONNECTION NOTE:
       Send a DELETE request to `http://localhost:8000/api/screenings/${id}`
    */
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActiveNote((n) => (n && n.id === id ? null : n));
  };

  const renameNote = (id, title) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
    setActiveNote((n) => (n && n.id === id ? { ...n, title } : n));
  };

  const toggleFocusTask = (taskKey) => {
    setFocusTasks((prev) => ({
      ...prev,
      [taskKey]: !prev[taskKey]
    }));
  };

  const handleOpenModal = (modalName) => {
    setActiveModal(modalName);
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case "home": return "Home";
      case "insights": return "Voice Insights";
      case "activities": return "Wellness Activities";
      case "resources": return "Knowledge Library";
      case "support": return "Support & Assistance";
      default: return "SerenityScreen";
    }
  };

  useEffect(() => () => cleanupRecording(), [cleanupRecording]);

  const renderActiveView = () => {
    switch (currentTab) {
      case "home":
        return (
          <HomeView
            notes={notes}
            onStartScreening={startRecording}
            focusTasks={focusTasks}
            onToggleFocusTask={toggleFocusTask}
            onOpenModal={handleOpenModal}
          />
        );
      case "insights":
        return (
          <InsightsView
            notes={notes}
            onOpenNote={setActiveNote}
            searchQuery={searchQuery}
          />
        );
      case "activities":
        return <ActivitiesView onOpenModal={handleOpenModal} />;
      case "resources":
        return <ResourcesView onOpenModal={handleOpenModal} searchQuery={searchQuery} />;
      case "support":
        return <SupportView onOpenModal={handleOpenModal} />;
      default:
        return null;
    }
  };

  if (!token) {
    return <Auth onLoginSuccess={(u, t) => { setUser(u); setToken(t); }} />;
  }

  return (
    <div className="sr-app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        /* ─── Base Styles & Global Resets ─── */
        body {
          margin: 0;
          font-family: 'Outfit', 'Nunito', sans-serif;
          background: #f0f4f3;
        }

        :root {
          --paper: #f0f4f3;
          --paper-end: #e8eff5;
          --ink: #2d3436;
          --ink-soft: #636e72;
          --ink-faint: #95a5a6;
          --line: rgba(91,154,139,0.15);
          --surface: rgba(255,255,255,0.55);
          --surface-solid: #f7faf9;
          --accent: #5b9a8b;
          --accent-light: #7ab8a8;
          --accent-soft: #e8f5f0;
          --accent-ink: #3d7a6b;
          --accent-glow: rgba(91,154,139,0.25);
          --warm: #e8c4a0;
          --lavender: #c4b5e0;
          --rose: #e8a0b4;
          --glass: rgba(255,255,255,0.6);
          --glass-border: rgba(255,255,255,0.45);
          --shadow-soft: 0 8px 32px -8px rgba(45,52,54,0.1);
          --shadow-hover: 0 16px 40px -12px rgba(91,154,139,0.2);
          --radius: 20px;
          --radius-lg: 26px;
        }

        .sr-app-container {
          display: flex;
          min-height: 100vh;
          width: 100%;
          background: linear-gradient(145deg, var(--paper) 0%, var(--paper-end) 50%, #f2eef8 100%);
          position: relative;
          overflow-x: hidden;
        }

        .sr-main-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          overflow-y: auto;
          padding-left: 260px; /* Offset for sidebar */
          position: relative;
          z-index: 1;
        }

        /* ─── Floating Background Blobs ─── */
        .sr-app-container::before,
        .sr-app-container::after,
        .sr-background-blob {
          content: '';
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
        }
        .sr-app-container::before {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(91,154,139,0.3), transparent 70%);
          top: -100px; right: -80px;
          animation: sr-float1 20s ease-in-out infinite;
        }
        .sr-app-container::after {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(196,181,224,0.25), transparent 70%);
          bottom: -50px; left: 100px;
          animation: sr-float2 25s ease-in-out infinite;
        }
        .sr-background-blob {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(232,160,180,0.3), transparent 70%);
          top: 40%; left: 50%;
          animation: sr-float3 22s ease-in-out infinite;
        }

        @keyframes sr-float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes sr-float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(25px, -35px) scale(0.98); }
        }
        @keyframes sr-float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(35px, 40px) scale(1.08); }
        }

        @keyframes sr-fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── Sidebar Navigation Styles ─── */
        .sr-sidebar {
          width: 260px;
          height: 100vh;
          background: #f5f8f7;
          border-right: 1px solid var(--glass-border);
          position: fixed;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 32px 0 24px;
          z-index: 10;
        }
        .sr-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 24px;
          cursor: pointer;
          margin-bottom: 28px;
        }
        .sr-sidebar-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #2b614f;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(43,97,79,0.2);
        }
        .sr-sidebar-brand-text {
          display: flex;
          flex-direction: column;
        }
        .sr-brand-name {
          font-weight: 700;
          font-size: 17px;
          color: #2b614f;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .sr-brand-tagline {
          font-size: 11px;
          color: var(--ink-soft);
        }
        .sr-sidebar-nav {
          flex: 1;
        }
        .sr-sidebar-nav ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sr-sidebar-link {
          width: 100%;
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 24px;
          color: var(--ink-soft);
          font-size: 14.5px;
          font-weight: 550;
          cursor: pointer;
          text-align: left;
          position: relative;
          transition: all 0.2s ease;
        }
        .sr-sidebar-link:hover {
          color: #2b614f;
          background: rgba(43,97,79,0.04);
        }
        .sr-sidebar-link--active {
          color: #2b614f;
          background: #e6edea;
          font-weight: 600;
        }
        .sr-active-indicator {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 4px;
          background: #2b614f;
          border-radius: 4px 0 0 4px;
        }
        .sr-sidebar-footer {
          padding: 0 24px;
        }
        .sr-capsule-btn {
          width: 100%;
          border: none;
          background: #2b614f;
          color: #fff;
          padding: 13px 20px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(43,97,79,0.25);
        }
        .sr-capsule-btn:hover {
          background: #1f4739;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(43,97,79,0.3);
        }

        /* ─── Top Bar Layout ─── */
        .sr-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          background: transparent;
          position: sticky;
          top: 0;
          z-index: 8;
        }
        .sr-topbar-title {
          font-size: 22px;
          font-weight: 700;
          color: #000;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .sr-topbar-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .sr-search-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .sr-search-icon {
          position: absolute;
          left: 14px;
          color: var(--ink-faint);
          pointer-events: none;
        }
        .sr-search-input {
          background: #f1f3f2;
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 10px 16px 10px 40px;
          font-size: 13px;
          color: var(--ink);
          width: 240px;
          outline: none;
          transition: all 0.2s ease;
        }
        .sr-search-input:focus {
          background: #fff;
          border-color: var(--line);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .sr-iconbtn {
          border: none;
          background: transparent;
          color: var(--ink-soft);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          flex: none;
        }
        .sr-iconbtn:hover {
          background: rgba(91,154,139,0.08);
          color: var(--accent-ink);
        }
        .sr-avatar-btn {
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
          border-radius: 50%;
        }
        .sr-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e1eae6;
          color: var(--accent-ink);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }
        .sr-avatar-btn:hover .sr-avatar {
          background: #d4e2dc;
        }

        /* ─── Home View Layout ─── */
        .sr-hero-card {
          background: #2b614f; /* dark emerald green */
          border-radius: 28px;
          padding: 48px 48px;
          color: #fff;
          margin: 0 40px 32px;
          box-shadow: 0 12px 36px rgba(43,97,79,0.15);
          position: relative;
          overflow: hidden;
        }
        .sr-hero-card::before {
          content: '';
          position: absolute;
          top: -10%; right: -5%;
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(189,245,231,0.12), transparent 70%);
          pointer-events: none;
        }
        .sr-hero-content {
          max-width: 540px;
          position: relative;
          z-index: 1;
          text-align: left;
        }
        .sr-hero-content h1 {
          font-size: 34px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 14px;
          letter-spacing: -0.03em;
        }
        .sr-hero-content p {
          font-size: 15.5px;
          line-height: 1.6;
          opacity: 0.9;
          margin: 0 0 28px;
        }
        .sr-hero-btn {
          border: none;
          background: #bdf5e7; /* light mint */
          color: #1a3c31;
          padding: 13px 26px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(189,245,231,0.2);
        }
        .sr-hero-btn:hover {
          background: #a3ebd9;
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(189,245,231,0.3);
        }
        .sr-home-columns {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 28px;
          margin: 0 40px 48px;
        }
        .sr-dashboard-card {
          background: #fff;
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.015);
          border: 1px solid var(--glass-border);
          text-align: left;
        }
        .sr-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .sr-card-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #000;
          letter-spacing: -0.01em;
        }
        .sr-select {
          background: #f1f3f2;
          border: none;
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 12.5px;
          color: var(--ink);
          outline: none;
          cursor: pointer;
          font-weight: 550;
        }
        .sr-chart-container {
          height: 180px;
          position: relative;
          margin-top: 10px;
          display: flex;
          flex-direction: column;
        }
        .sr-analytics-svg {
          flex: 1;
          overflow: visible;
        }
        .sr-chart-xaxis {
          display: flex;
          justify-content: space-between;
          padding: 8px 30px 0;
          border-top: 1px solid #f1f3f2;
        }
        .sr-xaxis-label {
          font-size: 11.5px;
          color: var(--ink-faint);
          font-weight: 550;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }
        .sr-xaxis-label--peak {
          color: var(--accent-ink);
          font-weight: 700;
        }
        .sr-peak-badge {
          position: absolute;
          bottom: 100%;
          margin-bottom: 18px;
          background: var(--accent-ink);
          color: #fff;
          font-size: 9px;
          padding: 3px 6px;
          border-radius: 6px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 6px rgba(43,97,79,0.3);
          white-space: nowrap;
        }
        .sr-peak-badge::after {
          content: '';
          position: absolute;
          top: 100%; left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: var(--accent-ink);
        }
        .sr-focus-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 24px;
        }
        .sr-focus-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 15px 18px;
          border-radius: 18px;
          border: 1px solid #edf2f0;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sr-focus-item:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
          transform: translateY(-1px);
        }
        .sr-focus-item--completed {
          border-color: #edf2f0;
          background: #fafcfb;
        }
        .sr-focus-item--locked {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sr-focus-item--locked:hover {
          border-color: #edf2f0;
          background: #fff;
          transform: none;
        }
        .sr-checkbox-icon {
          flex: none;
          display: flex;
          align-items: center;
        }
        .sr-checked-green {
          color: var(--accent-ink);
        }
        .sr-unchecked-gray {
          color: var(--ink-faint);
        }
        .sr-focus-item-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sr-focus-title {
          font-size: 14.5px;
          font-weight: 600;
          color: #000;
        }
        .sr-focus-subtitle {
          font-size: 11.5px;
          color: var(--ink-soft);
        }
        .sr-focus-progress {
          margin-top: auto;
        }
        .sr-progress-track {
          height: 6px;
          background: #edf2f0;
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .sr-progress-bar {
          height: 100%;
          background: var(--accent-ink);
          border-radius: 99px;
          transition: width 0.4s ease;
        }
        .sr-progress-label {
          font-size: 12px;
          color: var(--ink-soft);
          font-weight: 550;
        }

        /* ─── Activities Layout ─── */
        .sr-activities-view, .sr-resources-view, .sr-insights-view, .sr-support-view {
          margin: 0 40px 48px;
          animation: sr-fadeIn 0.35s ease both;
          text-align: left;
        }
        .sr-activities-h2, .sr-resources-h2 {
          font-size: 18px;
          font-weight: 700;
          color: #000;
          margin: 0 0 20px;
          letter-spacing: -0.01em;
        }
        .sr-activities-grid {
          display: grid;
          gap: 20px;
        }
        .sr-activities-grid--breathing {
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        }
        .sr-activities-grid--exercises {
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        }
        .sr-activity-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 24px;
          border-radius: 22px;
          background: #fff;
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.01);
        }
        .sr-activity-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(91,154,139,0.12);
          border-color: var(--accent);
        }
        .sr-activity-card-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .sr-activity-theme--mint .sr-activity-card-icon {
          background: #e8fdf8;
          color: #1abc9c;
        }
        .sr-activity-theme--teal .sr-activity-card-icon {
          background: #e6f6f7;
          color: #16a085;
        }
        .sr-activity-card-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sr-activity-card-info h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #000;
        }
        .sr-activity-card-meta {
          font-size: 13px;
          color: var(--ink-soft);
          font-weight: 550;
        }
        .sr-card-arrow {
          color: var(--ink-faint);
          transition: transform 0.2s ease, color 0.2s ease;
        }
        .sr-activity-card:hover .sr-card-arrow,
        .sr-resource-card:hover .sr-card-arrow {
          color: var(--accent-ink);
          transform: translateX(2px);
        }
        .sr-exercise-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          padding: 28px 20px;
          border-radius: 22px;
          background: #fff;
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.01);
        }
        .sr-exercise-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.06);
          border-color: var(--accent);
        }
        .sr-exercise-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sr-exercise-theme--blue .sr-exercise-card-icon { background: #ebf5fb; color: #2980b9; }
        .sr-exercise-theme--purple .sr-exercise-card-icon { background: #f5eef8; color: #8e44ad; }
        .sr-exercise-theme--orange .sr-exercise-card-icon { background: #fdf2e9; color: #d35400; }
        .sr-exercise-theme--emerald .sr-exercise-card-icon { background: #e8f8f5; color: #27ae60; }
        .sr-exercise-card-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sr-exercise-card-info h3 {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #000;
          line-height: 1.3;
        }
        .sr-exercise-card-subtitle {
          font-size: 12px;
          color: var(--ink-soft);
        }

        /* ─── Resources Layout ─── */
        .sr-resources-split {
          display: grid;
          grid-template-columns: 1.7fr 1fr;
          gap: 32px;
        }
        .sr-resources-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .sr-resource-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 20px 24px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.01);
          text-align: left;
        }
        .sr-resource-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: 0 8px 24px rgba(91,154,139,0.08);
        }
        .sr-resource-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #f1f3f2;
          color: var(--accent-ink);
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .sr-resource-info {
          flex: 1;
        }
        .sr-resource-info h3 {
          margin: 0 0 4px;
          font-size: 15.5px;
          font-weight: 700;
          color: #000;
        }
        .sr-resource-info p {
          margin: 0;
          font-size: 12.5px;
          color: var(--ink-soft);
          line-height: 1.45;
        }
        .sr-crisis-card {
          background: #fffdfd;
          border: 1px solid rgba(231,76,60,0.15);
          border-radius: 26px;
          padding: 30px;
          box-shadow: 0 8px 30px -10px rgba(231,76,60,0.08);
          text-align: left;
        }
        .sr-crisis-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .sr-crisis-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #c0392b;
        }
        .sr-red-icon {
          color: #e74c3c;
        }
        .sr-crisis-card p {
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          margin: 0 0 24px;
        }
        .sr-crisis-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sr-crisis-btn {
          width: 100%;
          border: none;
          padding: 12px 20px;
          border-radius: 999px;
          font-size: 13.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sr-crisis-btn--primary {
          background: #c0392b;
          color: #fff;
          box-shadow: 0 4px 12px rgba(192,57,43,0.2);
        }
        .sr-crisis-btn--primary:hover {
          background: #a93226;
          transform: translateY(-1px);
        }
        .sr-crisis-btn--secondary {
          background: #fff;
          border: 1px solid rgba(231,76,60,0.25);
          color: #c0392b;
        }
        .sr-crisis-btn--secondary:hover {
          background: rgba(231,76,60,0.03);
          border-color: #c0392b;
          transform: translateY(-1px);
        }

        /* ─── Insights View Layout ─── */
        .sr-analysis-card {
          background: #fff;
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.015);
          border: 1px solid var(--glass-border);
          margin-bottom: 28px;
        }
        .sr-analysis-card h3 {
          margin: 0 0 20px;
          font-size: 18px;
          font-weight: 700;
          color: #000;
        }
        .sr-analysis-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 32px;
        }
        .sr-analysis-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-ink);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: block;
          margin-bottom: 14px;
        }
        .sr-analysis-patterns ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sr-analysis-patterns li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
        }
        .sr-bullet-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          margin-top: 7px;
          flex: none;
        }
        .sr-reflection-box {
          background: #f6f8f7;
          border-radius: 20px;
          padding: 20px;
          border: 1px solid #edf2f0;
          height: 100%;
        }
        .sr-reflection-label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink);
          display: block;
          margin-bottom: 8px;
        }
        .sr-reflection-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-soft);
          font-style: italic;
        }
        .sr-transcripts-header {
          margin-bottom: 18px;
        }
        .sr-transcripts-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #000;
        }
        .sr-transcripts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sr-transcript-row-card {
          background: #fff;
          border-radius: 20px;
          border: 1px solid var(--glass-border);
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.01);
        }
        .sr-transcript-row-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: 0 8px 20px rgba(91,154,139,0.08);
        }
        .sr-transcript-row-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sr-row-mood {
          font-size: 26px;
          line-height: 1;
        }
        .sr-row-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sr-row-meta h4 {
          margin: 0;
          font-size: 14.5px;
          font-weight: 600;
          color: #000;
        }
        .sr-row-date {
          font-size: 11.5px;
          color: var(--ink-faint);
        }
        .sr-transcript-row-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sr-row-score-badge {
          background: var(--accent-soft);
          color: var(--accent-ink);
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sr-row-duration {
          font-family: monospace;
          font-size: 12.5px;
          color: var(--ink-soft);
        }
        .sr-row-badge-analyzed {
          background: #edf2f0;
          color: var(--ink-soft);
          font-size: 11px;
          font-weight: 550;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* ─── Generic Modals & Overlays ─── */
        .sr-overlay {
          position: fixed; inset: 0;
          background: rgba(45,52,54,0.35);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          z-index: 50;
          animation: sr-fadeIn 0.2s ease;
        }
        .sr-modal {
          width: 100%; max-width: 580px;
          max-height: 88vh;
          overflow-y: auto;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(24px) saturate(1.4);
          border-radius: var(--radius-lg);
          border: 1px solid var(--glass-border);
          box-shadow: 0 30px 60px -20px rgba(45,52,54,0.2);
          padding: 28px 30px 30px;
          animation: sr-fadeIn 0.35s ease;
          text-align: left;
        }
        .sr-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }
        .sr-modal-head h2 {
          font-weight: 700;
          font-size: 21px;
          margin: 0;
          letter-spacing: -0.02em;
          color: #000000;
        }
        .sr-title-edit { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .sr-edit-title-input {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 600;
          border: none;
          border-bottom: 2px solid var(--accent);
          background: transparent;
          padding: 0 0 2px;
          flex: 1;
          min-width: 0;
          outline: none;
          color: #000000;
        }
        .sr-close { margin-top: -2px; }
        .sr-modal-meta {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: var(--ink-faint); margin-top: 6px;
        }
        .sr-modal-mood { font-size: 14px; }

        /* ─── Waveform Player ─── */
        .sr-player {
          margin-top: 24px;
          background: var(--glass);
          backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          padding: 22px 22px 18px;
        }
        .sr-wave {
          display: flex;
          align-items: flex-end;
          gap: 2.5px;
          width: 100%;
          cursor: pointer;
        }
        .sr-bar {
          flex: 1;
          min-width: 2px;
          border-radius: 4px;
          background: rgba(91,154,139,0.2);
          transition: background 0.2s ease, height 0.08s linear;
        }
        .sr-bar--played { background: var(--accent); }
        .sr-bar--live { background: var(--accent); }
        .sr-transport {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 18px;
        }
        .sr-playbtn {
          flex: none;
          width: 44px; height: 44px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-ink));
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(91,154,139,0.3);
        }
        .sr-playbtn:hover { transform: scale(1.06); box-shadow: 0 6px 16px rgba(91,154,139,0.35); }
        .sr-playbtn--disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--ink-faint);
          box-shadow: none;
        }
        .sr-playbtn--disabled:hover {
          transform: none;
          box-shadow: none;
        }
        .sr-time { font-size: 13px; color: var(--ink-soft); flex: none; }
        .sr-time-sep { color: var(--ink-faint); }
        .sr-speedbtn {
          flex: none;
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid var(--line);
          background: var(--glass);
          color: var(--ink);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          padding: 6px 12px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sr-speedbtn:hover { border-color: var(--accent); background: var(--accent-soft); }
        .sr-speedbtn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sr-volume { display: flex; align-items: center; gap: 4px; margin-left: auto; }
        .sr-range {
          -webkit-appearance: none;
          appearance: none;
          width: 76px;
          height: 4px;
          border-radius: 4px;
          background: var(--line);
          outline: none;
          cursor: pointer;
        }
        .sr-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(91,154,139,0.3);
        }
        .sr-range::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(91,154,139,0.3);
        }
        .sr-range:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ─── Score Display ─── */
        .sr-score-section {
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: linear-gradient(135deg, var(--accent-soft), rgba(196,181,224,0.1));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
        }
        .sr-score-ring {
          position: relative;
          width: 64px; height: 64px;
          flex: none;
        }
        .sr-score-ring svg { width: 100%; height: 100%; }
        .sr-score-value {
          position: absolute;
          inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 16px; color: var(--accent-ink);
        }
        .sr-score-label { font-size: 14px; font-weight: 600; color: var(--accent-ink); }

        /* ─── Transcript Body ─── */
        .sr-transcript { margin-top: 22px; }
        .sr-transcript-label {
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-faint);
          margin-bottom: 10px;
        }
        .sr-transcript-body {
          font-family: 'Nunito', sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink);
          max-height: 220px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .sr-transcript-body--empty {
          color: var(--ink-faint);
          font-style: italic;
        }

        /* ─── Encouragement Banner ─── */
        .sr-encouragement {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          font-size: 13.5px;
          font-weight: 650;
          color: var(--accent-ink);
          background: linear-gradient(135deg, var(--accent-soft), rgba(196,181,224,0.15));
          border-bottom: 1px solid var(--glass-border);
          opacity: 0;
          transition: opacity 0.5s ease;
          position: relative;
          z-index: 4;
        }
        .sr-encouragement--visible { opacity: 1; }

        /* ─── Article Modal Typography ─── */
        .sr-modal--article {
          max-width: 680px;
        }
        .sr-article-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--ink-faint);
          background: #f1f3f2;
          padding: 5px 10px;
          border-radius: 6px;
          margin-bottom: 14px;
        }
        .sr-article-title {
          font-size: 24px;
          font-weight: 700;
          color: #000;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }
        .sr-article-subtitle {
          font-size: 14.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          margin: 0 0 16px;
        }
        .sr-divider {
          border: none;
          border-top: 1px solid #edf2f0;
          margin: 16px 0;
        }
        .sr-article-body {
          font-size: 15px;
          line-height: 1.75;
          color: var(--ink);
        }
        .sr-article-body p {
          margin: 0 0 16px;
        }
        .sr-article-footer {
          margin-top: 24px;
          display: flex;
          justify-content: flex-end;
        }
        .sr-actionbtn {
          border: none;
          padding: 12px 24px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sr-actionbtn--accent {
          background: var(--accent-ink);
          color: #fff;
        }
        .sr-actionbtn--accent:hover {
          background: #2b614f;
        }
        .sr-actionbtn--secondary {
          background: #f1f3f2;
          color: var(--ink);
        }
        .sr-actionbtn--secondary:hover {
          background: #e2e5e4;
        }
        .sr-actionbtn--danger {
          background: #c0392b;
          color: #fff;
        }
        .sr-actionbtn--danger:hover {
          background: #a93226;
        }
        .sr-actionbtn--disabled {
          background: #cbd5e1;
          color: #94a3b8;
          cursor: not-allowed;
        }

        /* ─── Breathing Exercises Animation ─── */
        .sr-breathe-container {
          text-align: center;
          margin: 20px 0;
        }
        .sr-breathe-circle-outer {
          width: 180px; height: 180px;
          border-radius: 50%;
          background: rgba(91,154,139,0.06);
          display: flex; align-items: center; justify-content: center;
          margin: 24px auto 20px;
          transition: transform 4s ease-in-out, background-color 4s ease-in-out;
        }
        .sr-breathe-circle-inner {
          width: 120px; height: 120px;
          border-radius: 50%;
          background: rgba(91,154,139,0.12);
          border: 3px solid var(--accent);
          display: flex; align-items: center; justify-content: center;
          transition: transform 4s ease-in-out, background-color 4s ease-in-out, border-color 4s ease-in-out;
        }
        .sr-breathe-circle-outer--inhale {
          transform: scale(1.18);
          background: rgba(91,154,139,0.14);
        }
        .sr-breathe-circle-inner--inhale {
          transform: scale(1.18);
          background: rgba(91,154,139,0.22);
          border-color: var(--accent);
        }
        .sr-breathe-circle-outer--hold1, .sr-breathe-circle-outer--hold2 {
          transform: scale(1.18);
          background: rgba(196,181,224,0.12);
          animation: sr-breathe-glow 1.5s ease-in-out infinite alternate;
        }
        .sr-breathe-circle-inner--hold1, .sr-breathe-circle-inner--hold2 {
          transform: scale(1.18);
          background: rgba(196,181,224,0.22);
          border-color: var(--lavender);
        }
        .sr-breathe-circle-outer--exhale {
          transform: scale(0.85);
          background: rgba(232,160,180,0.06);
        }
        .sr-breathe-circle-inner--exhale {
          transform: scale(0.85);
          background: rgba(232,160,180,0.12);
          border-color: var(--rose);
        }
        @keyframes sr-breathe-glow {
          from { box-shadow: 0 0 0 0 rgba(196,181,224,0.15); }
          to { box-shadow: 0 0 16px 4px rgba(196,181,224,0.3); }
        }
        .sr-breathe-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .sr-breathe-number {
          font-size: 32px;
          font-weight: 750;
          color: var(--accent-ink);
          line-height: 1;
        }
        .sr-breathe-cycle {
          font-size: 11px;
          color: var(--ink-soft);
          font-weight: 550;
        }
        .sr-checkmark-green {
          color: var(--accent-ink);
        }
        .sr-breathe-phase-label {
          margin: 12px 0 4px;
          font-size: 18px;
          font-weight: 700;
          color: #000;
        }
        .sr-breathe-phase-desc {
          margin: 0;
          font-size: 13.5px;
          color: var(--ink-soft);
        }

        /* ─── Grounding Steps & Forms ─── */
        .sr-grounding-steps {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: 14px 0 24px;
        }
        .sr-grounding-dot {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: #edf2f0;
          color: var(--ink-soft);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: bold;
          transition: all 0.3s;
        }
        .sr-grounding-dot--active {
          background: var(--accent-ink);
          color: #fff;
          box-shadow: 0 3px 8px rgba(43,97,79,0.25);
        }
        .sr-grounding-dot--passed {
          background: var(--accent-soft);
          color: var(--accent-ink);
        }
        .sr-grounding-prompt {
          font-size: 15px;
          color: #000;
          font-weight: 600;
          margin: 0 0 14px;
        }
        .sr-highlight {
          color: var(--accent-ink);
          font-weight: 700;
        }
        .sr-input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sr-grounding-input {
          border: 1px solid #e2e8f0;
          background: #f8f9fa;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 13px;
          outline: none;
          color: #000;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .sr-grounding-input:focus {
          border-color: var(--accent);
          background: #fff;
        }
        .sr-completed-illustration {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: var(--accent-soft);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent-ink);
          margin: 0 auto 16px;
        }
        .sr-grounding-summary-card {
          margin-top: 20px;
          background: #f6f8f7;
          border: 1px solid #edf2f0;
          border-radius: 16px;
          padding: 16px 20px;
          font-size: 13px;
        }
        .sr-grounding-summary-card ul {
          margin: 8px 0 0;
          padding-left: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          list-style: none;
          text-align: left;
        }

        /* ─── Cognitive Reframing log style ─── */
        .sr-textarea {
          width: 100%;
          border: 1px solid #e2e8f0;
          background: #f8f9fa;
          border-radius: 14px;
          padding: 12px 16px;
          font-family: inherit;
          font-size: 13.5px;
          line-height: 1.5;
          outline: none;
          resize: none;
          color: #000;
          margin: 8px 0 16px;
          transition: all 0.2s;
        }
        .sr-textarea:focus {
          border-color: var(--accent);
          background: #fff;
        }
        .sr-label {
          font-size: 14px;
          font-weight: 700;
          color: #000;
          display: block;
        }
        .sr-sublabel {
          font-size: 11.5px;
          color: var(--ink-soft);
          display: block;
          margin-top: 2px;
        }
        .sr-reframing-tips {
          background: #fdf2e9;
          border: 1px solid #fae5d3;
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 12px;
          color: #d35400;
        }
        .sr-reframing-tips ul {
          margin: 6px 0 0;
          padding-left: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sr-original-thought-quote {
          background: #f5f5f5;
          border-left: 3px solid var(--ink-faint);
          padding: 12px 16px;
          border-radius: 0 12px 12px 0;
          font-size: 13px;
          color: var(--ink-soft);
          margin-bottom: 18px;
        }

        /* ─── Mic Pulsing & Recording Overlay ─── */
        .sr-spinner-ring {
          width: 64px; height: 64px;
          border-radius: 50%;
          border: 3px solid var(--accent-soft);
          border-top-color: var(--accent);
          animation: sr-spin 1s linear infinite;
        }
        .sr-spinner-mic {
          position: absolute;
          color: var(--accent-ink);
        }
        .sr-processing-spinner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px; height: 64px;
          margin: 0 auto;
        }
        @keyframes sr-spin {
          to { transform: rotate(360deg); }
        }
        .sr-rec-indicator-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #e74c3c;
          animation: sr-rec-pulse 1.2s infinite;
          margin-right: 4px;
        }
        @keyframes sr-rec-pulse {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        .sr-recording-level-bar {
          background: #e74c3c !important;
        }

        /* ─── Custom scrollbars for clean layouts ─── */
        .sr-transcript-body::-webkit-scrollbar,
        .sr-modal::-webkit-scrollbar,
        .sr-main-workspace::-webkit-scrollbar,
        .sr-gratitude-list::-webkit-scrollbar {
          width: 6px;
        }
        .sr-transcript-body::-webkit-scrollbar-track,
        .sr-modal::-webkit-scrollbar-track,
        .sr-main-workspace::-webkit-scrollbar-track,
        .sr-gratitude-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .sr-transcript-body::-webkit-scrollbar-thumb,
        .sr-modal::-webkit-scrollbar-thumb,
        .sr-main-workspace::-webkit-scrollbar-thumb,
        .sr-gratitude-list::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.08);
          border-radius: 10px;
        }
        .sr-transcript-body::-webkit-scrollbar-thumb:hover,
        .sr-modal::-webkit-scrollbar-thumb:hover,
        .sr-main-workspace::-webkit-scrollbar-thumb:hover,
        .sr-gratitude-list::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.15);
        }
      `}</style>

      {/* Background decoration */}
      <div className="sr-background-blob" />

      {/* Sidebar navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabSelect={(tab) => {
          setCurrentTab(tab);
          setSearchQuery(""); // Clear search bar upon tab switching
        }}
        onOpenBreathing={() => handleOpenModal("breathing_478")}
      />

      <div className="sr-main-workspace">
        {/* Encouragement Banner */}
        <EncouragementBanner />

        {/* Top Header Bar */}
        <TopBar
          title={getTabTitle()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLogout={handleLogout}
        />

        {/* Mic permission or capture error banner */}
        {micError && (
          <div style={{ margin: "0 40px 20px", color: "#c0392b", background: "rgba(231,76,60,0.06)", border: "1px solid rgba(231,76,60,0.12)", padding: "12px 20px", borderRadius: 14, fontSize: 13, textAlign: "left" }}>
            {micError}
          </div>
        )}

        {/* Active main page rendering */}
        {renderActiveView()}
      </div>

      {/* Detail modal for reviewing individual screening sessions */}
      {activeNote && (
        <NoteModal
          note={notes.find((n) => n.id === activeNote.id) || activeNote}
          onClose={() => setActiveNote(null)}
          onRename={renameNote}
        />
      )}

      {/* Live recording screen overlay */}
      {(isRecording || isProcessing) && (
        <RecordingOverlay
          elapsed={elapsed}
          levels={liveLevels}
          onStop={stopRecording}
          onCancel={cancelRecording}
          isProcessing={isProcessing}
        />
      )}

      {/* Interactive Modal Manager */}
      {activeModal === "breathing_478" && (
        <BreathingModal 
          type="478" 
          onClose={() => setActiveModal(null)} 
          onComplete={() => setFocusTasks((prev) => ({ ...prev, breathwork: true }))}
        />
      )}
      {activeModal === "breathing_box" && (
        <BreathingModal 
          type="box" 
          onClose={() => setActiveModal(null)} 
          onComplete={() => setFocusTasks((prev) => ({ ...prev, breathwork: true }))}
        />
      )}
      {activeModal === "grounding_54321" && (
        <GroundingModal 
          onClose={() => setActiveModal(null)} 
          onComplete={() => console.log("Grounding completed")}
        />
      )}
      {activeModal === "cognitive_reframing" && (
        <ReframingModal 
          onClose={() => setActiveModal(null)} 
          onComplete={() => console.log("Reframing completed")}
        />
      )}
      {activeModal === "body_scan" && (
        <BodyScanModal 
          onClose={() => setActiveModal(null)} 
          onComplete={() => console.log("Body scan completed")}
        />
      )}
      {activeModal === "gratitude_log" && (
        <GratitudeModal 
          onClose={() => setActiveModal(null)} 
          onComplete={() => console.log("Gratitude journaled")}
        />
      )}
      {activeModal === "hotlines" && (
        <HotlinesModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "chat" && (
        <ChatModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal && activeModal.startsWith("article_") && (
        <ArticleModal 
          article={ARTICLES.find(a => a.id === activeModal)} 
          onClose={() => setActiveModal(null)} 
        />
      )}
    </div>
  );
}
