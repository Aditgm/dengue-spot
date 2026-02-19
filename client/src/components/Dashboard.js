import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/axiosConfig';
import './Dashboard.css';

function Dashboard({ user, isAuthenticated, onLoginClick, onClose, isFullscreen, onToggleFullscreen }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = React.useRef(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/auth/dashboard');
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      // Build fallback from local data
      setProfile({
        user: user || { name: 'Guest', email: '' },
        stats: { totalReports: 0, totalScans: 0, checklistStreak: 0, currentWeekProgress: 0 },
        reports: [],
        badges: [],
        checklistHistory: [],
        leaderboardRank: null
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchProfile]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB');
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await apiClient.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        // Update local profile + localStorage user
        setProfile(prev => ({
          ...prev,
          user: { ...prev.user, avatar: res.data.avatar }
        }));
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.avatar = res.data.avatar;
        localStorage.setItem('user', JSON.stringify(storedUser));
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-login-prompt">
          {onClose && (
            <button className="dashboard-close-btn" onClick={onClose} title="Close">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          )}
          <div className="prompt-orbs">
            <div className="prompt-orb prompt-orb-1"></div>
            <div className="prompt-orb prompt-orb-2"></div>
          </div>
          <div className="prompt-content">
            <span className="prompt-icon">🔒</span>
            <h2>Sign In to View Your Dashboard</h2>
            <p>Track your reports, earn badges, and see your checklist streaks</p>
            <button className="prompt-login-btn" onClick={onLoginClick}>
              Sign In / Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="dashboard-loading">
            <div className="loading-spinner"></div>
            <p>Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const { stats = {}, reports = [], checklistHistory = [], leaderboardRank } = profile || {};
  const displayUser = profile?.user || user || { name: 'User', email: '' };

  const badgeDefinitions = [
    { id: 'first_report', name: 'First Report', icon: '🎯', desc: 'Submit your first hotspot report', threshold: 1, field: 'totalReports' },
    { id: 'bronze', name: 'Bronze Reporter', icon: '🥉', desc: 'Submit 2+ hotspot reports', threshold: 2, field: 'totalReports' },
    { id: 'silver', name: 'Silver Reporter', icon: '🥈', desc: 'Submit 5+ hotspot reports', threshold: 5, field: 'totalReports' },
    { id: 'gold', name: 'Gold Reporter', icon: '🥇', desc: 'Submit 10+ hotspot reports', threshold: 10, field: 'totalReports' },
    { id: 'platinum', name: 'Platinum Reporter', icon: '💎', desc: 'Submit 20+ hotspot reports', threshold: 20, field: 'totalReports' },
    { id: 'streak_3', name: '3-Week Streak', icon: '🔥', desc: 'Complete checklist 3 weeks in a row', threshold: 3, field: 'checklistStreak' },
    { id: 'streak_8', name: '8-Week Streak', icon: '⚡', desc: 'Complete checklist 8 weeks in a row', threshold: 8, field: 'checklistStreak' },
    { id: 'scanner', name: 'Active Scanner', icon: '📸', desc: 'Scan 5+ images for breeding sites', threshold: 5, field: 'totalScans' },
  ];

  const earnedBadges = badgeDefinitions.filter(b => (stats[b.field] || 0) >= b.threshold);
  const nextBadges = badgeDefinitions.filter(b => (stats[b.field] || 0) < b.threshold);

  const getInitials = (name) => {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">

        {/* Panel Controls */}
        <div className="dashboard-panel-controls">
          {onToggleFullscreen && (
            <button className="dashboard-expand-btn" onClick={onToggleFullscreen} title={isFullscreen ? 'Collapse' : 'Expand'}>
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zm10 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
                </svg>
              )}
            </button>
          )}
          {onClose && (
            <button className="dashboard-close-btn" onClick={onClose} title="Close">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Profile Hero */}
        <div className="profile-hero">
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="profile-hero-content">
            <div className="avatar-section">
              <div className="avatar-wrapper" onClick={() => avatarInputRef.current?.click()}>
                {displayUser.avatar ? (
                  <img src={displayUser.avatar} alt="Avatar" className="user-avatar" />
                ) : (
                  <div className="user-avatar-placeholder">
                    {getInitials(displayUser.name)}
                  </div>
                )}
                <div className="avatar-upload-overlay">
                  {avatarUploading ? (
                    <div className="avatar-spinner"></div>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <div className="user-info">
                <h2 className="user-name">{displayUser.name}</h2>
                <p className="user-email">{displayUser.email}</p>
                {leaderboardRank && (
                  <span className="rank-badge">🏆 Rank #{leaderboardRank}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">📍</span>
            <span className="stat-value">{stats.totalReports || 0}</span>
            <span className="stat-name">Reports</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📸</span>
            <span className="stat-value">{stats.totalScans || 0}</span>
            <span className="stat-name">Scans</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🔥</span>
            <span className="stat-value">{stats.checklistStreak || 0}</span>
            <span className="stat-name">Week Streak</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🏅</span>
            <span className="stat-value">{earnedBadges.length}</span>
            <span className="stat-name">Badges</span>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="section-tabs">
          <button className={activeSection === 'overview' ? 'active' : ''} onClick={() => setActiveSection('overview')}>Overview</button>
          <button className={activeSection === 'badges' ? 'active' : ''} onClick={() => setActiveSection('badges')}>Badges</button>
          <button className={activeSection === 'reports' ? 'active' : ''} onClick={() => setActiveSection('reports')}>Reports</button>
          <button className={activeSection === 'streaks' ? 'active' : ''} onClick={() => setActiveSection('streaks')}>Streaks</button>
        </div>

        {/* Section Content */}
        <div className="section-content">

          {/* Overview */}
          {activeSection === 'overview' && (
            <div className="overview-section">
              {/* Current Week Progress */}
              <div className="overview-block">
                <h3 className="block-title">📋 This Week's Checklist</h3>
                <div className="week-progress-bar">
                  <div className="week-progress-fill" style={{ width: `${stats.currentWeekProgress || 0}%` }}></div>
                </div>
                <p className="week-progress-text">{Math.round(stats.currentWeekProgress || 0)}% complete</p>
              </div>

              {/* Recent Activity */}
              <div className="overview-block">
                <h3 className="block-title">⚡ Recent Activity</h3>
                {reports.length === 0 && (
                  <p className="empty-state">No reports yet. Start by scanning an image or reporting a hotspot!</p>
                )}
                {reports.slice(0, 3).map((report, i) => (
                  <div key={i} className="activity-item">
                    <span className="activity-icon">{report.riskLevel === 'high' ? '🔴' : report.riskLevel === 'medium' ? '🟡' : '🟢'}</span>
                    <div className="activity-info">
                      <span className="activity-desc">{report.description || 'Hotspot reported'}</span>
                      <span className="activity-time">{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Next Badge */}
              {nextBadges.length > 0 && (
                <div className="overview-block">
                  <h3 className="block-title">🎯 Next Badge</h3>
                  <div className="next-badge-card">
                    <span className="next-badge-icon">{nextBadges[0].icon}</span>
                    <div className="next-badge-info">
                      <span className="next-badge-name">{nextBadges[0].name}</span>
                      <span className="next-badge-desc">{nextBadges[0].desc}</span>
                      <div className="next-badge-progress-bar">
                        <div className="next-badge-progress-fill" style={{
                          width: `${Math.min(100, ((stats[nextBadges[0].field] || 0) / nextBadges[0].threshold) * 100)}%`
                        }}></div>
                      </div>
                      <span className="next-badge-count">{stats[nextBadges[0].field] || 0} / {nextBadges[0].threshold}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Badges */}
          {activeSection === 'badges' && (
            <div className="badges-section">
              <h3 className="block-title">🏅 Earned Badges ({earnedBadges.length})</h3>
              {earnedBadges.length === 0 ? (
                <p className="empty-state">No badges earned yet. Keep reporting hotspots and completing checklists!</p>
              ) : (
                <div className="badges-grid">
                  {earnedBadges.map(badge => (
                    <div key={badge.id} className="badge-card earned">
                      <span className="badge-icon">{badge.icon}</span>
                      <span className="badge-name">{badge.name}</span>
                      <span className="badge-desc">{badge.desc}</span>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="block-title" style={{ marginTop: '24px' }}>🔒 Locked Badges ({nextBadges.length})</h3>
              <div className="badges-grid">
                {nextBadges.map(badge => (
                  <div key={badge.id} className="badge-card locked">
                    <span className="badge-icon">{badge.icon}</span>
                    <span className="badge-name">{badge.name}</span>
                    <span className="badge-desc">{badge.desc}</span>
                    <div className="badge-progress-bar">
                      <div className="badge-progress-fill" style={{
                        width: `${Math.min(100, ((stats[badge.field] || 0) / badge.threshold) * 100)}%`
                      }}></div>
                    </div>
                    <span className="badge-progress-text">{stats[badge.field] || 0} / {badge.threshold}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports History */}
          {activeSection === 'reports' && (
            <div className="reports-section">
              <h3 className="block-title">📍 Your Reports ({reports.length})</h3>
              {reports.length === 0 ? (
                <p className="empty-state">You haven't submitted any reports yet. Report a hotspot to see it here!</p>
              ) : (
                <div className="reports-list">
                  {reports.map((report, i) => (
                    <div key={i} className="report-item" style={{ '--delay': `${i * 50}ms` }}>
                      <div className="report-risk-indicator" data-risk={report.riskLevel}></div>
                      <div className="report-details">
                        <span className="report-desc">{report.description || 'Hotspot Report'}</span>
                        <div className="report-meta">
                          <span className="report-risk-label">{report.riskLevel || 'medium'} risk</span>
                          <span className="report-date">{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={`report-status ${report.status}`}>{report.status || 'reported'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Streaks */}
          {activeSection === 'streaks' && (
            <div className="streaks-section">
              <h3 className="block-title">🔥 Checklist Streaks</h3>
              <div className="streak-hero">
                <div className="streak-number">{stats.checklistStreak || 0}</div>
                <div className="streak-label">Week Streak</div>
              </div>
              
              <h3 className="block-title" style={{ marginTop: '24px' }}>📅 Checklist History</h3>
              {checklistHistory.length === 0 ? (
                <p className="empty-state">No checklist history yet. Complete your weekly checklist to build a streak!</p>
              ) : (
                <div className="streak-grid">
                  {checklistHistory.map((week, i) => (
                    <div key={i} className={`streak-week ${week.completed ? 'completed' : 'missed'}`}>
                      <span className="streak-week-num">W{week.week}</span>
                      <span className="streak-week-icon">{week.completed ? '✅' : '⬜'}</span>
                      <span className="streak-week-pct">{Math.round(week.progress || 0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
