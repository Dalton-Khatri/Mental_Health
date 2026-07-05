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
  AudioLines,
  Heart,
  Wind,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

/* ─── Mood Selector ─── */
function MoodSelector({ selected, onSelect }) {
  return (
    <div className="sr-mood">
      <span className="sr-mood-label">How are you feeling?</span>
      <div className="sr-mood-row">
        {MOODS.map((m) => (
          <button
            key={m.value}
            className={`sr-mood-btn ${selected === m.value ? "sr-mood-btn--active" : ""}`}
            onClick={() => onSelect(m.value)}
            aria-label={m.label}
            title={m.label}
          >
            <span className="sr-mood-emoji">{m.emoji}</span>
            <span className="sr-mood-name">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Breathing Exercise ─── */
function BreathingExercise() {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | inhale | hold | exhale
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);

  const startBreathing = () => {
    setActive(true);
    setPhase("inhale");
    setCount(4);
    runCycle("inhale", 4);
  };

  const stopBreathing = () => {
    clearTimeout(timerRef.current);
    setActive(false);
    setPhase("idle");
    setCount(0);
  };

  const runCycle = (p, c) => {
    if (c > 1) {
      timerRef.current = setTimeout(() => {
        setCount(c - 1);
        runCycle(p, c - 1);
      }, 1000);
    } else {
      timerRef.current = setTimeout(() => {
        if (p === "inhale") { setPhase("hold"); setCount(7); runCycle("hold", 7); }
        else if (p === "hold") { setPhase("exhale"); setCount(8); runCycle("exhale", 8); }
        else { setPhase("inhale"); setCount(4); runCycle("inhale", 4); }
      }, 1000);
    }
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const phaseLabel = phase === "inhale" ? "Breathe in…" : phase === "hold" ? "Hold…" : phase === "exhale" ? "Breathe out…" : "Ready";

  return (
    <div className="sr-breathe">
      <button className="sr-breathe-toggle" onClick={() => { setExpanded(!expanded); if (active) stopBreathing(); }}>
        <Wind size={16} />
        <span>Take a breath</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="sr-breathe-panel">
          <div className={`sr-breathe-circle sr-breathe-circle--${phase}`}>
            <span className="sr-breathe-count">{active ? count : ""}</span>
          </div>
          <span className="sr-breathe-label">{phaseLabel}</span>
          <button className="sr-breathe-action" onClick={active ? stopBreathing : startBreathing}>
            {active ? "Stop" : "Begin 4-7-8 Breathing"}
          </button>
        </div>
      )}
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

/* ─── Record Bar ─── */
function RecordBar({ elapsed, levels, onStop, onCancel }) {
  return (
    <div className="sr-recordbar">
      <div className="sr-recordbar-dot" />
      <span className="sr-recordbar-time">{formatTime(elapsed)}</span>
      <Waveform peaks={levels} height={32} active />
      <button className="sr-iconbtn" onClick={onCancel} aria-label="Discard recording">
        <X size={17} />
      </button>
      <button className="sr-stopbtn" onClick={onStop} aria-label="Stop and save">
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  );
}

/* ─── Note Card ─── */
function NoteCard({ note, onOpen, onDelete }) {
  const miniPeaks = downsample(note.peaks, 28);
  const mood = MOODS.find((m) => m.value === note.mood);
  return (
    <button className="sr-card" onClick={() => onOpen(note)}>
      <div className="sr-card-top">
        <div className="sr-card-title-row">
          {mood && <span className="sr-card-mood">{mood.emoji}</span>}
          <span className="sr-card-title">{note.title}</span>
        </div>
        <span className="sr-card-trash" onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} role="button" aria-label="Delete note">
          <Trash2 size={15} />
        </span>
      </div>
      <Waveform peaks={miniPeaks} height={40} />
      <div className="sr-card-bottom">
        <span>{formatWhen(note.createdAt)}</span>
        <span className="sr-dot-sep">·</span>
        <span className="sr-mono">{formatTime(note.duration)}</span>
        {note.score !== undefined && (
          <>
            <span className="sr-dot-sep">·</span>
            <span className="sr-card-score">
              <Heart size={12} />
              {note.score}%
            </span>
          </>
        )}
      </div>
    </button>
  );
}

/* ─── Note Modal ─── */
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
    if (!audio) return;
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
    onRename(note.id, trimmed.length ? trimmed : note.title);
    setEditingTitle(false);
  };

  const mood = MOODS.find((m) => m.value === note.mood);

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal" role="dialog" aria-modal="true">
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

        <div className="sr-modal-head">
          {editingTitle ? (
            <div className="sr-title-edit">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
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

        <div className="sr-player">
          <Waveform peaks={note.peaks} progress={progress} onSeek={handleSeek} height={88} />

          <div className="sr-transport">
            <button className="sr-playbtn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>

            <span className="sr-mono sr-time">
              {formatTime(current)} <span className="sr-time-sep">/</span> {formatTime(note.duration)}
            </span>

            <button className="sr-speedbtn" onClick={cycleSpeed} aria-label="Playback speed">
              <Gauge size={14} />
              {SPEEDS[speedIdx]}×
            </button>

            <div className="sr-volume">
              <button className="sr-iconbtn" onClick={toggleMute} aria-label={volume === 0 ? "Unmute" : "Mute"}>
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                className="sr-range"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => { setMutedVol(null); setVolume(Number(e.target.value)); }}
              />
            </div>
          </div>
        </div>

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

/* ─── Main App ─── */
export default function App() {
  const [notes, setNotes] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveLevels, setLiveLevels] = useState(Array(40).fill(0.06));
  const [activeNote, setActiveNote] = useState(null);
  const [micError, setMicError] = useState("");
  const [selectedMood, setSelectedMood] = useState(null);

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

      // Pick a MIME type the browser actually supports
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

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    console.log("Recording blob:", blob.size, "bytes, type:", blob.type);

    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();

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
    const note = {
      id: noteId,
      title: `Wellness check — ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}`,
      url,
      blob,
      peaks,
      duration,
      mood: selectedMood,
      score: undefined, // placeholder — will come from backend
      createdAt: new Date(),
      transcript: "Transcribing...",
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedMood(null);

    // Send audio blob to Python FastAPI backend for Whisper transcription
    const formData = new FormData();
    const fileExtension = mimeTypeRef.current.includes("webm") ? "webm" : mimeTypeRef.current.includes("ogg") ? "ogg" : "mp4";
    formData.append("file", blob, `checkin.${fileExtension}`);

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
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, transcript: data.transcript } : n))
        );
      })
      .catch((err) => {
        console.error("Transcription error:", err);
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, transcript: `[Transcription failed: ${err.message}]` } : n))
        );
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
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActiveNote((n) => (n && n.id === id ? null : n));
  };

  const renameNote = (id, title) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
    setActiveNote((n) => (n && n.id === id ? { ...n, title } : n));
  };

  useEffect(() => () => cleanupRecording(), [cleanupRecording]);

  return (
    <div className="sr-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        /* ─── Animated background blobs ─── */
        @keyframes sr-float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
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
        @keyframes sr-breathePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(91,154,139,0.35); }
          50% { box-shadow: 0 0 0 12px rgba(91,154,139,0); }
        }
        @keyframes sr-pulse {
          0% { box-shadow: 0 0 0 0 rgba(91,154,139,0.45); }
          70% { box-shadow: 0 0 0 9px rgba(91,154,139,0); }
          100% { box-shadow: 0 0 0 0 rgba(91,154,139,0); }
        }
        @keyframes sr-breatheCircleInhale {
          from { transform: scale(0.6); }
          to { transform: scale(1); }
        }
        @keyframes sr-breatheCircleHold {
          from, to { transform: scale(1); }
        }
        @keyframes sr-breatheCircleExhale {
          from { transform: scale(1); }
          to { transform: scale(0.6); }
        }

        .sr-app {
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
          font-family: 'Outfit', 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
          min-height: 100vh;
          background: linear-gradient(145deg, var(--paper) 0%, var(--paper-end) 50%, #f2eef8 100%);
          box-sizing: border-box;
          position: relative;
          overflow-x: hidden;
        }
        .sr-app *, .sr-app *::before, .sr-app *::after { box-sizing: border-box; }
        .sr-app button { font-family: inherit; }

        /* ─── Floating blobs ─── */
        .sr-app::before,
        .sr-app::after {
          content: '';
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          pointer-events: none;
          z-index: 0;
        }
        .sr-app::before {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(91,154,139,0.3), transparent 70%);
          top: -100px; right: -80px;
          animation: sr-float1 20s ease-in-out infinite;
        }
        .sr-app::after {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(196,181,224,0.3), transparent 70%);
          bottom: -50px; left: -60px;
          animation: sr-float2 25s ease-in-out infinite;
        }
        .sr-blob3 {
          position: fixed;
          width: 300px; height: 300px;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(circle, rgba(232,160,180,0.35), transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: sr-float3 22s ease-in-out infinite;
        }

        /* ─── Header ─── */
        .sr-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 32px;
          backdrop-filter: blur(20px) saturate(1.3);
          background: rgba(240,244,243,0.75);
          border-bottom: 1px solid var(--glass-border);
        }
        .sr-brand { display: flex; align-items: center; gap: 10px; }
        .sr-brand-icon {
          width: 36px; height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--accent), var(--accent-light));
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(91,154,139,0.3);
        }
        .sr-brand-text { display: flex; flex-direction: column; }
        .sr-brand-mark {
          font-weight: 650;
          font-size: 18px;
          letter-spacing: -0.02em;
          color: #000000;
          line-height: 1.2;
        }
        .sr-brand-tag { font-size: 12px; color: var(--ink-faint); font-weight: 400; }

        .sr-header-actions { display: flex; align-items: center; gap: 10px; }

        .sr-recordbtn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-ink));
          color: #fff;
          padding: 11px 22px 11px 17px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 16px rgba(91,154,139,0.3);
          animation: sr-breathePulse 3s ease-in-out infinite;
        }
        .sr-recordbtn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(91,154,139,0.35); }
        .sr-recordbtn:active { transform: translateY(0); }
        .sr-recordbtn-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #fff;
          opacity: 0.9;
        }

        /* ─── Record Bar ─── */
        .sr-recordbar {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
        }
        .sr-recordbar-dot {
          width: 9px; height: 9px; border-radius: 50%; background: var(--accent);
          box-shadow: 0 0 0 0 rgba(91,154,139,0.5);
          animation: sr-pulse 1.6s ease-out infinite;
          flex: none;
        }
        .sr-recordbar-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13.5px;
          color: var(--ink);
          flex: none;
          min-width: 40px;
        }
        .sr-recordbar .sr-wave { flex: 1; cursor: default; }

        .sr-stopbtn {
          flex: none;
          width: 36px; height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--accent);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.15s ease;
          box-shadow: 0 2px 8px rgba(91,154,139,0.3);
        }
        .sr-stopbtn:hover { filter: brightness(1.08); transform: scale(1.05); }

        .sr-iconbtn {
          border: none;
          background: transparent;
          color: var(--ink-soft);
          width: 34px; height: 34px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          flex: none;
        }
        .sr-iconbtn:hover { background: var(--accent-soft); color: var(--accent-ink); }

        /* ─── Encouragement ─── */
        .sr-encouragement {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 500;
          color: var(--accent-ink);
          background: linear-gradient(135deg, var(--accent-soft), rgba(196,181,224,0.15));
          border-bottom: 1px solid var(--glass-border);
          opacity: 0;
          transition: opacity 0.5s ease;
          position: relative;
          z-index: 4;
        }
        .sr-encouragement--visible { opacity: 1; }

        /* ─── Breathing Exercise ─── */
        .sr-breathe {
          position: relative;
          z-index: 4;
        }
        .sr-breathe-toggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid var(--line);
          background: var(--glass);
          backdrop-filter: blur(8px);
          color: var(--accent-ink);
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sr-breathe-toggle:hover { background: var(--accent-soft); border-color: var(--accent); }
        .sr-breathe-panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(1.2);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          box-shadow: var(--shadow-soft);
          animation: sr-fadeIn 0.3s ease;
          min-width: 220px;
        }
        .sr-breathe-circle {
          width: 100px; height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-soft), rgba(196,181,224,0.2));
          border: 3px solid var(--accent);
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.5s ease;
        }
        .sr-breathe-circle--inhale { animation: sr-breatheCircleInhale 4s ease-in-out forwards; border-color: var(--accent); }
        .sr-breathe-circle--hold { animation: sr-breatheCircleHold 7s linear forwards; border-color: var(--lavender); }
        .sr-breathe-circle--exhale { animation: sr-breatheCircleExhale 8s ease-in-out forwards; border-color: var(--rose); }
        .sr-breathe-count { font-size: 28px; font-weight: 700; color: var(--accent-ink); }
        .sr-breathe-label { font-size: 14px; color: var(--ink-soft); font-weight: 500; }
        .sr-breathe-action {
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-ink));
          color: #fff;
          padding: 9px 20px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .sr-breathe-action:hover { transform: scale(1.03); }

        /* ─── Mood Selector ─── */
        .sr-mood {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: var(--glass);
          backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-soft);
          animation: sr-fadeIn 0.4s ease;
        }
        .sr-mood-label { font-size: 15px; font-weight: 600; color: var(--ink); }
        .sr-mood-row { display: flex; gap: 8px; }
        .sr-mood-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          border: 2px solid transparent;
          background: var(--surface);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sr-mood-btn:hover { border-color: var(--accent); background: var(--accent-soft); transform: translateY(-2px); }
        .sr-mood-btn--active {
          border-color: var(--accent);
          background: var(--accent-soft);
          box-shadow: 0 4px 12px var(--accent-glow);
          transform: translateY(-2px);
        }
        .sr-mood-emoji { font-size: 28px; line-height: 1; }
        .sr-mood-name { font-size: 11px; font-weight: 500; color: var(--ink-soft); }

        /* ─── Main ─── */
        .sr-main {
          max-width: 1000px;
          margin: 0 auto;
          padding: 32px 32px 100px;
          position: relative;
          z-index: 1;
        }

        .sr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 18px;
        }

        /* ─── Cards ─── */
        .sr-card {
          text-align: left;
          border: 1px solid var(--glass-border);
          background: var(--glass);
          backdrop-filter: blur(16px) saturate(1.2);
          border-radius: var(--radius);
          padding: 20px 20px 16px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 12px;
          color: #000000;
          transition: all 0.25s ease;
          animation: sr-fadeIn 0.4s ease both;
          box-shadow: var(--shadow-soft);
        }
        .sr-card:hover {
          border-color: var(--accent);
          background: rgba(255,255,255,0.75);
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }
        .sr-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .sr-card-title-row { display: flex; align-items: center; gap: 8px; }
        .sr-card-mood { font-size: 18px; }
        .sr-card-title {
          font-size: 15px;
          font-weight: 600;
          line-height: 1.35;
          color: #000000;
        }
        .sr-card-trash {
          opacity: 0;
          color: var(--ink-faint);
          display: flex;
          padding: 4px;
          border-radius: 8px;
          transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .sr-card:hover .sr-card-trash { opacity: 1; }
        .sr-card-trash:hover { color: #e17055; background: rgba(225,112,85,0.1); }
        .sr-card-bottom {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--ink-faint); font-weight: 500;
        }
        .sr-card-score {
          display: inline-flex; align-items: center; gap: 3px;
          color: var(--accent-ink); font-weight: 600;
        }
        .sr-dot-sep { color: var(--line); }
        .sr-mono { font-family: 'JetBrains Mono', monospace; }

        /* ─── Waveform ─── */
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

        /* ─── Empty State ─── */
        .sr-empty {
          margin-top: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          color: var(--ink-soft);
          animation: sr-fadeIn 0.6s ease;
        }
        .sr-empty-icon {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-soft), rgba(196,181,224,0.2));
          border: 1px solid var(--glass-border);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent);
          box-shadow: 0 8px 24px var(--accent-glow);
        }
        .sr-empty h3 {
          margin: 0;
          font-weight: 700;
          font-size: 22px;
          color: #000000;
          letter-spacing: -0.02em;
        }
        .sr-empty p { margin: 0; font-size: 15px; max-width: 340px; line-height: 1.6; }

        .sr-mic-error {
          margin-bottom: 20px;
          font-size: 13px;
          color: #c0392b;
          background: rgba(231,76,60,0.08);
          border: 1px solid rgba(231,76,60,0.15);
          padding: 12px 16px;
          border-radius: 14px;
          max-width: 480px;
        }

        /* ─── Modal / Overlay ─── */
        .sr-overlay {
          position: fixed; inset: 0;
          background: rgba(45,52,54,0.35);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          z-index: 20;
          animation: sr-fadeIn 0.2s ease;
        }
        .sr-modal {
          width: 100%; max-width: 580px;
          max-height: 88vh;
          overflow-y: auto;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(24px) saturate(1.4);
          border-radius: var(--radius-lg);
          border: 1px solid var(--glass-border);
          box-shadow: 0 30px 60px -20px rgba(45,52,54,0.25);
          padding: 28px 30px 30px;
          animation: sr-fadeIn 0.35s ease;
        }
        .sr-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .sr-modal-head h2 {
          font-weight: 700;
          font-size: 21px;
          margin: 0;
          letter-spacing: -0.02em;
          color: #000000;
        }
        .sr-title-edit { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .sr-title-edit input {
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

        /* ─── Player ─── */
        .sr-player {
          margin-top: 24px;
          background: var(--glass);
          backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          padding: 22px 22px 18px;
        }
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

        /* ─── Score Section ─── */
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

        /* ─── Transcript ─── */
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

        /* ─── Section Label ─── */
        .sr-section-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-faint);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 16px;
          margin-top: 8px;
        }

        /* ─── Responsive ─── */
        @media (max-width: 560px) {
          .sr-header { padding: 14px 18px; }
          .sr-main { padding: 24px 18px 80px; }
          .sr-brand-tag { display: none; }
          .sr-modal { padding: 22px 18px 22px; border-radius: 20px; }
          .sr-volume { margin-left: 0; }
          .sr-transport { flex-wrap: wrap; row-gap: 10px; }
          .sr-mood-row { flex-wrap: wrap; justify-content: center; }
          .sr-mood-btn { padding: 8px 10px; }
          .sr-mood-emoji { font-size: 22px; }
          .sr-breathe-panel { right: -40px; }
        }

        .sr-app :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      `}</style>

      {/* Floating blob background */}
      <div className="sr-blob3" />

      {/* Encouragement Banner */}
      <EncouragementBanner />

      <header className="sr-header">
        {isRecording ? (
          <RecordBar elapsed={elapsed} levels={liveLevels} onStop={stopRecording} onCancel={cancelRecording} />
        ) : (
          <>
            <div className="sr-brand">
              <div className="sr-brand-icon">
                <Heart size={18} />
              </div>
              <div className="sr-brand-text">
                <span className="sr-brand-mark">SerenityScreen</span>
                <span className="sr-brand-tag">Your voice, your wellness</span>
              </div>
            </div>
            <div className="sr-header-actions">
              <BreathingExercise />
              <button className="sr-recordbtn" onClick={startRecording}>
                <Mic size={16} />
                Start Screening
              </button>
            </div>
          </>
        )}
      </header>

      <main className="sr-main">
        {micError && <div className="sr-mic-error">{micError}</div>}

        {notes.length === 0 ? (
          <div className="sr-empty">
            <div className="sr-empty-icon">
              <Heart size={28} />
            </div>
            <h3>Begin Your Wellness Check</h3>
            <p>Share how you're feeling — your voice helps us understand your emotional wellness. Select your mood, then press Start Screening.</p>

            <div style={{ marginTop: 8 }}>
              <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
            </div>
          </div>
        ) : (
          <>
            {/* Mood selector above the grid */}
            {!isRecording && (
              <div style={{ marginBottom: 24 }}>
                <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
              </div>
            )}
            <div className="sr-section-label">Your Screenings</div>
            <div className="sr-grid">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} onOpen={setActiveNote} onDelete={deleteNote} />
              ))}
            </div>
          </>
        )}
      </main>

      {activeNote && (
        <NoteModal
          note={notes.find((n) => n.id === activeNote.id) || activeNote}
          onClose={() => setActiveNote(null)}
          onRename={renameNote}
        />
      )}
    </div>
  );
}
