import React, { useState } from "react";
import { Home, AudioLines, Sparkles, BookOpen, Heart, Wind, MessageSquare } from "lucide-react";
import ChatSidebar from "./ChatSidebar";
import "./Sidebar.css";

export default function Sidebar({ currentTab, onTabSelect, onOpenBreathing }) {
  const [showChat, setShowChat] = useState(false);

  const navItems = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "conversation", label: "Voice Reflection", icon: <MessageSquare size={18} /> },
    { id: "insights", label: "Voice Insights", icon: <AudioLines size={18} /> },
    { id: "activities", label: "Activities", icon: <Sparkles size={18} /> },
    { id: "resources", label: "Resources", icon: <BookOpen size={18} /> }
  ];

  return (
    <aside className="sr-sidebar" aria-label="Sidebar Navigation">
      {/* Brand logo */}
      <div className="sr-sidebar-brand" onClick={() => onTabSelect("home")} role="banner">
        <div className="sr-sidebar-brand-icon">
          <Heart size={18} fill="#fff" stroke="none" />
        </div>
        <div className="sr-sidebar-brand-text">
          <span className="sr-brand-name">Lucid</span>
          <span className="sr-brand-tagline">Your Wellness Companion</span>
        </div>

        {/* Navigation list */}
        <nav className="sr-sidebar-nav" aria-label="Main Navigation">
          <ul>
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    className={`sr-sidebar-link ${isActive ? "sr-sidebar-link--active" : ""}`}
                    onClick={() => onTabSelect(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    id={`nav-link-${item.id}`}
                  >
                    <span className="sr-sidebar-link-icon">{item.icon}</span>
                    <span className="sr-sidebar-link-label">{item.label}</span>
                    {isActive && <div className="sr-active-indicator" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Capsule Start Breathing Button */}
        <div className="sr-sidebar-footer">
          <button 
            className="sr-capsule-btn" 
            onClick={onOpenBreathing}
            aria-label="Start breathing exercise"
            id="btn-start-breathing"
          >
            <Wind size={16} />
            <span>Start Breathing</span>
          </button>
          {/* Chat toggle button */}
          <button 
            className="sr-capsule-btn" 
            onClick={() => setShowChat(true)}
            aria-label="Open mental‑health chat"
            id="btn-open-chat"
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>
        </div>
      </aside>
      {/* ChatSidebar overlay */}
      {showChat && (
        <ChatSidebar user={null} onClose={() => setShowChat(false)} />
      )}
    </>
  );
}
