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
} from "lucide-react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

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

function Waveform({ peaks, progress = 0, onSeek, height = 56, active = false }) {
  return (
    <div
      className="vx-wave"
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
            className={`vx-bar ${played ? "vx-bar--played" : ""} ${active ? "vx-bar--live" : ""}`}
            style={{ height: `${Math.max(6, p * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function RecordBar({ elapsed, levels, onStop, onCancel }) {
  return (
    <div className="vx-recordbar">
      <div className="vx-recordbar-dot" />
      <span className="vx-recordbar-time">{formatTime(elapsed)}</span>
      <Waveform peaks={levels} height={32} active />
      <button className="vx-iconbtn" onClick={onCancel} aria-label="Discard recording">
        <X size={17} />
      </button>
      <button className="vx-stopbtn" onClick={onStop} aria-label="Stop and save">
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  );
}

function NoteCard({ note, onOpen, onDelete }) {
  const miniPeaks = downsample(note.peaks, 28);
  return (
    <button className="vx-card" onClick={() => onOpen(note)}>
      <div className="vx-card-top">
        <span className="vx-card-title">{note.title}</span>
        <span className="vx-card-trash" onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} role="button" aria-label="Delete note">
          <Trash2 size={15} />
        </span>
      </div>
      <Waveform peaks={miniPeaks} height={40} />
      <div className="vx-card-bottom">
        <span>{formatWhen(note.createdAt)}</span>
        <span className="vx-dot-sep">·</span>
        <span className="vx-mono">{formatTime(note.duration)}</span>
      </div>
    </button>
  );
}

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
      audio.play();
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

  return (
    <div className="vx-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="vx-modal" role="dialog" aria-modal="true">
        <audio
          ref={audioRef}
          src={note.url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
        />

        <div className="vx-modal-head">
          {editingTitle ? (
            <div className="vx-title-edit">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              />
              <button className="vx-iconbtn" onClick={saveTitle} aria-label="Save name">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="vx-title-edit">
              <h2>{note.title}</h2>
              <button
                className="vx-iconbtn"
                onClick={() => { setTitleDraft(note.title); setEditingTitle(true); }}
                aria-label="Rename note"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <button className="vx-iconbtn vx-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="vx-modal-meta">{formatWhen(note.createdAt)}</div>

        <div className="vx-player">
          <Waveform peaks={note.peaks} progress={progress} onSeek={handleSeek} height={88} />

          <div className="vx-transport">
            <button className="vx-playbtn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>

            <span className="vx-mono vx-time">
              {formatTime(current)} <span className="vx-time-sep">/</span> {formatTime(note.duration)}
            </span>

            <button className="vx-speedbtn" onClick={cycleSpeed} aria-label="Playback speed">
              <Gauge size={14} />
              {SPEEDS[speedIdx]}×
            </button>

            <div className="vx-volume">
              <button className="vx-iconbtn" onClick={toggleMute} aria-label={volume === 0 ? "Unmute" : "Mute"}>
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                className="vx-range"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => { setMutedVol(null); setVolume(Number(e.target.value)); }}
              />
            </div>
          </div>
        </div>

        <div className="vx-transcript">
          <div className="vx-transcript-label">Transcript</div>
          <div className={`vx-transcript-body ${!note.transcript ? "vx-transcript-body--empty" : ""}`}>
            {note.transcript || "Transcription will appear here once your model has processed this recording."}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [notes, setNotes] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveLevels, setLiveLevels] = useState(Array(40).fill(0.06));
  const [activeNote, setActiveNote] = useState(null);
  const [micError, setMicError] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

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

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = handleRecordingStop;
      mediaRecorderRef.current = mr;
      mr.start();

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

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    let peaks = Array(60).fill(0.2);
    let duration = elapsed;
    try {
      const extracted = await extractPeaks(blob, 60);
      peaks = extracted.peaks;
      duration = extracted.duration;
    } catch (e) {
      // fall back to flat waveform if decoding isn't supported
    }

    const note = {
      id: `${Date.now()}`,
      title: `Voice note — ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}`,
      url,
      peaks,
      duration,
      createdAt: new Date(),
      transcript: "",
    };
    setNotes((prev) => [note, ...prev]);
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
    <div className="vx-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,450;0,9..144,560;1,9..144,500&family=Inter:wght@400;500;600;650&family=JetBrains+Mono:wght@400;500&display=swap');

        .vx-app {
          --paper: #ffffff;
          --dot: #e6e6e3;
          --ink: #17181a;
          --ink-soft: #74757a;
          --ink-faint: #a9aaae;
          --line: #ececea;
          --surface: #fbfbfa;
          --accent: #ff4433;
          --accent-soft: #ffece9;
          --accent-ink: #b8291b;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
          min-height: 100vh;
          background-color: var(--paper);
          background-image: radial-gradient(circle, var(--dot) 1.3px, transparent 1.3px);
          background-size: 22px 22px;
          box-sizing: border-box;
        }
        .vx-app *, .vx-app *::before, .vx-app *::after { box-sizing: border-box; }
        .vx-app button { font-family: inherit; }

        .vx-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 32px;
          backdrop-filter: blur(10px);
          background: rgba(255,255,255,0.82);
          border-bottom: 1px solid var(--line);
        }
        .vx-brand { display: flex; align-items: baseline; gap: 10px; }
        .vx-brand-mark {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-weight: 500;
          font-size: 22px;
          letter-spacing: -0.01em;
        }
        .vx-brand-tag { font-size: 12.5px; color: var(--ink-faint); }

        .vx-recordbtn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border: none;
          background: var(--ink);
          color: #fff;
          padding: 11px 20px 11px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 550;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .vx-recordbtn:hover { background: var(--accent-ink); transform: translateY(-1px); }
        .vx-recordbtn:active { transform: translateY(0); }
        .vx-recordbtn-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
        }

        .vx-recordbar {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
        }
        .vx-recordbar-dot {
          width: 9px; height: 9px; border-radius: 50%; background: var(--accent);
          box-shadow: 0 0 0 0 rgba(255,68,51,0.5);
          animation: vx-pulse 1.6s ease-out infinite;
          flex: none;
        }
        @keyframes vx-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,68,51,0.45); }
          70% { box-shadow: 0 0 0 9px rgba(255,68,51,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,68,51,0); }
        }
        .vx-recordbar-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13.5px;
          color: var(--ink);
          flex: none;
          min-width: 40px;
        }
        .vx-recordbar .vx-wave { flex: 1; cursor: default; }

        .vx-stopbtn {
          flex: none;
          width: 34px; height: 34px;
          border-radius: 50%;
          border: none;
          background: var(--accent);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: filter 0.15s ease;
        }
        .vx-stopbtn:hover { filter: brightness(1.08); }

        .vx-iconbtn {
          border: none;
          background: transparent;
          color: var(--ink-soft);
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          flex: none;
        }
        .vx-iconbtn:hover { background: var(--surface); color: var(--ink); }

        .vx-main {
          max-width: 980px;
          margin: 0 auto;
          padding: 40px 32px 100px;
        }

        .vx-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .vx-card {
          text-align: left;
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 16px;
          padding: 18px 18px 16px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .vx-card:hover {
          border-color: #dcdcda;
          background: var(--paper);
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -16px rgba(23,24,26,0.28);
        }
        .vx-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .vx-card-title {
          font-size: 14.5px;
          font-weight: 550;
          line-height: 1.35;
        }
        .vx-card-trash {
          opacity: 0;
          color: var(--ink-faint);
          display: flex;
          padding: 2px;
          border-radius: 6px;
          transition: opacity 0.15s ease, color 0.15s ease;
        }
        .vx-card:hover .vx-card-trash { opacity: 1; }
        .vx-card-trash:hover { color: var(--accent); }
        .vx-card-bottom {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--ink-faint);
        }
        .vx-dot-sep { color: var(--dot); }
        .vx-mono { font-family: 'JetBrains Mono', monospace; }

        .vx-wave {
          display: flex;
          align-items: flex-end;
          gap: 2.5px;
          width: 100%;
          cursor: pointer;
        }
        .vx-bar {
          flex: 1;
          min-width: 2px;
          border-radius: 3px;
          background: #dedfdc;
          transition: background 0.2s ease, height 0.08s linear;
        }
        .vx-bar--played { background: var(--ink); }
        .vx-bar--live { background: var(--accent); }

        .vx-empty {
          margin-top: 90px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
          color: var(--ink-soft);
        }
        .vx-empty-icon {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-faint);
        }
        .vx-empty h3 { margin: 0; font-family: 'Fraunces', serif; font-weight: 500; font-size: 19px; color: var(--ink); }
        .vx-empty p { margin: 0; font-size: 14px; max-width: 280px; }

        .vx-mic-error {
          margin-top: 14px;
          font-size: 13px;
          color: var(--accent-ink);
          background: var(--accent-soft);
          padding: 10px 14px;
          border-radius: 10px;
          max-width: 480px;
        }

        .vx-overlay {
          position: fixed; inset: 0;
          background: rgba(23,24,26,0.32);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          z-index: 20;
        }
        .vx-modal {
          width: 100%; max-width: 560px;
          max-height: 88vh;
          overflow-y: auto;
          background: var(--paper);
          border-radius: 22px;
          border: 1px solid var(--line);
          box-shadow: 0 30px 60px -20px rgba(23,24,26,0.35);
          padding: 26px 28px 28px;
        }
        .vx-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .vx-modal-head h2 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 20px;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .vx-title-edit { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .vx-title-edit input {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 500;
          border: none;
          border-bottom: 1.5px solid var(--ink);
          background: transparent;
          padding: 0 0 2px;
          flex: 1;
          min-width: 0;
          outline: none;
        }
        .vx-close { margin-top: -2px; }
        .vx-modal-meta { font-size: 13px; color: var(--ink-faint); margin-top: 4px; }

        .vx-player {
          margin-top: 26px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 20px 20px 16px;
        }
        .vx-transport {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 18px;
        }
        .vx-playbtn {
          flex: none;
          width: 42px; height: 42px;
          border-radius: 50%;
          border: none;
          background: var(--ink);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .vx-playbtn:hover { background: var(--accent-ink); }
        .vx-time { font-size: 13px; color: var(--ink-soft); flex: none; }
        .vx-time-sep { color: var(--ink-faint); }
        .vx-speedbtn {
          flex: none;
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .vx-speedbtn:hover { border-color: var(--ink-faint); background: var(--surface); }
        .vx-volume { display: flex; align-items: center; gap: 4px; margin-left: auto; }

        .vx-range {
          -webkit-appearance: none;
          appearance: none;
          width: 76px;
          height: 3px;
          border-radius: 3px;
          background: var(--line);
          outline: none;
          cursor: pointer;
        }
        .vx-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: var(--ink);
          cursor: pointer;
          border: 2px solid var(--paper);
          box-shadow: 0 0 0 1px var(--line);
        }
        .vx-range::-moz-range-thumb {
          width: 13px; height: 13px;
          border-radius: 50%;
          background: var(--ink);
          cursor: pointer;
          border: 2px solid var(--paper);
          box-shadow: 0 0 0 1px var(--line);
        }

        .vx-transcript { margin-top: 22px; }
        .vx-transcript-label {
          font-size: 11.5px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-faint);
          margin-bottom: 10px;
        }
        .vx-transcript-body {
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink);
          max-height: 220px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .vx-transcript-body--empty {
          color: var(--ink-faint);
          font-style: italic;
        }

        @media (max-width: 560px) {
          .vx-header { padding: 18px 18px; }
          .vx-main { padding: 28px 18px 80px; }
          .vx-brand-tag { display: none; }
          .vx-modal { padding: 22px 18px 22px; border-radius: 18px; }
          .vx-volume { margin-left: 0; }
          .vx-transport { flex-wrap: wrap; row-gap: 10px; }
        }

        .vx-app :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      `}</style>

      <header className="vx-header">
        {isRecording ? (
          <RecordBar elapsed={elapsed} levels={liveLevels} onStop={stopRecording} onCancel={cancelRecording} />
        ) : (
          <>
            <div className="vx-brand">
              <span className="vx-brand-mark">Voxnote</span>
              <span className="vx-brand-tag">Say it, keep it</span>
            </div>
            <button className="vx-recordbtn" onClick={startRecording}>
              <Mic size={16} />
              Record
            </button>
          </>
        )}
      </header>

      <main className="vx-main">
        {micError && <div className="vx-mic-error">{micError}</div>}

        {notes.length === 0 ? (
          <div className="vx-empty">
            <div className="vx-empty-icon">
              <AudioLines size={24} />
            </div>
            <h3>No voice notes yet</h3>
            <p>Press Record and start talking — your notes will show up here, ready to play back and transcribe.</p>
          </div>
        ) : (
          <div className="vx-grid">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onOpen={setActiveNote} onDelete={deleteNote} />
            ))}
          </div>
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
