import React, { useState, useRef, useEffect } from "react";
import { Search, HelpCircle, User, LogOut, ChevronDown } from "lucide-react";

export default function TopBar({ title, searchQuery, onSearchChange, onLogout, user, showSearch }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [dropdownOpen]);

  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";

  return (
    <>
      <style>{`
        /* ─── Profile Dropdown ─── */
        .sr-avatar-wrapper {
          position: relative;
        }
        .sr-avatar-btn-enhanced {
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sr-avatar-btn-enhanced:focus-visible {
          outline: 2px solid #5b9a8b;
          outline-offset: 2px;
          border-radius: 999px;
        }
        .sr-avatar-chevron {
          color: #95a5a6;
          transition: transform 0.2s ease;
        }
        .sr-avatar-chevron--open {
          transform: rotate(180deg);
        }

        /* ─── Dropdown Menu ─── */
        .sr-profile-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 240px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(24px) saturate(1.4);
          -webkit-backdrop-filter: blur(24px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 18px;
          box-shadow: 0 16px 48px -12px rgba(45, 52, 54, 0.18), 0 4px 12px rgba(0,0,0,0.04);
          padding: 6px;
          z-index: 100;
          animation: sr-dropdown-fadeIn 0.2s ease both;
        }

        @keyframes sr-dropdown-fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .sr-dropdown-user-info {
          padding: 14px 16px 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sr-dropdown-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e1eae6;
          color: #3d7a6b;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .sr-dropdown-user-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .sr-dropdown-user-name {
          font-size: 14.5px;
          font-weight: 700;
          color: #2d3436;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sr-dropdown-user-email {
          font-size: 12px;
          color: #636e72;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sr-dropdown-divider {
          height: 1px;
          background: rgba(91, 154, 139, 0.12);
          margin: 2px 12px;
        }

        .sr-dropdown-logout-btn {
          width: 100%;
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 16px;
          border-radius: 12px;
          font-family: 'Outfit', 'Nunito', sans-serif;
          font-size: 13.5px;
          font-weight: 550;
          color: #636e72;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sr-dropdown-logout-btn:hover {
          background: rgba(231, 76, 60, 0.06);
          color: #c0392b;
        }
        .sr-dropdown-logout-btn:focus-visible {
          outline: 2px solid #5b9a8b;
          outline-offset: -2px;
        }
      `}</style>

      <header className="sr-topbar" role="banner">
        {/* Title */}
        <h2 className="sr-topbar-title">{title}</h2>

        {/* Actions */}
        <div className="sr-topbar-actions">
          {/* Search Input */}
          {showSearch && (
            <div className="sr-search-container">
              <Search size={16} className="sr-search-icon" />
              <input
                type="search"
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="sr-search-input"
                aria-label="Search insights and resources"
                id="input-search-insights"
              />
            </div>
          )}

          {/* Help Icon */}
          <button 
            className="sr-iconbtn sr-help-btn" 
            aria-label="Help and documentation"
            title="Help"
          >
            <HelpCircle size={18} />
          </button>

          {/* Profile Avatar with Dropdown */}
          <div className="sr-avatar-wrapper" ref={dropdownRef}>
            <button 
              className="sr-avatar-btn-enhanced" 
              aria-label="User profile menu"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              title={displayName}
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              <div className="sr-avatar">
                <User size={18} />
              </div>
              <ChevronDown 
                size={14} 
                className={`sr-avatar-chevron ${dropdownOpen ? "sr-avatar-chevron--open" : ""}`} 
              />
            </button>

            {dropdownOpen && (
              <div className="sr-profile-dropdown" role="menu">
                <div className="sr-dropdown-user-info">
                  <div className="sr-dropdown-avatar">
                    <User size={18} />
                  </div>
                  <div className="sr-dropdown-user-text">
                    <span className="sr-dropdown-user-name">{displayName}</span>
                    {displayEmail && (
                      <span className="sr-dropdown-user-email">{displayEmail}</span>
                    )}
                  </div>
                </div>

                <div className="sr-dropdown-divider" />

                <button
                  className="sr-dropdown-logout-btn"
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  id="btn-logout"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
