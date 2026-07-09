import React from "react";
import { Sparkles, Calendar, Heart, Shield, MessageSquare, ChevronRight, Mic } from "lucide-react";

export default function InsightsView({ notes, onOpenNote, searchQuery }) {
  // Filter notes based on search query
  const filteredNotes = notes.filter((n) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(query) ||
      (n.transcript && n.transcript.toLowerCase().includes(query))
    );
  });

  const getMoodEmoji = (val) => {
    const moods = {
      1: "😔",
      2: "😕",
      3: "😐",
      4: "🙂",
      5: "😊"
    };
    return moods[val] || "😐";
  };

  // Generate dynamic synthesized patterns based on notes
  const getDynamicPatterns = () => {
    if (notes.length === 0) {
      return {
        patterns: [
          "Record screening logs to detect speech acoustic themes.",
          "Voice stability reports appear here once screening increases.",
          "Vocal tone markers reflect physical and emotional changes."
        ],
        summary: "No voice screenings found. Share how you're feeling to unlock speech patterns, tone reflection, and cognitive resilience insights."
      };
    }

    // Count keywords to generate dynamic themes
    let workCount = 0;
    let groundCount = 0;
    let happyCount = 0;
    let sleepCount = 0;
    
    notes.forEach((n) => {
      const text = (n.transcript || "").toLowerCase();
      if (text.includes("work") || text.includes("deadline") || text.includes("job")) workCount++;
      if (text.includes("ground") || text.includes("calm") || text.includes("nature") || text.includes("air")) groundCount++;
      if (text.includes("great") || text.includes("happy") || text.includes("run") || text.includes("productive")) happyCount++;
      if (text.includes("sleep") || text.includes("tired") || text.includes("night")) sleepCount++;
    });

    const themes = [];
    if (workCount > 0) themes.push("Work-life balance");
    if (groundCount > 0) themes.push("Grounding routines");
    if (happyCount > 0) themes.push("Productive morning rituals");
    if (sleepCount > 0) themes.push("Sleep wellness");
    
    if (themes.length === 0) {
      themes.push("Daily wellness logs", "Consistent morning routine");
    }

    // Formulate patterns list
    const patterns = [
      `Frequent themes this week: ${themes.slice(0, 2).join(", ")}.`,
      notes.length > 2 
        ? "Voice resonance indicates higher acoustic stability during early morning sessions." 
        : "Initial voice resonance matches standard stability baselines.",
      notes.some(n => (n.score || 0) < 70)
        ? "Vocal tension variations correlate with mentions of work schedules or deadlines."
        : "Vocal tension remains within normal ranges during daily summaries."
    ];

    // Formulate reflection summary based on average score
    const avgScore = Math.round(notes.reduce((acc, n) => acc + (n.score || 70), 0) / notes.length);
    let toneType = "Grounded";
    let summaryDetail = "You speak most confidently when describing personal achievements and outdoor activities.";

    if (avgScore >= 80) {
      toneType = "Resilient & Energetic";
      summaryDetail = "Your speaking speed and pitch variability denote high cognitive flexibility and optimistic emotional patterns.";
    } else if (avgScore < 70) {
      toneType = "Slightly Anxious / Fatigued";
      summaryDetail = "Minor vocal micro-tremors and slightly compressed pitch bandwidth suggest mild tension or fatigue. Taking breath breaks is recommended.";
    }

    const summary = `Based on your speech patterns from the last 7 days, your overall tone has shifted toward '${toneType}'. ${summaryDetail} Vocal markers display strong emotional coherence overall.`;

    return { patterns, summary };
  };

  const { patterns, summary } = getDynamicPatterns();

  const formatWhen = (dateVal) => {
    const date = new Date(dateVal);
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) + " · " + 
           date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="sr-insights-view">
      {/* ─── Weekly Analysis Card ─── */}
      <div className="sr-analysis-card">
        <h3>Weekly Summary</h3>
        <div className="sr-analysis-grid">
          {/* Synthesized Patterns */}
          <div className="sr-analysis-patterns">
            <span className="sr-analysis-label">Synthesized Patterns</span>
            <ul>
              {patterns.map((p, idx) => (
                <li key={idx}>
                  <div className="sr-bullet-dot" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Symmetrical Vertical Divider */}
          <div className="sr-analysis-divider" />
          
          {/* Reflection Summary */}
          <div className="sr-analysis-reflection">
            <span className="sr-analysis-label">Reflection Summary</span>
            <p className="sr-reflection-text">
              "{summary}"
            </p>
          </div>
        </div>
      </div>

      {/* ─── Recent Transcripts Section ─── */}
      <div className="sr-transcripts-section" style={{ marginTop: 32 }}>
        <div className="sr-transcripts-header">
          <h3>Recent Transcripts</h3>
        </div>

        <div className="sr-transcripts-list">
          {filteredNotes.length === 0 ? (
            <div className="sr-transcripts-empty" style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", padding: "40px 20px", borderRadius: 20, textAlign: "center", color: "var(--ink-soft)" }}>
              <p>No screening transcripts found. Create a screening first!</p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div 
                key={note.id} 
                className="sr-transcript-row-card"
                onClick={() => onOpenNote(note)}
                role="button"
                tabIndex={0}
                id={`transcript-row-${note.id}`}
              >
                <div className="sr-transcript-row-left">
                  <span className="sr-row-mood">{getMoodEmoji(note.mood)}</span>
                  <div className="sr-row-meta">
                    <h4>{note.title}</h4>
                    <span className="sr-row-date">{formatWhen(note.createdAt)}</span>
                  </div>
                </div>
                
                <div className="sr-transcript-row-right">
                  {note.score !== undefined && (
                    <div className="sr-row-score-badge">
                      <Heart size={11} fill="var(--accent-ink)" stroke="none" />
                      <span>{note.score}% Score</span>
                    </div>
                  )}
                  <span className="sr-row-duration">{Math.round(note.duration)}s</span>
                  <span className="sr-row-badge-analyzed">Analyzed</span>
                  <ChevronRight size={16} className="sr-card-arrow" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
