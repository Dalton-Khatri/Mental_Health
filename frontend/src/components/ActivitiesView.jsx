import React from "react";
import { Wind, Box, Eye, Brain, Activity, Heart, ChevronRight } from "lucide-react";

export default function ActivitiesView({ onOpenModal }) {
  const breathingCards = [
    {
      id: "breathing_478",
      title: "4-7-8 Technique",
      duration: "5 Minutes",
      focus: "Deep Relaxation",
      icon: <Wind size={22} className="sr-activity-icon-svg" />,
      themeClass: "sr-activity-theme--mint"
    },
    {
      id: "breathing_box",
      title: "Box Breathing",
      duration: "4 Minutes",
      focus: "Stress Control",
      icon: <Box size={20} className="sr-activity-icon-svg" />,
      themeClass: "sr-activity-theme--teal"
    }
  ];

  const exerciseCards = [
    {
      id: "grounding_54321",
      title: "5-4-3-2-1 Grounding",
      subtitle: "Sensory focus",
      icon: <Eye size={20} />,
      themeClass: "sr-exercise-theme--blue"
    },
    {
      id: "cognitive_reframing",
      title: "Cognitive Reframing",
      subtitle: "Perspective shift",
      icon: <Brain size={20} />,
      themeClass: "sr-exercise-theme--purple"
    },
    {
      id: "body_scan",
      title: "Body Scan",
      subtitle: "Physical awareness",
      icon: <Activity size={20} />,
      themeClass: "sr-exercise-theme--orange"
    },
    {
      id: "gratitude_log",
      title: "Gratitude Log",
      subtitle: "Focus on positive",
      icon: <Heart size={20} />,
      themeClass: "sr-exercise-theme--emerald"
    }
  ];

  return (
    <div className="sr-activities-view">
      {/* ─── Breathing Techniques Section ─── */}
      <div className="sr-activities-section">
        <h2 className="sr-activities-h2">Breathing Techniques</h2>
        <div className="sr-activities-grid sr-activities-grid--breathing">
          {breathingCards.map((card) => (
            <div 
              key={card.id} 
              className={`sr-activity-card ${card.themeClass}`}
              onClick={() => onOpenModal(card.id)}
              role="button"
              tabIndex={0}
              id={`card-${card.id}`}
            >
              <div className="sr-activity-card-icon">
                {card.icon}
              </div>
              <div className="sr-activity-card-info">
                <h3>{card.title}</h3>
                <span className="sr-activity-card-meta">
                  {card.duration} · {card.focus}
                </span>
              </div>
              <ChevronRight size={18} className="sr-card-arrow" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Mental Exercises Section ─── */}
      <div className="sr-activities-section" style={{ marginTop: 40 }}>
        <h2 className="sr-activities-h2">Mental Exercises</h2>
        <div className="sr-activities-grid sr-activities-grid--exercises">
          {exerciseCards.map((card) => (
            <div 
              key={card.id} 
              className={`sr-exercise-card ${card.themeClass}`}
              onClick={() => onOpenModal(card.id)}
              role="button"
              tabIndex={0}
              id={`card-${card.id}`}
            >
              <div className="sr-exercise-card-icon">
                {card.icon}
              </div>
              <div className="sr-exercise-card-info">
                <h3>{card.title}</h3>
                <span className="sr-exercise-card-subtitle">{card.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
