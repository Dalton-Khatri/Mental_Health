import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Pause, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, CheckCircle, Volume2, Wind } from "lucide-react";

// List of questions for the session in order
const QUESTIONS = [
  {
    id: "q1",
    category: "weekly_overview",
    text: "How has your week been so far? Walk me through what a typical day has looked like recently."
  },
  {
    id: "q2",
    category: "emotional_state",
    text: "How have you been feeling emotionally over the past few days?"
  },
  {
    id: "q3",
    category: "challenges",
    text: "What's been the biggest challenge or source of stress in your life recently?"
  },
  {
    id: "q4",
    category: "support_system",
    text: "Who are the people you usually turn to when you need support?"
  },
  {
    id: "q5",
    category: "open_reflection",
    text: "Is there anything else you've been thinking about lately that you'd like to talk about?"
  }
];

export default function ConversationView({ user, token, SERVER_API, onSessionComplete }) {
  // Navigation & step states: "intro", "interview", "processing", "results"
  const [step, setStep] = useState("intro");
  const [currentIdx, setCurrentIdx] = useState(0);
  
  // Recordings data: array of { blob, url, duration }
  const [recordings, setRecordings] = useState(Array(QUESTIONS.length).fill(null));
  
  // Active recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveLevels, setLiveLevels] = useState(Array(30).fill(0.06));
  const [errorMsg, setErrorMsg] = useState("");
  
  // Confirmation state before re-recording
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Result state
  const [results, setResults] = useState(null);

  // Refs for audio capturing
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const durationRef = useRef(0);

  // Clean up Web Audio resources
  const cleanupAudio = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  // Audio level animation loop
  const startLevelAnimation = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevels = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      const barsCount = 30;
      const stepSize = Math.max(1, Math.floor(dataArray.length / barsCount));
      const newLevels = [];
      for (let i = 0; i < barsCount; i++) {
        let sum = 0;
        for (let j = 0; j < stepSize; j++) {
          sum += dataArray[i * stepSize + j] || 0;
        }
        const val = Math.max(0.06, sum / stepSize / 255);
        newLevels.push(val);
      }
      setLiveLevels(newLevels);
      rafRef.current = requestAnimationFrame(updateLevels);
    };
    updateLevels();
  }, []);

  // START recording for current question
  const handleStartRecording = async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      let chosenType = "";
      for (const mime of preferredTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          chosenType = mime;
          break;
        }
      }

      const options = chosenType ? { mimeType: chosenType } : {};
      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: chosenType || "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecordings((prev) => {
          const next = [...prev];
          next[currentIdx] = {
            blob: audioBlob,
            url: audioUrl,
            duration: durationRef.current
          };
          return next;
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      durationRef.current = 0;

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          durationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);

      startLevelAnimation();
    } catch (err) {
      console.error(err);
      setErrorMsg("Unable to access microphone. Please check system permissions.");
    }
  };

  // PAUSE recording
  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // RESUME recording
  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          durationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    }
  };

  // STOP recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      cleanupAudio();
    }
  };

  // Re-record response (with confirmation if exists)
  const handleReRecordClick = () => {
    if (recordings[currentIdx]) {
      setShowConfirm(true);
    } else {
      handleStartRecording();
    }
  };

  const handleConfirmReRecord = () => {
    setShowConfirm(false);
    // Clear existing recording for this question
    setRecordings((prev) => {
      const next = [...prev];
      next[currentIdx] = null;
      return next;
    });
    handleStartRecording();
  };

  // Navigation between questions
  const handleNext = () => {
    if (currentIdx < QUESTIONS.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      setElapsed(0);
    } else {
      handleSubmitSession();
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
      setElapsed(0);
    }
  };

  // Helper: Waveform encoder to create WAV file
  const bufferToWav = (buffer) => {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length),
        view = new DataView(bufferArr),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);         // chunk length
    setUint16(1);          // sample format (raw)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16);         // bits per sample
    setUint32(0x61746164); // "data" chunk identifier
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length - 44) {
      for (i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // scale
        view.setInt16(44 + pos, sample, true); // write 16-bit sample
        pos += 2;
      }
      offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  // Combine multiple recordings client-side into a single WAV Blob
  const combineRecordings = async () => {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtxClass();

    try {
      const decodedBuffers = await Promise.all(
        recordings.map(async (rec) => {
          const arrayBuffer = await rec.blob.arrayBuffer();
          // decodeAudioData returns a promise in modern browsers
          return await new Promise((resolve, reject) => {
            ctx.decodeAudioData(arrayBuffer, resolve, reject);
          });
        })
      );

      const totalSamples = decodedBuffers.reduce((sum, buf) => sum + buf.length, 0);
      const sampleRate = decodedBuffers[0].sampleRate;
      const channels = decodedBuffers[0].numberOfChannels;
      const combinedBuffer = ctx.createBuffer(channels, totalSamples, sampleRate);

      let offset = 0;
      for (const buf of decodedBuffers) {
        for (let c = 0; c < channels; c++) {
          combinedBuffer.getChannelData(c).set(buf.getChannelData(c), offset);
        }
        offset += buf.length;
      }

      const combinedWav = bufferToWav(combinedBuffer);
      return combinedWav;
    } catch (e) {
      console.error("Audio combining failed:", e);
      // Fallback: return the first blob if decoding fails
      return recordings[0].blob;
    } finally {
      ctx.close();
    }
  };

  // SUBMIT recordings to Express server
  const handleSubmitSession = async () => {
    setStep("processing");
    try {
      const combinedBlob = await combineRecordings();
      const totalDuration = recordings.reduce((acc, r) => acc + (r?.duration || 0), 0);

      const formData = new FormData();
      // Combined audio
      formData.append("combinedAudio", combinedBlob, "reflection_session_combined.wav");
      
      // Question audios and metadata list
      const metadata = [];
      recordings.forEach((rec, idx) => {
        const fileExt = rec.blob.type.includes("mp4") ? "mp4" : rec.blob.type.includes("ogg") ? "ogg" : "webm";
        formData.append("questionAudios", rec.blob, `q_${idx + 1}.${fileExt}`);
        
        metadata.push({
          questionId: QUESTIONS[idx].id,
          category: QUESTIONS[idx].category,
          questionText: QUESTIONS[idx].text,
          duration: rec.duration,
          timestamp: new Date().toISOString(),
          hadFollowUp: false
        });
      });

      formData.append("metadata", JSON.stringify(metadata));
      formData.append("totalDuration", totalDuration.toString());

      // Send to Express backend API
      const res = await fetch(`${SERVER_API}/assessments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        throw new Error(await res.text() || "Submission failed");
      }

      const data = await res.json();
      setResults(data);
      setStep("results");
      
      // Invoke callback to refresh screenings list in main component
      //if (onSessionComplete) onSessionComplete();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to upload the session. Please try again.");
      setStep("interview");
    }
  };

  // Helper: Format duration into mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // RENDER: Intro step
  if (step === "intro") {
    return (
      <div className="sr-conversation-container sr-fade-in">
        <div className="sr-conversation-card">
          <div className="sr-convo-header">
            <div className="sr-convo-badge">Voice Check-in</div>
            <h2>Guided Voice Reflection</h2>
            <p className="sr-convo-desc">
              Take a few quiet minutes to express your thoughts. Your vocal patterns help build a detailed wellness baseline.
            </p>
          </div>

          <div className="sr-convo-info-grid">
            <div className="sr-info-tile">
              <span className="sr-info-val">5</span>
              <span className="sr-info-lbl">Open Questions</span>
            </div>
            <div className="sr-info-tile">
              <span className="sr-info-val">3-4</span>
              <span className="sr-info-lbl">Minutes Duration</span>
            </div>
            <div className="sr-info-tile">
              <span className="sr-info-val">100%</span>
              <span className="sr-info-lbl">Private & Secure</span>
            </div>
          </div>

          <div className="sr-convo-guidelines">
            <h4>Reflection Guidelines</h4>
            <ul>
              <li>Find a quiet space where you can speak aloud freely.</li>
              <li>Speak naturally and answer in as much detail as you feel comfortable.</li>
              <li>There are no right or wrong answers—focus on genuine reflection.</li>
              <li>You can pause or re-record any response before proceeding.</li>
            </ul>
          </div>

          <button className="sr-convo-action-btn" onClick={() => setStep("interview")} id="btn-start-reflection">
            <span>Begin Reflection Session</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // RENDER: Processing step
  if (step === "processing") {
    return (
      <div className="sr-conversation-container sr-fade-in">
        <div className="sr-conversation-card sr-convo-processing">
          <div className="sr-pulse-container">
            <div className="sr-processing-spinner">
              <div className="sr-spinner-ring" />
              <Mic className="sr-spinner-mic" size={24} />
            </div>
          </div>
          <h3>Analyzing Vocal Reflections</h3>
          <p>We are combining your recordings and analyzing vocal patterns for wellness indicators. This might take a moment...</p>
        </div>
      </div>
    );
  }

  // RENDER: Results step
  if (step === "results") {
    const condLabel = results?.conditionLabel || results?.prediction || "Normal";
    const condConf = results?.conditionConfidence || results?.confidence || 0;
    const causeLabel = results?.causeLabel || "—";
    const causeConf = results?.causeConfidence || 0;
    const depLabel = results?.depressionPrediction || null;
    const depConf = results?.depressionConfidence || null;
    const depRisk = results?.depressionRisk || null;

    // Color mappings for conditions
    const condColors = {
      "Normal": { bg: "rgba(76,175,80,0.12)", color: "#4caf50", icon: "🟢" },
      "Stress": { bg: "rgba(255,152,0,0.12)", color: "#ff9800", icon: "🟡" },
      "Anxiety": { bg: "rgba(255,152,0,0.12)", color: "#ff9800", icon: "🟡" },
      "Depression": { bg: "rgba(244,67,54,0.12)", color: "#f44336", icon: "🔴" },
      "Suicidal": { bg: "rgba(183,28,28,0.15)", color: "#b71c1c", icon: "🔴" },
    };
    const condStyle = condColors[condLabel] || condColors["Normal"];

    // Depression risk colors
    const riskColors = {
      "minimal": { bg: "rgba(76,175,80,0.12)", color: "#4caf50", text: "Minimal Risk" },
      "low": { bg: "rgba(139,195,74,0.12)", color: "#8bc34a", text: "Low Risk" },
      "moderate": { bg: "rgba(255,152,0,0.12)", color: "#ff9800", text: "Moderate Risk" },
      "high": { bg: "rgba(244,67,54,0.12)", color: "#f44336", text: "High Risk" },
    };
    const riskStyle = riskColors[depRisk] || riskColors["minimal"];

    return (
      <div className="sr-conversation-container sr-fade-in">
        <div className="sr-conversation-card">
          <div className="sr-success-header">
            <div className="sr-success-icon-wrap">
              <CheckCircle size={32} className="sr-checked-green" />
            </div>
            <h2>Assessment Complete</h2>
            <p>Your voice reflection has been analyzed using our multimodal AI models.</p>
          </div>

          <div className="sr-insights-dashboard">
            {/* ── Condition Card ── */}
            <div className="sr-convo-metric-card" style={{ borderLeft: `3px solid ${condStyle.color}` }}>
              <h4>{condStyle.icon} Detected Condition</h4>
              <div className="sr-metric-row">
                <span className="sr-metric-label">Primary:</span>
                <span className="sr-metric-val" style={{ color: condStyle.color, fontWeight: 600 }}>
                  {condLabel}
                </span>
              </div>
              <div className="sr-metric-row">
                <span className="sr-metric-label">Confidence:</span>
                <span className="sr-metric-val">{Math.round(condConf * 100)}%</span>
              </div>
              {results?.conditionScores && (
                <div className="sr-score-breakdown">
                  {Object.entries(results.conditionScores)
                    .sort(([,a], [,b]) => b - a)
                    .map(([label, score]) => (
                    <div key={label} className="sr-score-bar-row">
                      <span className="sr-score-bar-label">{label}</span>
                      <div className="sr-score-bar-track">
                        <div
                          className="sr-score-bar-fill"
                          style={{
                            width: `${Math.round(score * 100)}%`,
                            background: label === condLabel ? condStyle.color : "rgba(128,128,128,0.3)"
                          }}
                        />
                      </div>
                      <span className="sr-score-bar-pct">{Math.round(score * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Cause Card ── */}
            <div className="sr-convo-metric-card" style={{ borderLeft: "3px solid #7c4dff" }}>
              <h4>🔍 Identified Trigger</h4>
              <div className="sr-metric-row">
                <span className="sr-metric-label">Primary Cause:</span>
                <span className="sr-metric-val" style={{ color: "#7c4dff", fontWeight: 600 }}>
                  {causeLabel}
                </span>
              </div>
              <div className="sr-metric-row">
                <span className="sr-metric-label">Confidence:</span>
                <span className="sr-metric-val">{Math.round(causeConf * 100)}%</span>
              </div>
              {results?.causeScores && (
                <div className="sr-score-breakdown">
                  {Object.entries(results.causeScores)
                    .sort(([,a], [,b]) => b - a)
                    .map(([label, score]) => (
                    <div key={label} className="sr-score-bar-row">
                      <span className="sr-score-bar-label">{label}</span>
                      <div className="sr-score-bar-track">
                        <div
                          className="sr-score-bar-fill"
                          style={{
                            width: `${Math.round(score * 100)}%`,
                            background: label === causeLabel ? "#7c4dff" : "rgba(128,128,128,0.3)"
                          }}
                        />
                      </div>
                      <span className="sr-score-bar-pct">{Math.round(score * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Depression Fusion Card ── */}
            <div className="sr-convo-metric-card" style={{ borderLeft: `3px solid ${riskStyle.color}` }}>
              <h4>🧠 Depression Screening</h4>
              {depLabel ? (
                <>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Result:</span>
                    <span className="sr-metric-val" style={{ color: riskStyle.color, fontWeight: 600 }}>
                      {depLabel}
                    </span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Risk Level:</span>
                    <span className="sr-metric-val" style={{
                      background: riskStyle.bg,
                      color: riskStyle.color,
                      padding: "2px 10px",
                      borderRadius: "12px",
                      fontSize: "0.85em",
                      fontWeight: 600
                    }}>
                      {riskStyle.text}
                    </span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Confidence:</span>
                    <span className="sr-metric-val">{Math.round(depConf * 100)}%</span>
                  </div>
                  <div style={{ fontSize: "0.78em", color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.5 }}>
                    This result is based on a fusion of text and audio analysis. It is not a clinical diagnosis.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "0.85em", color: "var(--ink-faint)", padding: "8px 0" }}>
                  Depression screening requires audio analysis. Result will appear when audio processing is available.
                </div>
              )}
            </div>

            {/* ── Summary Row ── */}
            <div className="sr-convo-metric-card">
              <h4>📋 Session Summary</h4>
              <div className="sr-metric-row">
                <span className="sr-metric-label">Total Speaking Time:</span>
                <span className="sr-metric-val">{formatTime(results?.totalDuration || 0)}</span>
              </div>
              <div className="sr-metric-row">
                <span className="sr-metric-label">Questions Answered:</span>
                <span className="sr-metric-val">{recordings.filter(r => r !== null).length} / {QUESTIONS.length}</span>
              </div>
            </div>

            {results?.transcript && (
              <div className="sr-convo-transcript-card">
                <h4>Combined Voice Transcript</h4>
                <div className="sr-transcript-text">
                  "{results.transcript}"
                </div>
              </div>
            )}

            <div className="sr-recordings-review">
              <h4>Review Your Responses</h4>
              <div className="sr-audio-review-list">
                {QUESTIONS.map((q, idx) => {
                  const rec = recordings[idx];
                  return (
                    <div className="sr-audio-review-item" key={q.id}>
                      <div className="sr-review-item-header">
                        <span className="sr-review-q-num">Q{idx + 1}</span>
                        <p className="sr-review-q-text">{q.text}</p>
                      </div>
                      {rec?.url && (
                        <div className="sr-review-audio-controls">
                          <audio src={rec.url} controls className="sr-audio-element" />
                          <span className="sr-review-duration">{formatTime(rec.duration)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button className="sr-convo-action-btn" onClick={() => onSessionComplete()} id="btn-finish-reflection">
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // RENDER: Guided interview steps
  const activeQ = QUESTIONS[currentIdx];
  const activeRec = recordings[currentIdx];

  return (
    <div className="sr-conversation-container sr-fade-in">
      <div className="sr-conversation-card">
        {/* Progress Bar & Header */}
        <div className="sr-interview-header">
          <div className="sr-progress-info">
            <span className="sr-progress-fraction">Question {currentIdx + 1} of {QUESTIONS.length}</span>
            <span className="sr-progress-estimate">Est. remaining: ~{Math.max(0, 4 - currentIdx)} mins</span>
          </div>
          <div className="sr-progress-track">
            <div 
              className="sr-progress-bar" 
              style={{ width: `${((currentIdx + 1) / QUESTIONS.length) * 100}%` }} 
            />
          </div>
        </div>

        {/* Current Question Display */}
        <div className="sr-active-question-section">
          <span className="sr-question-tag">{activeQ.category.replace("_", " ")}</span>
          <h3>{activeQ.text}</h3>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="sr-mic-error-message">
            {errorMsg}
          </div>
        )}

        {/* Recording Interface Display */}
        <div className="sr-recording-workspace">
          {/* Status Indicator */}
          <div className="sr-recording-status">
            <div className={`sr-status-dot ${isRecording && !isPaused ? "sr-status-dot--recording" : isPaused ? "sr-status-dot--paused" : ""}`} />
            <span className="sr-status-label">
              {isRecording && !isPaused ? "Recording..." : isPaused ? "Recording Paused" : activeRec ? "Answer Recorded" : "Idle"}
            </span>
          </div>

          {/* Visual Waveform / Pulsing Microelement */}
          <div className="sr-vocal-viz-outer">
            <div className={`sr-vocal-viz-inner ${isRecording && !isPaused ? "sr-vocal-viz-inner--recording" : ""}`}>
              {isRecording && !isPaused ? (
                <div className="sr-wave-bars">
                  {liveLevels.map((lvl, index) => (
                    <div 
                      key={index} 
                      className="sr-wave-bar" 
                      style={{ height: `${lvl * 100}%` }}
                    />
                  ))}
                </div>
              ) : (
                <Mic size={48} className={activeRec ? "sr-mic-icon--has-rec" : "sr-mic-icon--idle"} />
              )}
            </div>
          </div>

          {/* Timer display */}
          <div className="sr-convo-timer">
            {formatTime(isRecording ? elapsed : activeRec ? activeRec.duration : 0)}
          </div>

          {/* Playback preview if recorded */}
          {activeRec && !isRecording && (
            <div className="sr-audio-preview">
              <audio src={activeRec.url} controls className="sr-audio-element" />
            </div>
          )}

          {/* Record Actions / Button Console */}
          <div className="sr-button-console">
            {!isRecording && (
              <button 
                className={`sr-record-btn ${activeRec ? "sr-record-btn--exists" : ""}`}
                onClick={handleReRecordClick}
                aria-label="Start recording response"
                id="btn-start-record-q"
              >
                <Mic size={20} />
                <span>{activeRec ? "Re-record Answer" : "Start Recording"}</span>
              </button>
            )}

            {isRecording && (
              <div className="sr-recording-active-controls">
                {!isPaused ? (
                  <button className="sr-console-subbtn sr-pause-btn" onClick={handlePauseRecording} id="btn-pause-record">
                    <Pause size={18} />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button className="sr-console-subbtn sr-resume-btn" onClick={handleResumeRecording} id="btn-resume-record">
                    <Play size={18} />
                    <span>Resume</span>
                  </button>
                )}

                <button className="sr-console-subbtn sr-stop-btn" onClick={handleStopRecording} id="btn-stop-record">
                  <Square size={18} />
                  <span>Stop Recording</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step Navigation Bar */}
        <div className="sr-step-navigation">
          <button 
            className="sr-nav-step-btn" 
            onClick={handlePrev} 
            disabled={currentIdx === 0 || isRecording}
            aria-label="Back to previous question"
            id="btn-prev-question"
          >
            <ArrowLeft size={16} />
            <span>Previous Question</span>
          </button>

          <button 
            className="sr-nav-step-btn sr-nav-step-btn--next" 
            onClick={handleNext} 
            disabled={!activeRec || isRecording}
            aria-label="Proceed to next question"
            id="btn-next-question"
          >
            <span>{currentIdx === QUESTIONS.length - 1 ? "Submit Reflections" : "Next Question"}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Confirmation modal for re-recording */}
      {showConfirm && (
        <div className="sr-modal-overlay">
          <div className="sr-confirm-dialog sr-fade-in">
            <div className="sr-confirm-icon-wrap">
              <AlertTriangle size={24} className="sr-warning-orange" />
            </div>
            <h4>Replace Answer?</h4>
            <p>Re-recording will permanently delete your current response to this question. Do you wish to proceed?</p>
            <div className="sr-confirm-actions">
              <button className="sr-confirm-btn sr-confirm-btn--cancel" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="sr-confirm-btn sr-confirm-btn--danger" onClick={handleConfirmReRecord} id="btn-confirm-rerecord">
                Yes, Re-record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
