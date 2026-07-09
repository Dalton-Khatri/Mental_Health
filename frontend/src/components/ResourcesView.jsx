import React from "react";
import { FileText, BookOpen, AlertTriangle, Phone, MessageSquare, ChevronRight } from "lucide-react";

export const ARTICLES = [
  {
    id: "article_1",
    title: "Understanding Voice Biometrics",
    subtitle: "How AI decodes micro-changes in speech to identify early signs of emotional distress...",
    icon: <FileText size={20} />,
    content: `Voice biometrics is a technology that uses vocal characteristics to identify individuals and assess their physiological or emotional states. Unlike standard speech recognition, which focuses on what is said, voice biometrics analyzes how it is said.

Our voice carries subtle features like pitch, jitter (frequency variations), shimmer (amplitude variations), and tempo. When we experience emotional distress, stress, or depression, our autonomic nervous system alters our vocal cord tension and breathing patterns. These microscopic changes are often imperceptible to the human ear, but AI models trained on clinical datasets (like DAIC-WOZ) can recognize these patterns.

By tracking your voice patterns over time, SerenityScreen builds a personalized emotional baseline. This allows it to detect early markers of high stress or mood shifts, giving you proactive insights into your wellness.`
  },
  {
    id: "article_2",
    title: "The Habit of Mindfulness",
    subtitle: "Daily routines to keep your emotional baseline stable and resilient in stressful times.",
    icon: <BookOpen size={20} />,
    content: `Mindfulness is the practice of maintaining a non-judgmental state of heightened or complete awareness of one's thoughts, emotions, or experiences on a moment-to-moment basis.

In today's fast-paced world, our brains are constantly in a state of high alert (the sympathetic nervous system's fight-or-flight response). Creating a daily mindfulness habit—even for just 5 minutes—helps trigger the parasympathetic nervous system, lowering heart rate, blood pressure, and cortisol levels.

Simple daily routines like 4-7-8 breathing, sensory grounding (5-4-3-2-1), or a body scan can significantly improve emotional resilience. The key is consistency. By checking in with your voice and practicing these exercises daily, you build a mental reserve that helps you stay grounded when stressful situations arise.`
  }
];

export default function ResourcesView({ onOpenModal, searchQuery }) {
  // Filter articles based on top search bar query
  const filteredArticles = ARTICLES.filter((art) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      art.title.toLowerCase().includes(query) ||
      art.subtitle.toLowerCase().includes(query) ||
      art.content.toLowerCase().includes(query)
    );
  });

  return (
    <div className="sr-resources-view">
      <div className="sr-resources-split">
        {/* Left Column: Articles */}
        <div className="sr-resources-left">
          <h2 className="sr-resources-h2">Knowledge Library</h2>
          <div className="sr-resources-list">
            {filteredArticles.length === 0 ? (
              <div className="sr-resources-empty">
                <p>No articles found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredArticles.map((art) => (
                <div 
                  key={art.id} 
                  className="sr-resource-card"
                  onClick={() => onOpenModal(art.id)}
                  role="button"
                  tabIndex={0}
                  id={`card-${art.id}`}
                >
                  <div className="sr-resource-icon">
                    {art.icon}
                  </div>
                  <div className="sr-resource-info">
                    <h3>{art.title}</h3>
                    <p>{art.subtitle}</p>
                  </div>
                  <ChevronRight size={18} className="sr-card-arrow" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Crisis Support */}
        <div className="sr-resources-right">
          <div className="sr-crisis-card">
            <div className="sr-crisis-header">
              <AlertTriangle size={18} className="sr-red-icon" />
              <h3>Crisis Support</h3>
            </div>
            <p>If you are in immediate danger or need someone to talk to right now, help is available 24/7.</p>
            
            <div className="sr-crisis-actions">
              <button 
                className="sr-crisis-btn sr-crisis-btn--primary"
                onClick={() => onOpenModal("hotlines")}
                id="btn-call-hotline"
              >
                <Phone size={15} />
                <span>Call Hotline Now</span>
              </button>
              
              <button 
                className="sr-crisis-btn sr-crisis-btn--secondary"
                onClick={() => onOpenModal("chat")}
                id="btn-chat-anonymous"
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
