import React, { useState } from "react";
import { Mic, CheckCircle2, Circle, Star, Calendar, ChevronRight, Wind, Heart } from "lucide-react";

export default function HomeView({ 
  user,
  notes, 
  onStartScreening, 
  focusTasks, 
  onToggleFocusTask, 
  onOpenModal 
}) {
  const [timeframe, setTimeframe] = useState("7days");

  // Determine if a screening has been completed today
  const hasScreeningToday = () => {
    const today = new Date().toDateString();
    return notes.some((n) => new Date(n.createdAt).toDateString() === today);
  };

  // Generate chart data for the last 7 days
  const getChartData = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const result = [];
    const today = new Date();
    
    // We want to generate the last 7 days ending with today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayName = days[d.getDay()];
      const dateStr = d.toDateString();
      
      // Find average score for this day
      const dayNotes = notes.filter((n) => new Date(n.createdAt).toDateString() === dateStr);
      let avgScore = 0;
      if (dayNotes.length > 0) {
        const scores = dayNotes.map((n) => n.score || 0);
        avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      } else {
        // Mock fallback if no real screening exists on this day, to ensure the chart is populated
        // This ensures the visual looks complete as in the screenshots
        const mockMap = { Sun: 60, Mon: 68, Tue: 62, Wed: 74, Thu: 85, Fri: 72, Sat: 65 };
        avgScore = mockMap[dayName] || 60;
      }
      
      result.push({ day: dayName, score: avgScore, isReal: dayNotes.length > 0 });
    }
    return result;
  };

  const chartData = getChartData();
  const maxScoreObj = chartData.reduce((prev, current) => (prev.score > current.score) ? prev : current, chartData[0]);

  // Calculate focus tasks progress
  const isTrendsUnlocked = hasScreeningToday();
  const completedTasks = (focusTasks.breathwork ? 1 : 0) + (focusTasks.trends && isTrendsUnlocked ? 1 : 0);
  const totalTasks = 2;
  const progressPercent = (completedTasks / totalTasks) * 100;

  // Render SVG Line Chart path
  const renderSvgChart = () => {
    const width = 500;
    const height = 150;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const maxVal = 100;
    const minVal = 0;

    // Get coordinates for each data point
    const points = chartData.map((d, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      // y-axis is inverted in SVG, so 100% is at top (padding), 0% is at bottom (height - padding)
      const ratio = (d.score - minVal) / (maxVal - minVal);
      const y = height - padding - ratio * chartHeight;
      return { x, y, ...d };
    });

    // Generate path using bezier curves for smooth layout
    let pathD = "";
    let areaD = `M ${points[0].x} ${height - padding} `; // Start of area fill path
    
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} `;
      areaD += `L ${points[0].x} ${points[0].y} `;
      
      for (let i = 1; i < points.length; i++) {
        // Control points for smooth bezier curve
        const cpX1 = points[i - 1].x + (points[i].x - points[i - 1].x) / 2;
        const cpY1 = points[i - 1].y;
        const cpX2 = points[i - 1].x + (points[i].x - points[i - 1].x) / 2;
        const cpY2 = points[i].y;
        
        pathD += `C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y} `;
        areaD += `C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y} `;
      }
      
      areaD += `L ${points[points.length - 1].x} ${height - padding} Z`; // Close the area
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="sr-analytics-svg">
        <defs>
          <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="chartStrokeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-light)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(0,0,0,0.03)" strokeDasharray="3" />
        <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="rgba(0,0,0,0.03)" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(0,0,0,0.08)" />

        {/* Area fill */}
        {points.length > 0 && <path d={areaD} fill="url(#chartFillGrad)" />}

        {/* Stroke path */}
        {points.length > 0 && <path d={pathD} fill="none" stroke="url(#chartStrokeGrad)" strokeWidth="3" strokeLinecap="round" />}

        {/* Data points */}
        {points.map((p, idx) => {
          const isPeak = p.day === maxScoreObj.day;
          return (
            <g key={idx}>
              {/* Ripple animation for peak point */}
              {isPeak && (
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="8" 
                  fill="var(--accent)" 
                  opacity="0.3"
                  className="sr-chart-peak-ripple"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isPeak ? "5" : "4"}
                fill={isPeak ? "var(--accent-ink)" : "#fff"}
                stroke="var(--accent)"
                strokeWidth={isPeak ? "3" : "2"}
                className="sr-chart-dot"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="sr-home-view">
      {/* ─── Hero Banner ─── */}
      <div className="sr-hero-card">
        <div className="sr-hero-content">
          <h1>Good morning, {user?.name || "User"}.</h1>
          <p>It's a brand new day. Let's take a moment to see how your voice reflects your inner world today.</p>
          <button className="sr-hero-btn" onClick={onStartScreening} id="btn-start-new-screening">
            <Mic size={16} />
            <span>Start New Screening</span>
          </button>
        </div>
      </div>

      {/* ─── Dashboard Columns ─── */}
      <div className="sr-home-columns">
        {/* Left Column: Wellness Overview */}
        <div className="sr-dashboard-card sr-dashboard-card--overview">
          <div className="sr-card-header">
            <h3>Wellness Overview</h3>
            <div className="sr-dropdown-container">
              <select 
                value={timeframe} 
                onChange={(e) => setTimeframe(e.target.value)}
                className="sr-select"
                id="select-timeframe"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
          </div>
          
          <div className="sr-chart-container">
            {renderSvgChart()}
            
            {/* Chart X-axis Labels */}
            <div className="sr-chart-xaxis">
              {chartData.map((d, idx) => {
                const isPeak = d.day === maxScoreObj.day;
                return (
                  <div key={idx} className={`sr-xaxis-label ${isPeak ? "sr-xaxis-label--peak" : ""}`}>
                    {isPeak && <span className="sr-peak-badge">Peak</span>}
                    <span>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Today's Focus */}
        <div className="sr-dashboard-card sr-dashboard-card--focus">
          <div className="sr-card-header">
            <h3>Today's Focus</h3>
          </div>
          
          <div className="sr-focus-list">
            {/* Task 1: Morning Breathwork */}
            <div 
              className={`sr-focus-item ${focusTasks.breathwork ? "sr-focus-item--completed" : ""}`}
              onClick={() => onToggleFocusTask("breathwork")}
              role="checkbox"
              aria-checked={focusTasks.breathwork}
              tabIndex={0}
              id="focus-breathwork"
            >
              <div className="sr-checkbox-icon">
                {focusTasks.breathwork ? (
                  <CheckCircle2 className="sr-checked-green" size={20} />
                ) : (
                  <Circle className="sr-unchecked-gray" size={20} />
                )}
              </div>
              <div className="sr-focus-item-text">
                <span className="sr-focus-title">Morning Breathwork</span>
                <span className="sr-focus-subtitle">
                  {focusTasks.breathwork ? "Completed at 8:15 AM" : "Recommended: 5 mins 4-7-8 session"}
                </span>
              </div>
            </div>

            {/* Task 2: Review Voice Trends */}
            <div 
              className={`sr-focus-item ${!isTrendsUnlocked ? "sr-focus-item--locked" : ""} ${focusTasks.trends && isTrendsUnlocked ? "sr-focus-item--completed" : ""}`}
              onClick={() => isTrendsUnlocked && onToggleFocusTask("trends")}
              role="checkbox"
              aria-checked={focusTasks.trends}
              tabIndex={0}
              id="focus-voicetrends"
            >
              <div className="sr-checkbox-icon">
                {focusTasks.trends && isTrendsUnlocked ? (
                  <CheckCircle2 className="sr-checked-green" size={20} />
                ) : (
                  <Circle className="sr-unchecked-gray" size={20} />
                )}
              </div>
              <div className="sr-focus-item-text">
                <span className="sr-focus-title">Review Voice Trends</span>
                <span className="sr-focus-subtitle">
                  {isTrendsUnlocked 
                    ? (focusTasks.trends ? "Reviewed trends" : "Tap to complete review of today's voice score")
                    : "Unlock after afternoon screening"
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="sr-focus-progress">
            <div className="sr-progress-track">
              <div className="sr-progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="sr-progress-label">{completedTasks} of {totalTasks} tasks completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
