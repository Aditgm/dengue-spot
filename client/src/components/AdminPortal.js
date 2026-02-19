import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/axiosConfig';
import './AdminPortal.css';

function AdminPortal({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [users, setUsers] = useState([]);
  const [reporters, setReporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [hotspotFilter, setHotspotFilter] = useState({ status: '', risk: '' });
  const [hotspotPage, setHotspotPage] = useState(1);
  const [hotspotPagination, setHotspotPagination] = useState({});
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({});
  const [lightboxImage, setLightboxImage] = useState(null);
  const [bannedIps, setBannedIps] = useState([]);
  const [banIpInput, setBanIpInput] = useState('');
  const [banIpReason, setBanIpReason] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch admin stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/stats');
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Fetch hotspots
  const fetchHotspots = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', hotspotPage);
      params.append('limit', 15);
      if (hotspotFilter.status) params.append('status', hotspotFilter.status);
      if (hotspotFilter.risk) params.append('risk', hotspotFilter.risk);

      const res = await apiClient.get(`/admin/hotspots?${params}`);
      setHotspots(res.data.hotspots);
      setHotspotPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch hotspots:', err);
    }
  }, [hotspotPage, hotspotFilter]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', userPage);
      params.append('limit', 15);
      if (userSearch) params.append('search', userSearch);

      const res = await apiClient.get(`/admin/users?${params}`);
      setUsers(res.data.users);
      setUserPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [userPage, userSearch]);

  // Fetch reporters
  const fetchReporters = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/reporters');
      setReporters(res.data.reporters);
    } catch (err) {
      console.error('Failed to fetch reporters:', err);
    }
  }, []);

  // Fetch banned IPs
  const fetchBannedIps = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/banned-ips');
      setBannedIps(res.data.bannedIps);
    } catch (err) {
      console.error('Failed to fetch banned IPs:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStats();
      setLoading(false);
    };
    loadData();
  }, [fetchStats]);

  useEffect(() => {
    if (activeSection === 'hotspots') fetchHotspots();
  }, [activeSection, fetchHotspots]);

  useEffect(() => {
    if (activeSection === 'users') fetchUsers();
  }, [activeSection, fetchUsers]);

  useEffect(() => {
    if (activeSection === 'reporters') fetchReporters();
  }, [activeSection, fetchReporters]);

  useEffect(() => {
    if (activeSection === 'ipbans') fetchBannedIps();
  }, [activeSection, fetchBannedIps]);

  // Actions
  const updateHotspotStatus = async (id, status) => {
    try {
      await apiClient.patch(`/admin/hotspots/${id}`, { status });
      showToast(`Hotspot marked as ${status}`);
      fetchHotspots();
      fetchStats();
    } catch (err) {
      showToast('Failed to update hotspot', 'error');
    }
  };

  const deleteHotspot = async (id) => {
    if (!window.confirm('Delete this hotspot report?')) return;
    try {
      await apiClient.delete(`/admin/hotspots/${id}`);
      showToast('Hotspot deleted');
      fetchHotspots();
      fetchStats();
    } catch (err) {
      showToast('Failed to delete hotspot', 'error');
    }
  };

  const updateUserRole = async (id, role) => {
    try {
      await apiClient.patch(`/admin/users/${id}/role`, { role });
      showToast(`User role updated to ${role}`);
      fetchUsers();
      fetchStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update role', 'error');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/admin/users/${id}`);
      showToast('User deleted');
      fetchUsers();
      fetchStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const banUserIp = async (userId, userName) => {
    if (!window.confirm(`Ban the IP address of ${userName}? They will not be able to access the app.`)) return;
    try {
      await apiClient.post(`/admin/ban-user-ip/${userId}`, { reason: `Admin banned user: ${userName}` });
      showToast(`IP of ${userName} has been banned`);
      fetchBannedIps();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to ban IP', 'error');
    }
  };

  const banUser = async (userId, userName) => {
    const reason = window.prompt(`Ban user "${userName}"? Enter reason:`, 'Violation of terms');
    if (reason === null) return; // cancelled
    try {
      await apiClient.patch(`/admin/users/${userId}/ban`, { reason: reason || 'Banned by admin' });
      showToast(`${userName} has been banned`);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to ban user', 'error');
    }
  };

  const unbanUser = async (userId, userName) => {
    if (!window.confirm(`Unban user "${userName}"?`)) return;
    try {
      await apiClient.patch(`/admin/users/${userId}/unban`);
      showToast(`${userName} has been unbanned`);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to unban user', 'error');
    }
  };

  const banManualIp = async () => {
    if (!banIpInput.trim()) return;
    try {
      await apiClient.post('/admin/ban-ip', { ip: banIpInput.trim(), reason: banIpReason || 'Manual ban' });
      showToast(`IP ${banIpInput} banned`);
      setBanIpInput('');
      setBanIpReason('');
      fetchBannedIps();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to ban IP', 'error');
    }
  };

  const unbanIp = async (id) => {
    if (!window.confirm('Unban this IP address?')) return;
    try {
      await apiClient.delete(`/admin/banned-ips/${id}`);
      showToast('IP unbanned');
      fetchBannedIps();
    } catch (err) {
      showToast('Failed to unban IP', 'error');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-portal">
        <div className="admin-loading">
          <div className="admin-spinner"></div>
          <p>Loading Admin Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="admin-avatar">A</div>
          <h3>{user?.name || 'Admin'}</h3>
          <span className="admin-badge">Administrator</span>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
            { id: 'hotspots', icon: 'map-pin', label: 'Hotspots' },
            { id: 'users', icon: 'users', label: 'Users' },
            { id: 'reporters', icon: 'award', label: 'Reporters' },
            { id: 'ipbans', icon: 'shield', label: 'IP Bans' },
          ].map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="nav-icon">
                {item.icon === 'grid' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
                {item.icon === 'map-pin' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                {item.icon === 'users' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
                {item.icon === 'award' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>}
                {item.icon === 'shield' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="sidebar-logout" onClick={onLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-topbar">
          <h1 className="topbar-title">
            {activeSection === 'dashboard' && 'Dashboard Overview'}
            {activeSection === 'hotspots' && 'Hotspot Management'}
            {activeSection === 'users' && 'User Management'}
            {activeSection === 'reporters' && 'Reporter Leaderboard'}
            {activeSection === 'ipbans' && 'IP Ban Management'}
          </h1>
          <div className="topbar-info">
            <span className="live-dot"></span>
            DengueSpot Admin
          </div>
        </header>

        <div className="admin-content">
          {/* ---- DASHBOARD ---- */}
          {activeSection === 'dashboard' && stats && (
            <div className="dashboard-section">
              <div className="stats-grid">
                <div className="stat-card stat-blue">
                  <div className="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
                  <div className="stat-info">
                    <span className="stat-number">{stats.totalUsers}</span>
                    <span className="stat-label">Total Users</span>
                  </div>
                  <div className="stat-badge">+{stats.recentUsers} this week</div>
                </div>

                <div className="stat-card stat-orange">
                  <div className="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                  <div className="stat-info">
                    <span className="stat-number">{stats.totalHotspots}</span>
                    <span className="stat-label">Total Hotspots</span>
                  </div>
                  <div className="stat-badge">+{stats.recentHotspots} this week</div>
                </div>

                <div className="stat-card stat-yellow">
                  <div className="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                  <div className="stat-info">
                    <span className="stat-number">{stats.pendingHotspots}</span>
                    <span className="stat-label">Pending Review</span>
                  </div>
                </div>

                <div className="stat-card stat-red">
                  <div className="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                  <div className="stat-info">
                    <span className="stat-number">{stats.highRiskCount}</span>
                    <span className="stat-label">High Risk</span>
                  </div>
                </div>

                <div className="stat-card stat-cyan">
                  <div className="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                  <div className="stat-info">
                    <span className="stat-number">{stats.investigatingHotspots}</span>
                    <span className="stat-label">Investigating</span>
                  </div>
                </div>

                <div className="stat-card stat-green">
                  <div className="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                  <div className="stat-info">
                    <span className="stat-number">{stats.resolvedHotspots}</span>
                    <span className="stat-label">Resolved</span>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="action-cards">
                  <button className="action-card" onClick={() => { setHotspotFilter({ status: 'reported', risk: '' }); setActiveSection('hotspots'); }}>
                    <span className="action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                    <span className="action-text">Review Pending ({stats.pendingHotspots})</span>
                  </button>
                  <button className="action-card" onClick={() => { setHotspotFilter({ status: '', risk: 'high' }); setActiveSection('hotspots'); }}>
                    <span className="action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                    <span className="action-text">High Risk Hotspots ({stats.highRiskCount})</span>
                  </button>
                  <button className="action-card" onClick={() => setActiveSection('users')}>
                    <span className="action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></span>
                    <span className="action-text">Manage Users ({stats.totalUsers})</span>
                  </button>
                  <button className="action-card" onClick={() => setActiveSection('reporters')}>
                    <span className="action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg></span>
                    <span className="action-text">Top Reporters ({stats.totalReporters})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- HOTSPOTS ---- */}
          {activeSection === 'hotspots' && (
            <div className="hotspots-section">
              <div className="section-filters">
                <select
                  value={hotspotFilter.status}
                  onChange={e => { setHotspotFilter(f => ({ ...f, status: e.target.value })); setHotspotPage(1); }}
                >
                  <option value="">All Status</option>
                  <option value="reported">Reported</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={hotspotFilter.risk}
                  onChange={e => { setHotspotFilter(f => ({ ...f, risk: e.target.value })); setHotspotPage(1); }}
                >
                  <option value="">All Risk</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button className="refresh-btn" onClick={fetchHotspots}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Refresh</button>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Location</th>
                      <th>Risk</th>
                      <th>Status</th>
                      <th>Reporter</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspots.map(h => (
                      <tr key={h._id}>
                        <td className="photo-cell">
                          {h.photoUrl ? (
                            <img
                              src={h.photoUrl}
                              alt="Hotspot"
                              className="hotspot-thumb"
                              onClick={() => setLightboxImage(h.photoUrl)}
                              title="Click to view full image"
                            />
                          ) : (
                            <span className="no-photo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></span>
                          )}
                        </td>
                        <td className="loc-cell">
                          <span className="coords">{h.latitude?.toFixed(4)}, {h.longitude?.toFixed(4)}</span>
                          {h.description && <span className="desc-preview">{h.description.substring(0, 40)}...</span>}
                        </td>
                        <td><span className={`risk-pill ${h.riskLevel}`}>{h.riskLevel}</span></td>
                        <td>
                          <select
                            className={`status-select ${h.status}`}
                            value={h.status}
                            onChange={e => updateHotspotStatus(h._id, e.target.value)}
                          >
                            <option value="reported">Reported</option>
                            <option value="investigating">Investigating</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                        <td>{h.reporterName || 'Anonymous'}</td>
                        <td className="date-cell">{formatDate(h.createdAt)}</td>
                        <td className="actions-cell">
                          <button className="action-btn remove" onClick={() => deleteHotspot(h._id)} title="Delete Hotspot"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                        </td>
                      </tr>
                    ))}
                    {hotspots.length === 0 && (
                      <tr><td colSpan="7" className="empty-row">No hotspots found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {hotspotPagination.pages > 1 && (
                <div className="table-pagination">
                  <button disabled={hotspotPage <= 1} onClick={() => setHotspotPage(p => p - 1)}>← Prev</button>
                  <span>Page {hotspotPage} of {hotspotPagination.pages}</span>
                  <button disabled={hotspotPage >= hotspotPagination.pages} onClick={() => setHotspotPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ---- USERS ---- */}
          {activeSection === 'users' && (
            <div className="users-section">
              <div className="section-filters">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                  className="search-input"
                />
                <button className="refresh-btn" onClick={fetchUsers}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Refresh</button>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Provider</th>
                      <th>Scans</th>
                      <th>IP</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className={u.isBanned ? 'banned-row' : ''}>
                        <td className="user-name">{u.name}</td>
                        <td className="user-email">{u.email}</td>
                        <td><span className={`role-pill ${u.role}`}>{u.role}</span></td>
                        <td>
                          {u.isBanned ? (
                            <span className="status-pill-banned" title={u.banReason || ''}>Banned</span>
                          ) : (
                            <span className="status-pill-active">Active</span>
                          )}
                        </td>
                        <td>{u.provider}</td>
                        <td>{u.scanCount}</td>
                        <td className="ip-cell">{u.lastLoginIp || '—'}</td>
                        <td className="date-cell">{formatDate(u.createdAt)}</td>
                        <td className="actions-cell">
                          {u.role === 'user' ? (
                            <button className="action-btn promote" onClick={() => updateUserRole(u.id, 'admin')} title="Promote to Admin">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#48cae4" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                          ) : (
                            <button className="action-btn demote" onClick={() => updateUserRole(u.id, 'user')} title="Demote to User">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffb74d" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                          )}
                          {u.id !== user?.id && (
                            u.isBanned ? (
                              <button className="action-btn unban-user" onClick={() => unbanUser(u.id, u.name)} title="Unban User">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              </button>
                            ) : (
                              <button className="action-btn ban-user" onClick={() => banUser(u.id, u.name)} title="Ban User">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                              </button>
                            )
                          )}
                          {u.lastLoginIp && u.id !== user?.id && (
                            <button className="action-btn ban-ip" onClick={() => banUserIp(u.id, u.name)} title="Ban IP">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="8" y1="11" x2="16" y2="11"/></svg>
                            </button>
                          )}
                          {u.id !== user?.id && (
                            <button className="action-btn remove" onClick={() => deleteUser(u.id)} title="Delete User">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan="9" className="empty-row">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {userPagination.pages > 1 && (
                <div className="table-pagination">
                  <button disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>← Prev</button>
                  <span>Page {userPage} of {userPagination.pages}</span>
                  <button disabled={userPage >= userPagination.pages} onClick={() => setUserPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ---- REPORTERS ---- */}
          {activeSection === 'reporters' && (
            <div className="reporters-section">
              <div className="section-filters">
                <button className="refresh-btn" onClick={fetchReporters}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Refresh</button>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Reports</th>
                      <th>Badge</th>
                      <th>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporters.map((r, i) => (
                      <tr key={r._id}>
                        <td className="rank-cell">{i + 1}</td>
                        <td className="user-name">{r.name}</td>
                        <td><span className="report-count">{r.reports}</span></td>
                        <td><span className={`badge-pill ${r.badge || 'none'}`}>
                          {r.badge === 'platinum' && 'P '}
                          {r.badge === 'gold' && 'G '}
                          {r.badge === 'silver' && 'S '}
                          {r.badge === 'bronze' && 'B '}
                          {r.badge || 'none'}
                        </span></td>
                        <td>{r.verified ? <span className="verified-yes">Yes</span> : <span className="verified-no">No</span>}</td>
                      </tr>
                    ))}
                    {reporters.length === 0 && (
                      <tr><td colSpan="5" className="empty-row">No reporters yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---- IP BANS ---- */}
          {activeSection === 'ipbans' && (
            <div className="ipbans-section">
              <div className="ban-ip-form">
                <h3>Ban an IP Address</h3>
                <div className="ban-form-row">
                  <input
                    type="text"
                    placeholder="IP address (e.g. 192.168.1.1)"
                    value={banIpInput}
                    onChange={e => setBanIpInput(e.target.value)}
                    className="ban-input"
                  />
                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={banIpReason}
                    onChange={e => setBanIpReason(e.target.value)}
                    className="ban-input reason-input"
                  />
                  <button className="ban-submit-btn" onClick={banManualIp} disabled={!banIpInput.trim()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    Ban IP
                  </button>
                </div>
              </div>

              <div className="section-filters">
                <span className="ban-count">{bannedIps.length} banned IP{bannedIps.length !== 1 ? 's' : ''}</span>
                <button className="refresh-btn" onClick={fetchBannedIps}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Refresh</button>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Associated User</th>
                      <th>Reason</th>
                      <th>Banned On</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannedIps.map(b => (
                      <tr key={b.id}>
                        <td className="ip-cell-mono">{b.ip}</td>
                        <td>{b.associatedUser || '—'}</td>
                        <td className="reason-cell">{b.reason}</td>
                        <td className="date-cell">{formatDate(b.createdAt)}</td>
                        <td className="actions-cell">
                          <button className="action-btn unban" onClick={() => unbanIp(b.id)} title="Unban IP">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                            Unban
                          </button>
                        </td>
                      </tr>
                    ))}
                    {bannedIps.length === 0 && (
                      <tr><td colSpan="5" className="empty-row">No banned IPs</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="image-lightbox" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
            <img src={lightboxImage} alt="Hotspot full view" />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default AdminPortal;
