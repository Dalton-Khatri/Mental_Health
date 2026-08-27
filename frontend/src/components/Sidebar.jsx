import React, { useState, useEffect } from "react";
import { Home, AudioLines, Sparkles, BookOpen, Wind, MessageSquare, Menu, X } from "lucide-react";
import ChatSidebar from "./ChatSidebar";
import "./Sidebar.css";

export default function Sidebar({ currentTab, onTabSelect, onOpenBreathing }) {
  const [showChat, setShowChat] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [currentTab]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navItems = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "conversation", label: "Voice Reflection", icon: <MessageSquare size={18} /> },
    { id: "insights", label: "Voice Insights", icon: <AudioLines size={18} /> },
    { id: "activities", label: "Activities", icon: <Sparkles size={18} /> },
    { id: "resources", label: "Resources", icon: <BookOpen size={18} /> }
  ];

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="sr-mobile-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        id="btn-mobile-menu"
      >
        <Menu size={24} />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="sr-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sr-sidebar ${mobileOpen ? "sr-sidebar--open" : ""}`} aria-label="Sidebar Navigation">
        {/* Mobile close button */}
        <button
          className="sr-mobile-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        >
          <X size={20} />
        </button>

        {/* Brand logo */}
        <div className="sr-sidebar-brand" onClick={() => onTabSelect("home")} role="banner">
          <img src="/logo.png" alt="Lucid" className="sr-sidebar-logo" />
          <div className="sr-sidebar-brand-text">
            <span className="sr-brand-name">Lucid</span>
            <span className="sr-brand-tagline">Your Wellness Companion</span>
          </div>
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

        {/* Footer buttons */}
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
