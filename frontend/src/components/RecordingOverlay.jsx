import React from "react";
import { Mic, X, Square } from "lucide-react";

export default function RecordingOverlay({ 
  elapsed, 
  levels, 
  onStop, 
  onCancel,
  isProcessing = false 
}) {
  const formatTime = (totalSeconds) => {
    if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="sr-overlay" role="dialog" aria-modal="true" style={{ zIndex: 100 }}>
      <div className="sr-modal sr-modal--recording" style={{ maxWidth: 440, padding: "32px 24px", textAlign: "center" }}>
        
        {isProcessing ? (
          <div className="sr-processing-flow">
            {/* Loading spinner */}
            <div className="sr-processing-spinner">
              <div className="sr-spinner-ring" />
              <Mic size={24} className="sr-spinner-mic" />
            </div>
            <h3 style={{ margin: "24px 0 8px", fontSize: 18, fontWeight: 700 }}>Analyzing Voice Biometrics</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              Decoding acoustic features and synthesizing transcription analysis... This may take up to 20 seconds.
            </p>
          </div>
        ) : (
          <div className="sr-recording-flow">
            {/* Header */}
            <div className="sr-recording-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="sr-article-badge" style={{ color: "#c0392b", background: "rgba(231,76,60,0.08)", margin: 0 }}>
                <span className="sr-rec-indicator-dot" />
                <span>LIVE RECORDING</span>
              </div>
              <button 
                className="sr-iconbtn" 
                onClick={onCancel}
                aria-label="Cancel screening"
                title="Discard"
              >
                <X size={18} />
              </button>
            </div>

            <h3 style={{ margin: "16px 0 4px", fontSize: 20, fontWeight: 700 }}>Voice Screening</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              Speak naturally about your day, how you feel, or any stress you are experiencing.
            </p>

            {/* Pulsing micro area */}
            <div className="sr-pulse-mic-container">
              <div className="sr-pulse-circle sr-pulse-circle--1" />
              <div className="sr-pulse-circle sr-pulse-circle--2" />
              <div className="sr-pulse-icon-button">
                <Mic size={28} className="sr-mic-red" />
              </div>
            </div>

            {/* Time elapsed */}
            <div className="sr-recording-timer" style={{ fontFamily: "monospace", fontSize: 28, fontWeight: "bold", margin: "24px 0 16px", color: "var(--ink)" }}>
              {formatTime(elapsed)}
            </div>

            {/* Live levels waveform bar */}
            <div className="sr-recording-waveform-wrapper" style={{ height: 48, display: "flex", alignItems: "flex-end", gap: 3, padding: "0 10px", margin: "0 0 28px" }}>
              {levels.map((lvl, idx) => (
                <span
                  key={idx}
                  className="sr-recording-level-bar"
                  style={{
                    flex: 1,
                    height: `${Math.max(8, lvl * 100)}%`,
                    background: "rgba(231, 76, 60, 0.7)",
                    borderRadius: 4,
                    transition: "height 0.08s linear"
                  }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="sr-recording-actions" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button 
                className="sr-actionbtn sr-actionbtn--secondary" 
                onClick={onCancel}
                style={{ flex: 1 }}
                id="btn-cancel-recording"
              >
                Discard
              </button>
              <button 
                className="sr-actionbtn sr-actionbtn--danger" 
                onClick={onStop}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyCenter: "center", gap: 8, justifyContent: "center" }}
                id="btn-stop-recording"
              >
                <Square size={13} fill="currentColor" />
                <span>Save & Analyze</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
