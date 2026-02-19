import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/axiosConfig';
import './Leaderboard.css';

function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [timeframe, setTimeframe] = useState('allTime'); // allTime, monthly, weekly
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch leaderboard (can be called from other handlers as well)
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/leaderboard`, {
        params: { timeframe }
      });
      const data = res.data.reporters || [];
      setLeaderboardData(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err.message || err);
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe, fetchLeaderboard]);

  // Listen for manual refresh events (e.g., after reporting a hotspot)
  useEffect(() => {
    const onUpdate = () => fetchLeaderboard();
    window.addEventListener('leaderboardUpdated', onUpdate);
    return () => window.removeEventListener('leaderboardUpdated', onUpdate);
  }, [fetchLeaderboard]);

  const getBadgeEmoji = (badge) => {
    switch (badge) {
      case 'gold':
        return '🥇';
      case 'silver':
        return '🥈';
      case 'bronze':
        return '🥉';
      default:
        return '⭐';
    }
  };

  const getRankColor = (index) => {
    if (index === 0) return '#FFD700'; // Gold
    if (index === 1) return '#B0C4DE'; // Light Steel Blue (readable silver)
    if (index === 2) return '#CD7F32'; // Bronze
    return '#48cae4'; // Cyan for others
  };

  const getNameColor = (index) => {
    if (index === 0) return '#FFD700'; // Gold
    if (index === 1) return '#cdd9e5'; // Soft silver-white
    if (index === 2) return '#e8a862'; // Warm bronze-gold
    return '#e0f0ff'; // Light sky white for the rest
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h2>🏆 Hotspot Reporters Leaderboard</h2>
        <p className="subtitle">Top reporters in your community</p>
      </div>

      {/* Timeframe Filter */}
      <div className="timeframe-filter">
        <button
          className={`filter-btn ${timeframe === 'weekly' ? 'active' : ''}`}
          onClick={() => setTimeframe('weekly')}
        >
          This Week
        </button>
        <button
          className={`filter-btn ${timeframe === 'monthly' ? 'active' : ''}`}
          onClick={() => setTimeframe('monthly')}
        >
          This Month
        </button>
        <button
          className={`filter-btn ${timeframe === 'allTime' ? 'active' : ''}`}
          onClick={() => setTimeframe('allTime')}
        >
          All Time
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-table">
        {loading ? (
          <div className="empty-state">⏳ Loading leaderboard...</div>
        ) : error ? (
          <div className="empty-state">{error}</div>
        ) : leaderboardData.length > 0 ? (
          leaderboardData.map((user, index) => (
            <div
              key={user.id}
              className={`leaderboard-row ${index < 3 ? 'top-three' : ''}`}
              style={{ borderLeftColor: getRankColor(index) }}
            >
              {/* Rank */}
              <div className="rank-badge" style={{ backgroundColor: getRankColor(index) }}>
                {index < 3 ? getBadgeEmoji(user.badge) : `#${index + 1}`}
              </div>

              {/* User Info */}
              <div className="user-info">
                <div className="user-name" style={{ color: getNameColor(index) }}>
                  {user.name}
                  {user.verified && <span className="verified-badge">✓</span>}
                </div>
                <div className="user-meta">
                  {user.reports > 0 ? (
                    <span className="reports-count">
                      📍 {user.reports} {user.reports === 1 ? 'report' : 'reports'}
                    </span>
                  ) : (
                    <span className="no-reports">No reports yet</span>
                  )}
                </div>
              </div>

              {/* Reports */}
              <div className="reports-display">
                <span className="report-number">{user.reports}</span>
                <span className="report-label">
                  {user.reports === 1 ? 'Report' : 'Reports'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${(user.reports / 5) * 100}%`,
                    backgroundColor: getRankColor(index),
                  }}
                ></div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No leaderboard data available</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="leaderboard-stats">
        <div className="stat-card">
          <div className="stat-number">{leaderboardData.reduce((sum, u) => sum + u.reports, 0)}</div>
          <div className="stat-label">Total Reports</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{leaderboardData.length}</div>
          <div className="stat-label">Active Reporters</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {leaderboardData.length > 0
              ? (leaderboardData.reduce((sum, u) => sum + u.reports, 0) / leaderboardData.length).toFixed(1)
              : 0}
          </div>
          <div className="stat-label">Avg Reports</div>
        </div>
      </div>

      {/* Community Contribution Info */}
      <div className="contribution-info">
        <h3>💡 How to Join the Leaderboard</h3>
        <ul>
          <li>📍 Report a dengue hotspot on the map</li>
          <li>📝 Provide details about the breeding site</li>
          <li>✅ Get verified by local authorities</li>
          <li>🏆 Climb the leaderboard and earn badges</li>
        </ul>
      </div>
    </div>
  );
}

export default Leaderboard;
