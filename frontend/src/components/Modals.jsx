import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Wind,
  Eye,
  Brain,
  Activity,
  Heart,
  BookOpen,
  PhoneCall,
  MessageSquare,
  Check,
  Send,
  Calendar,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw
} from "lucide-react";

/* ─── Article Modal ─── */
export function ArticleModal({ article, onClose }) {
  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal sr-modal--article" role="dialog" aria-modal="true">
        <div className="sr-modal-head">
          <div className="sr-article-badge">
            <BookOpen size={14} />
            <span>KNOWLEDGE LIBRARY</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        
        <h2 className="sr-article-title">{article.title}</h2>
        <p className="sr-article-subtitle">{article.subtitle}</p>
        
        <hr className="sr-divider" />
        
        <div className="sr-article-body">
          {article.content.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        
        <div className="sr-article-footer">
          <button className="sr-actionbtn sr-actionbtn--accent" onClick={onClose}>
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Breathing Exercise Modal ─── */
export function BreathingModal({ type = "478", onClose, onComplete }) {
  const [phase, setPhase] = useState("idle"); // idle | inhale | hold1 | exhale | hold2
  const [count, setCount] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef(null);

  // Configuration for breathing patterns
  const config = type === "box" 
    ? { name: "Box Breathing", desc: "4s Inhale · 4s Hold · 4s Exhale · 4s Hold", inhale: 4, hold1: 4, exhale: 4, hold2: 4 }
    : { name: "4-7-8 Technique", desc: "4s Inhale · 7s Hold · 8s Exhale", inhale: 4, hold1: 7, exhale: 8, hold2: 0 };

  const startExercise = () => {
    setIsActive(true);
    setCycle(1);
    runPhase("inhale", config.inhale);
  };

  const stopExercise = () => {
    clearTimeout(timerRef.current);
    setIsActive(false);
    setPhase("idle");
    setCount(0);
    setCycle(1);
  };

  const runPhase = (p, c) => {
    setPhase(p);
    setCount(c);
    
    const tick = (val) => {
      if (val > 1) {
        timerRef.current = setTimeout(() => {
          setCount(val - 1);
          tick(val - 1);
        }, 1000);
      } else {
        timerRef.current = setTimeout(() => {
          // Transition to next phase
          if (p === "inhale") {
            if (config.hold1 > 0) {
              runPhase("hold1", config.hold1);
            } else {
              runPhase("exhale", config.exhale);
            }
          } else if (p === "hold1") {
            runPhase("exhale", config.exhale);
          } else if (p === "exhale") {
            if (config.hold2 > 0) {
              runPhase("hold2", config.hold2);
            } else {
              // End of cycle
              advanceCycle();
            }
          } else if (p === "hold2") {
            advanceCycle();
          }
        }, 1000);
      }
    };
    
    tick(c);
  };

  const advanceCycle = () => {
    if (cycle >= 4) {
      // Completed 4 cycles
      setIsActive(false);
      setPhase("completed");
      if (onComplete) onComplete();
    } else {
      setCycle((prev) => prev + 1);
      runPhase("inhale", config.inhale);
    }
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const getPhaseLabel = () => {
    switch (phase) {
      case "inhale": return "Breathe In";
      case "hold1":
      case "hold2": return "Hold";
      case "exhale": return "Breathe Out";
      case "completed": return "Well Done!";
      default: return "Ready";
    }
  };

  const getPhaseDesc = () => {
    switch (phase) {
      case "inhale": return "Fill your lungs gently with air";
      case "hold1":
      case "hold2": return "Rest in the stillness";
      case "exhale": return "Slowly release all tension";
      case "completed": return "You have completed the breathing session. Take a moment to feel the calm.";
      default: return "Press begin to start a calming session.";
    }
  };

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal sr-modal--breathe" role="dialog" aria-modal="true">
        <div className="sr-modal-head">
          <div className="sr-article-badge" style={{ color: "var(--accent-ink)", background: "var(--accent-soft)" }}>
            <Wind size={14} />
            <span>BREATHWORK</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="sr-modal-title">{config.name}</h2>
        <p className="sr-modal-subtitle">{config.desc}</p>

        <div className="sr-breathe-container">
          <div className={`sr-breathe-circle-outer sr-breathe-circle-outer--${phase}`}>
            <div className={`sr-breathe-circle-inner sr-breathe-circle-inner--${phase}`}>
              {isActive && (
                <div className="sr-breathe-info">
                  <span className="sr-breathe-number">{count}</span>
                  <span className="sr-breathe-cycle">Cycle {cycle}/4</span>
                </div>
              )}
              {phase === "completed" && <Check size={36} className="sr-checkmark-green" />}
            </div>
          </div>
          
          <h3 className="sr-breathe-phase-label">{getPhaseLabel()}</h3>
          <p className="sr-breathe-phase-desc">{getPhaseDesc()}</p>
        </div>

        <div className="sr-breathe-actions">
          {phase === "completed" ? (
            <button className="sr-actionbtn sr-actionbtn--accent" style={{ width: "100%" }} onClick={onClose}>
              Back to Dashboard
            </button>
          ) : isActive ? (
            <button className="sr-actionbtn sr-actionbtn--danger" style={{ width: "100%" }} onClick={stopExercise}>
              Stop Exercise
            </button>
          ) : (
            <button className="sr-actionbtn sr-actionbtn--accent" style={{ width: "100%" }} onClick={startExercise}>
              Begin Breathing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 5-4-3-2-1 Grounding Modal ─── */
export function GroundingModal({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [inputs, setInputs] = useState({
    see: ["", "", "", "", ""],
    touch: ["", "", "", ""],
    hear: ["", "", ""],
    smell: ["", ""],
    taste: [""]
  });

  const handleInputChange = (field, index, value) => {
    setInputs((prev) => {
      const updated = [...prev[field]];
      updated[index] = value;
      return { ...prev, [field]: updated };
    });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return inputs.see.every((val) => val.trim() !== "");
      case 2: return inputs.touch.every((val) => val.trim() !== "");
      case 3: return inputs.hear.every((val) => val.trim() !== "");
      case 4: return inputs.smell.every((val) => val.trim() !== "");
      case 5: return inputs.taste.every((val) => val.trim() !== "");
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      if (onComplete) onComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal sr-modal--grounding" role="dialog" aria-modal="true">
        <div className="sr-modal-head">
          <div className="sr-article-badge" style={{ color: "#3c6382", background: "#ebf3f9" }}>
            <Eye size={14} />
            <span>GROUNDING TECHNIQUE</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="sr-modal-title">5-4-3-2-1 Grounding</h2>
        <p className="sr-modal-subtitle">Re-anchor yourself in the present moment by engaging your senses.</p>

        {/* Progress indicators */}
        <div className="sr-grounding-steps">
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <div 
              key={num} 
              className={`sr-grounding-dot ${step === num ? "sr-grounding-dot--active" : ""} ${step > num ? "sr-grounding-dot--passed" : ""}`}
            >
              {num < 6 ? num : "✓"}
            </div>
          ))}
        </div>

        <div className="sr-grounding-body">
          {step === 1 && (
            <div className="sr-grounding-panel">
              <h3 className="sr-grounding-prompt">Identify <span className="sr-highlight">5 things</span> you can see around you:</h3>
              <div className="sr-input-group">
                {inputs.see.map((val, idx) => (
                  <input
                    key={idx}
                    placeholder={`Thing ${idx + 1}`}
                    value={val}
                    onChange={(e) => handleInputChange("see", idx, e.target.value)}
                    className="sr-grounding-input"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="sr-grounding-panel">
              <h3 className="sr-grounding-prompt">Identify <span className="sr-highlight">4 things</span> you can touch or feel:</h3>
              <div className="sr-input-group">
                {inputs.touch.map((val, idx) => (
                  <input
                    key={idx}
                    placeholder={`Feeling ${idx + 1} (e.g. soft sweater, warm desk)`}
                    value={val}
                    onChange={(e) => handleInputChange("touch", idx, e.target.value)}
                    className="sr-grounding-input"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="sr-grounding-panel">
              <h3 className="sr-grounding-prompt">Identify <span className="sr-highlight">3 things</span> you can hear:</h3>
              <div className="sr-input-group">
                {inputs.hear.map((val, idx) => (
                  <input
                    key={idx}
                    placeholder={`Sound ${idx + 1} (e.g. distant hum, birds chirping)`}
                    value={val}
                    onChange={(e) => handleInputChange("hear", idx, e.target.value)}
                    className="sr-grounding-input"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="sr-grounding-panel">
              <h3 className="sr-grounding-prompt">Identify <span className="sr-highlight">2 things</span> you can smell:</h3>
              <div className="sr-input-group">
                {inputs.smell.map((val, idx) => (
                  <input
                    key={idx}
                    placeholder={`Scent ${idx + 1} (e.g. coffee, fresh rain)`}
                    value={val}
                    onChange={(e) => handleInputChange("smell", idx, e.target.value)}
                    className="sr-grounding-input"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="sr-grounding-panel">
              <h3 className="sr-grounding-prompt">Identify <span className="sr-highlight">1 thing</span> you can taste:</h3>
              <div className="sr-input-group">
                {inputs.taste.map((val, idx) => (
                  <input
                    key={idx}
                    placeholder="Taste (e.g. minty toothpaste, water)"
                    value={val}
                    onChange={(e) => handleInputChange("taste", idx, e.target.value)}
                    className="sr-grounding-input"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="sr-grounding-completed">
              <div className="sr-completed-illustration">
                <Heart size={44} fill="var(--accent)" stroke="none" />
              </div>
              <h3>Grounded and Present</h3>
              <p>Your mind has shifted focus from thoughts to physical anchors. You are here, you are safe, and you are in control.</p>
              
              <div className="sr-grounding-summary-card">
                <strong>Your anchors:</strong>
                <ul>
                  <li>👀 See: {inputs.see.join(", ")}</li>
                  <li>🖐️ Touch: {inputs.touch.join(", ")}</li>
                  <li>👂 Hear: {inputs.hear.join(", ")}</li>
                  <li>👃 Smell: {inputs.smell.join(", ")}</li>
                  <li>👅 Taste: {inputs.taste[0]}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="sr-grounding-footer">
          {step > 1 && step < 6 && (
            <button className="sr-actionbtn sr-actionbtn--secondary" onClick={handlePrev}>
              Back
            </button>
          )}
          
          {step < 6 ? (
            <button 
              className={`sr-actionbtn ${isStepValid() ? "sr-actionbtn--accent" : "sr-actionbtn--disabled"}`}
              onClick={handleNext}
              disabled={!isStepValid()}
              style={{ marginLeft: "auto" }}
            >
              Continue
            </button>
          ) : (
            <button className="sr-actionbtn sr-actionbtn--accent" onClick={handleNext} style={{ width: "100%" }}>
              Finish Exercise
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Cognitive Reframing Modal ─── */
export function ReframingModal({ onClose, onComplete }) {
  const [thought, setThought] = useState("");
  const [reframe, setReframe] = useState("");
  const [step, setStep] = useState(1);
  
  // Future backend connection note:
  // Reframed thoughts can be POSTed to `/api/reframes` database and fetched in insights.
  const handleSave = () => {
    // Save to localStorage
    const saved = JSON.parse(localStorage.getItem("reframes") || "[]");
    saved.unshift({
      id: Date.now().toString(),
      original: thought,
      reframed: reframe,
      date: new Date().toISOString()
    });
    localStorage.setItem("reframes", JSON.stringify(saved));
    
    if (onComplete) onComplete();
    onClose();
  };

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal sr-modal--reframing" role="dialog" aria-modal="true">
        <div className="sr-modal-head">
          <div className="sr-article-badge" style={{ color: "#68489a", background: "#f2edf8" }}>
            <Brain size={14} />
            <span>COGNITIVE REFRAMING</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="sr-modal-title">Cognitive Reframing</h2>
        <p className="sr-modal-subtitle">Identify anxious or automatic negative thoughts and rewrite them into healthy, balanced perspectives.</p>

        <div className="sr-reframing-body">
          {step === 1 ? (
            <div className="sr-reframing-step">
              <label className="sr-label">1. Capture the Automatic Negative Thought (ANT)</label>
              <span className="sr-sublabel">Write down exactly what is bothering you, without filtering. (e.g. "I always make mistakes, I can't do anything right.")</span>
              <textarea
                placeholder="Type your thought here..."
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                className="sr-textarea"
                rows={4}
              />
              <div className="sr-reframing-tips">
                <strong>Watch out for distortions:</strong>
                <ul>
                  <li>❌ All-or-nothing thinking ("always", "never")</li>
                  <li>❌ Catastrophizing (expecting the absolute worst)</li>
                  <li>❌ Emotional reasoning ("I feel bad, so I must be bad")</li>
                </ul>
              </div>
              <button 
                className={`sr-actionbtn ${thought.trim() ? "sr-actionbtn--accent" : "sr-actionbtn--disabled"}`}
                disabled={!thought.trim()}
                onClick={() => setStep(2)}
                style={{ width: "100%", marginTop: 16 }}
              >
                Proceed to Reframe
              </button>
            </div>
          ) : (
            <div className="sr-reframing-step">
              <div className="sr-original-thought-quote">
                💬 <em>"{thought}"</em>
              </div>
              
              <label className="sr-label">2. Challenge and Reframe it</label>
              <span className="sr-sublabel">Rewrite the thought by looking for actual evidence, context, and a kinder, objective tone. (e.g. "I make mistakes sometimes like everyone, but I also succeed, and I will learn from this.")</span>
              <textarea
                placeholder="Type the objective, balanced reframe..."
                value={reframe}
                onChange={(e) => setReframe(e.target.value)}
                className="sr-textarea"
                rows={4}
                autoFocus
              />
              
              <div className="sr-reframing-tips" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
                <strong>Reframe Guideline:</strong>
                <p>Is it true? Is it constructive? Am I treating myself as a friend? Speak to yourself with compassion.</p>
              </div>

              <div className="sr-flex-buttons" style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="sr-actionbtn sr-actionbtn--secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                  Edit Original
                </button>
                <button 
                  className={`sr-actionbtn ${reframe.trim() ? "sr-actionbtn--accent" : "sr-actionbtn--disabled"}`}
                  disabled={!reframe.trim()}
                  onClick={handleSave}
                  style={{ flex: 2 }}
                >
                  Save Reframe
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Body Scan Modal ─── */
export function BodyScanModal({ onClose, onComplete }) {
  const [activePart, setActivePart] = useState("head"); // head | shoulders | chest | hands | core | legs | feet
  const [timeLeft, setTimeLeft] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  const parts = [
    { id: "head", label: "1. Head & Face", desc: "Soften your eyes. Unclench your jaw. Release the tension in your forehead. Let your face relax." },
    { id: "shoulders", label: "2. Neck & Shoulders", desc: "Let your shoulders drop away from your ears. Roll them back slightly and release any stiffness." },
    { id: "chest", label: "3. Chest & Breath", desc: "Feel the rise and fall of your chest. Open your breathing. Let your lungs expand fully and calmly." },
    { id: "hands", label: "4. Arms & Hands", desc: "Rest your arms heavy on your lap. Unfurl your fingers. Release all grip in your palms." },
    { id: "core", label: "5. Core & Stomach", desc: "Relax your stomach. Don't hold it in. Breathe deep into your abdomen." },
    { id: "legs", label: "6. Hips & Legs", desc: "Let your thighs feel heavy and supported by the chair. Release all holding in your hips." },
    { id: "feet", label: "7. Feet & Anchors", desc: "Feel your feet flat on the floor. Sense the connection and stability of the earth below you." }
  ];

  const currentConfig = parts.find((p) => p.id === activePart);
  const currentIndex = parts.findIndex((p) => p.id === activePart);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(10);
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      // Transition to next body part
      if (currentIndex < parts.length - 1) {
        setActivePart(parts[currentIndex + 1].id);
        setTimeLeft(10);
      } else {
        setIsRunning(false);
        setActivePart("completed");
        if (onComplete) onComplete();
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [isRunning, timeLeft, currentIndex]);

  const handlePartSelect = (id) => {
    setActivePart(id);
    setTimeLeft(10);
    setIsRunning(false);
  };

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal sr-modal--bodyscan" role="dialog" aria-modal="true">
        <div className="sr-modal-head">
          <div className="sr-article-badge" style={{ color: "#d35400", background: "#fdf2e9" }}>
            <Activity size={14} />
            <span>MINDFULNESS GUIDE</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="sr-modal-title">Body Scan Meditation</h2>
        <p className="sr-modal-subtitle">Gently tune into your body to release physical tension and calm your nerves.</p>

        {activePart === "completed" ? (
          <div className="sr-bodyscan-completed" style={{ textAlign: "center", padding: "30px 10px" }}>
            <div className="sr-completed-illustration">
              <Check size={36} className="sr-checkmark-green" />
            </div>
            <h3>Scan Completed</h3>
            <p>You have taken the time to connect with your body and release trapped stress. Carry this calm and awareness with you.</p>
            <button className="sr-actionbtn sr-actionbtn--accent" onClick={onClose} style={{ width: "100%", marginTop: 24 }}>
              Close Guide
            </button>
          </div>
        ) : (
          <div className="sr-bodyscan-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20, marginTop: 20 }}>
            {/* SVG body map */}
            <div className="sr-bodyscan-visual" style={{ display: "flex", justifyContent: "center", background: "#f8f9fa", borderRadius: 16, padding: 10 }}>
              <svg viewBox="0 0 100 200" height="200" style={{ width: "100%" }}>
                <path d="M50,15 A12,12 0 1,1 50,39 A12,12 0 1,1 50,15 Z" fill={activePart === "head" ? "var(--accent)" : "#cbd5e1"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("head")} />
                <path d="M42,42 L58,42 L65,58 L60,85 L56,120 L58,160 L54,195 L46,195 L42,160 L44,120 L40,85 L35,58 Z" fill="#cbd5e1" />
                <path d="M42,42 L58,42 L62,52 L38,52 Z" fill={activePart === "shoulders" ? "var(--accent)" : "transparent"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("shoulders")} />
                <path d="M40,53 L60,53 L60,70 L40,70 Z" fill={activePart === "chest" ? "var(--accent)" : "transparent"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("chest")} />
                <path d="M36,54 L34,80 L31,98 L37,98 L39,80 Z M64,54 L66,80 L69,98 L63,98 L61,80 Z" fill={activePart === "hands" ? "var(--accent)" : "#94a3b8"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("hands")} />
                <path d="M40,71 L60,71 L58,95 L42,95 Z" fill={activePart === "core" ? "var(--accent)" : "transparent"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("core")} />
                <path d="M42,96 L58,96 L58,155 L42,155 Z" fill={activePart === "legs" ? "var(--accent)" : "transparent"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("legs")} />
                <path d="M41,156 L47,156 L47,192 L41,192 Z M53,156 L59,156 L59,192 L53,192 Z" fill="#64748b" />
                <path d="M40,192 L48,192 L48,197 L38,197 Z M52,192 L60,192 L62,197 L52,197 Z" fill={activePart === "feet" ? "var(--accent)" : "transparent"} style={{ transition: "fill 0.3s" }} cursor="pointer" onClick={() => handlePartSelect("feet")} />
              </svg>
            </div>

            {/* Instruction Panel */}
            <div className="sr-bodyscan-controls" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--ink)" }}>{currentConfig?.label}</h3>
                <div className="sr-bodyscan-timer" style={{ fontFamily: "monospace", fontSize: 24, fontWeight: "bold", margin: "10px 0", color: "var(--accent-ink)" }}>
                  0:{timeLeft.toString().padStart(2, "0")}
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  {currentConfig?.desc}
                </p>
              </div>

              {/* Progress dots list */}
              <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
                {parts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePartSelect(p.id)}
                    style={{
                      width: 10, height: 10, borderRadius: "50%", border: "none",
                      background: activePart === p.id ? "var(--accent)" : "#cbd5e1",
                      cursor: "pointer", padding: 0
                    }}
                    title={p.label}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {isRunning ? (
                  <button className="sr-actionbtn sr-actionbtn--secondary" onClick={handlePause} style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", flex: 1 }}>
                    <Pause size={14} /> Pause
                  </button>
                ) : (
                  <button className="sr-actionbtn sr-actionbtn--accent" onClick={handleStart} style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", flex: 1 }}>
                    <Play size={14} fill="currentColor" /> Start
                  </button>
                )}
                <button className="sr-iconbtn" onClick={handleReset} style={{ border: "1px solid var(--border)", borderRadius: 12 }}>
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Gratitude Log Modal ─── */
export function GratitudeModal({ onClose, onComplete }) {
  const [gratitudes, setGratitudes] = useState(["", "", ""]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("gratitudes") || "[]");
    setHistory(saved);
  }, []);

  const handleInputChange = (idx, value) => {
    setGratitudes((prev) => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  };

  const handleSave = () => {
    const validItems = gratitudes.filter((g) => g.trim() !== "");
    if (validItems.length === 0) return;

    const newEntry = {
      id: Date.now().toString(),
      items: validItems,
      date: new Date().toISOString()
    };

    // Future backend connection note:
    // This logs data structure can be POSTed to `/api/gratitude` and database saved.
    const updatedHistory = [newEntry, ...history];
    localStorage.setItem("gratitudes", JSON.stringify(updatedHistory));
    setHistory(updatedHistory);
    setGratitudes(["", "", ""]);

    if (onComplete) onComplete();
  };

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal sr-modal--gratitude" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
        <div className="sr-modal-head">
          <div className="sr-article-badge" style={{ color: "#16a085", background: "#e8f8f5" }}>
            <Heart size={14} />
            <span>GRATITUDE JOURNAL</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="sr-modal-title">Gratitude Journal</h2>
        <p className="sr-modal-subtitle">Reflecting on positive elements in your life strengthens neural wellness pathways.</p>

        <div className="sr-gratitude-form" style={{ marginTop: 16 }}>
          <label className="sr-label">Three things you are thankful for today:</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {gratitudes.map((val, idx) => (
              <input
                key={idx}
                placeholder={`${idx + 1}. I am grateful for...`}
                value={val}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                className="sr-grounding-input"
                style={{ width: "100%" }}
              />
            ))}
          </div>
          <button 
            className={`sr-actionbtn ${gratitudes.some((g) => g.trim() !== "") ? "sr-actionbtn--accent" : "sr-actionbtn--disabled"}`}
            disabled={!gratitudes.some((g) => g.trim() !== "")}
            onClick={handleSave}
            style={{ width: "100%", marginTop: 14 }}
          >
            Record Entry
          </button>
        </div>

        <hr className="sr-divider" style={{ margin: "20px 0" }} />

        <div className="sr-gratitude-history">
          <label className="sr-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={13} /> Past Reflections ({history.length})
          </label>
          <div className="sr-gratitude-list" style={{ maxHeight: 180, overflowY: "auto", marginTop: 8, paddingRight: 4 }}>
            {history.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "var(--ink-faint)", fontSize: 13, textAlign: "center", margin: "20px 0" }}>
                No journal entries recorded yet. Begin by writing down a reflection.
              </p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} style={{ background: "#f8f9fa", border: "1px solid #edf2f0", borderRadius: 12, padding: "10px 14px", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 4 }}>
                    {new Date(entry.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>
                    {entry.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Crisis Hotlines Dialer Overlay ─── */
export function HotlinesModal({ onClose }) {
  const contacts = [
    { name: "988 Suicide & Crisis Lifeline", details: "Call or text 988. Free, confidential, 24/7 mental health support.", number: "988" },
    { name: "Crisis Text Line", details: "Text 'HOME' to 741741 to connect with a crisis counselor 24/7.", number: "741741" },
    { name: "The Trevor Project (LGBTQ)", details: "Call 866-488-7386 or text 'START' to 678-678.", number: "866-488-7386" },
    { name: "National Domestic Violence Hotline", details: "Call 800-799-7233 or text 'START' to 88788.", number: "800-799-7233" }
  ];

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
        <div className="sr-modal-head">
          <div className="sr-article-badge" style={{ color: "#c0392b", background: "rgba(231,76,60,0.1)" }}>
            <AlertTriangle size={14} />
            <span>CRISIS HELP & PHONE SUPPORT</span>
          </div>
          <button className="sr-iconbtn sr-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="sr-modal-title" style={{ color: "#c0392b" }}>Crisis Hotlines</h2>
        <p className="sr-modal-subtitle">If you are in immediate danger, please reach out. Support is available for free, at any time.</p>

        <div className="sr-hotline-list" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {contacts.map((c, idx) => (
            <div key={idx} style={{ border: "1px solid rgba(231,76,60,0.15)", background: "rgba(231,76,60,0.02)", borderRadius: 16, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ paddingRight: 10 }}>
                <h3 style={{ margin: "0 0 3px", fontSize: 14.5, color: "#000", fontWeight: 600 }}>{c.name}</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.4 }}>{c.details}</p>
              </div>
              <a href={`tel:${c.number.replace(/-/g, "")}`} className="sr-dial-btn" style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "#c0392b", color: "#fff", alignItems: "center", justifyContent: "center", textDecoration: "none", display: "flex", boxShadow: "0 4px 10px rgba(192,57,43,0.3)" }}>
                <PhoneCall size={16} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Crisis Chat Overlay ─── */
export function ChatModal({ onClose }) {
  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "counselor",
      text: "Hello, thank you for reaching out to Serenity Support. My name is Sarah. I'm here to listen and help you stay safe. What's on your mind today?",
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Simulate counselor typing
    setTimeout(() => {
      const counselorReplies = [
        "Thank you for sharing that with me. I hear how difficult things have been for you. You don't have to carry this alone.",
        "I'm here right now. Let's take a deep breath together. What can we do right now to make you feel a little safer?",
        "Your life and your feelings are important. I'm glad you reached out today. Can you tell me if you have a safe place or someone nearby?",
        "It's completely okay to feel overwhelmed. We can take this step-by-step. What is one small thing that could bring a tiny bit of comfort?"
      ];
      
      const reply = {
        id: (Date.now() + 1).toString(),
        sender: "counselor",
        text: counselorReplies[Math.floor(Math.random() * counselorReplies.length)],
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, reply]);
    }, 1500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="sr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-modal" role="dialog" aria-modal="true" style={{ maxWidth: 480, height: "80vh", display: "flex", flexDirection: "column", padding: 0 }}>
        {/* Chat Header */}
        <div style={{ background: "#c0392b", color: "#fff", padding: "16px 20px", borderTopLeftRadius: "var(--radius-lg)", borderTopRightRadius: "var(--radius-lg)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2ecc71" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Serenity Crisis Chat</h3>
              <span style={{ fontSize: 11, opacity: 0.8 }}>Sarah - Crisis Counselor</span>
            </div>
          </div>
          <button className="sr-iconbtn" onClick={onClose} style={{ color: "#fff" }} aria-label="Close chat">
            <X size={18} />
          </button>
        </div>

        {/* Messages Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, background: "#f8f9fa", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.sender === "user" ? "var(--accent)" : "#fff",
                color: m.sender === "user" ? "#fff" : "var(--ink)",
                border: m.sender === "user" ? "none" : "1px solid #e2e8f0",
                borderRadius: m.sender === "user" ? "18px 18px 2px 18px" : "18px 18px 18px 2px",
                padding: "10px 14px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                position: "relative"
              }}
            >
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{m.text}</p>
              <span style={{ fontSize: 9, opacity: 0.6, display: "block", textAlign: "right", marginTop: 4 }}>
                {m.time}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "#fff", borderBottomLeftRadius: "var(--radius-lg)", borderBottomRightRadius: "var(--radius-lg)" }}>
          <input
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 999, padding: "8px 16px", outline: "none", fontSize: 13 }}
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "none", 
              background: inputValue.trim() ? "var(--accent)" : "#cbd5e1",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: inputValue.trim() ? "pointer" : "default"
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
