import React from "react";
import { Heart, Phone, MessageSquare, AlertTriangle, Shield, CheckCircle } from "lucide-react";

export default function SupportView({ onOpenModal }) {
  const FAQ = [
    {
      q: "How does the voice screening check-in work?",
      a: "When you record your voice, our algorithms analyze features like tempo, frequency fluctuations (jitter), and amplitude variations (shimmer). These acoustic patterns are evaluated alongside a transcription analysis to check for markers of vocal tension or emotional fatigue."
    },
    {
      q: "Is my voice data private and secure?",
      a: "Yes. All audio recordings and transcriptions are saved locally on your device's browser storage or processed locally. We take data protection seriously, and no emotional profiles are shared without your consent."
    },
    {
      q: "What should I do if my wellness score is low?",
      a: "A lower score is simply a reflection of acoustic or lexical indicators of stress or low energy. We recommend trying our grounding exercises, setting aside 5 minutes for breathwork, or writing down reflections in your gratitude journal."
    }
  ];

  return (
    <div className="sr-support-view">
      <div className="sr-resources-split">
        {/* Support Directory */}
        <div className="sr-resources-left">
          <h2 className="sr-resources-h2">Wellness Support</h2>
          <p style={{ margin: "0 0 20px", color: "var(--ink-soft)", fontSize: 14 }}>
            Access clinical resources, explore tips on self-care, or review answers regarding your voice biometrics assessments.
          </p>

          {/* FAQs */}
          <div className="sr-faq-list" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 16, margin: "10px 0 0", color: "#000" }}>Frequently Asked Questions</h3>
            {FAQ.map((item, idx) => (
              <div 
                key={idx} 
                className="sr-faq-item" 
                style={{ 
                  background: "var(--glass)", 
                  border: "1px solid var(--glass-border)", 
                  borderRadius: 16, 
                  padding: 16 
                }}
              >
                <h4 style={{ margin: "0 0 6px", fontSize: 14.5, color: "var(--accent-ink)", fontWeight: 600 }}>{item.q}</h4>
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Crisis Support Card on Right */}
        <div className="sr-resources-right">
          <div className="sr-crisis-card" style={{ border: "1px solid rgba(231,76,60,0.2)" }}>
            <div className="sr-crisis-header">
              <AlertTriangle size={18} className="sr-red-icon" />
              <h3>Direct Assistance</h3>
            </div>
            <p>If you or someone you know is struggling or in distress, help is available. Speak anonymously with a trained counselor.</p>
            
            <div className="sr-crisis-actions">
              <button 
                className="sr-crisis-btn sr-crisis-btn--primary"
                onClick={() => onOpenModal("hotlines")}
                style={{ width: "100%" }}
              >
                <Phone size={15} />
                <span>Call Hotline Now</span>
              </button>
              
              <button 
                className="sr-crisis-btn sr-crisis-btn--secondary"
                onClick={() => onOpenModal("chat")}
                style={{ width: "100%", marginTop: 8 }}
              >
                <MessageSquare size={15} />
                <span>Chat Anonymously</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
