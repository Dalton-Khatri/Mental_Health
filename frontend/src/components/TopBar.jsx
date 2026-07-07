import React from "react";
import { Search, HelpCircle, User } from "lucide-react";

export default function TopBar({ title, searchQuery, onSearchChange }) {
  return (
    <header className="sr-topbar" role="banner">
      {/* Title */}
      <h2 className="sr-topbar-title">{title}</h2>

      {/* Actions */}
      <div className="sr-topbar-actions">
        {/* Search Input */}
        <div className="sr-search-container">
          <Search size={16} className="sr-search-icon" />
          <input
            type="search"
            placeholder="Search insights..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="sr-search-input"
            aria-label="Search insights and resources"
            id="input-search-insights"
          />
        </div>

        {/* Help Icon */}
        <button 
          className="sr-iconbtn sr-help-btn" 
          aria-label="Help and documentation"
          title="Help"
        >
          <HelpCircle size={18} />
        </button>

        {/* Profile Avatar */}
        <button 
          className="sr-avatar-btn" 
          aria-label="User profile settings"
          title="Alex Profile"
        >
          <div className="sr-avatar">
            <User size={18} />
          </div>
        </button>
      </div>
    </header>
  );
}
