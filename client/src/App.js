import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import ScanArea from './components/ScanArea';
import Checklist from './components/Checklist';
import HotspotMap from './components/HotspotMap';
import Lessons from './components/Lessons';
import Facts from './components/Facts';
import MythVsFacts from './components/MythVsFacts';
import Dashboard from './components/Dashboard';
import LoginModal from './components/LoginModal';
import AdminPortal from './components/AdminPortal';
import NewsTickerThreeJS from './components/NewsTickerThreeJS';
import WeatherAlert from './components/WeatherAlert';
import ChatBot from './components/ChatBot';
import CommunityChat from './components/CommunityChat';
import Toast from './components/Toast';
import apiClient from './utils/axiosConfig';

function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileFullscreen, setProfileFullscreen] = useState(false);

  useEffect(() => {
    // Handle Google OAuth callback
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userParam = params.get('user');

    if (accessToken && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
        setToast({ message: `Welcome, ${userData.name}!`, type: 'success' });
        // Clean URL
        window.history.replaceState({}, document.title, '/');
        return;
      } catch (e) {
        console.error('OAuth callback parse error:', e);
      }
    }

    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('accessToken');

      if (storedUser && storedToken) {
        try {
          const response = await apiClient.get('/auth/me');
          setUser(response.data.user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Auth check failed:', error);
          handleLogout();
        }
      } else {
        const hasVisited = localStorage.getItem('hasVisited');
        if (!hasVisited) {
          setShowLoginModal(true);
          localStorage.setItem('hasVisited', 'true');
        }
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setShowLoginModal(false);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.role === 'admin') {
      setToast({ message: `Welcome, Admin ${userData.name}!`, type: 'success' });
    } else {
      setToast({ message: `Welcome back, ${userData.name}!`, type: 'success' });
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      setToast({ message: 'Logged out successfully', type: 'success' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  };

  // If admin is logged in, show admin portal
  if (isAuthenticated && user?.role === 'admin') {
    return (
      <div className="App">
        <AdminPortal user={user} onLogout={handleLogout} />
        {toast && (
          <Toast 
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="App">
      <Header 
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={() => { setShowProfile(false); handleLogout(); }}
        onLoginClick={() => setShowLoginModal(true)}
        onProfileClick={() => setShowProfile(true)}
      />
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
        />
      )}
      <div className="tab-navigation">
        <button 
          className={activeTab === 'scan' ? 'active' : ''}
          onClick={() => setActiveTab('scan')}
        >
          <span className="tab-label">Scan</span>
        </button>
        <button 
          className={activeTab === 'checklist' ? 'active' : ''}
          onClick={() => setActiveTab('checklist')}
        >
          <span className="tab-label">Checklist</span>
        </button>
        <button 
          className={activeTab === 'map' ? 'active' : ''}
          onClick={() => setActiveTab('map')}
        >
          <span className="tab-label">Hotspots</span>
        </button>
        <button 
          className={activeTab === 'learn' ? 'active' : ''}
          onClick={() => setActiveTab('learn')}
        >
          <span className="tab-label">Learn</span>
        </button>
        <button 
          className={activeTab === 'community' ? 'active' : ''}
          onClick={() => setActiveTab('community')}
        >
          <span className="tab-label">Community</span>
        </button>
      </div>

      <div className="content">
        {activeTab === 'scan' && <ScanArea />}
        {activeTab === 'checklist' && <Checklist />}
        {activeTab === 'map' && <HotspotMap user={user} isAuthenticated={isAuthenticated} />}
        {activeTab === 'learn' && <Lessons onNavigateToMythFacts={() => setActiveTab('myth')} onNavigateToChecklist={() => setActiveTab('checklist')} onNavigateToFacts={() => setActiveTab('facts')} onNavigateToCommunity={() => setActiveTab('community')} />}
        {activeTab === 'community' && <CommunityChat user={user} isAuthenticated={isAuthenticated} onBack={() => setActiveTab('community')} />}
        {activeTab === 'facts' && <Facts />}
        {activeTab === 'myth' && <MythVsFacts />}
      </div>

      <WeatherAlert />

      {showProfile && (
        <div className={`profile-overlay ${profileFullscreen ? 'fullscreen' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) { setShowProfile(false); setProfileFullscreen(false); } }}>
          <div className={`profile-panel ${profileFullscreen ? 'fullscreen' : ''}`}>
            <Dashboard
              user={user}
              isAuthenticated={isAuthenticated}
              onLoginClick={() => { setShowProfile(false); setProfileFullscreen(false); setShowLoginModal(true); }}
              onClose={() => { setShowProfile(false); setProfileFullscreen(false); }}
              isFullscreen={profileFullscreen}
              onToggleFullscreen={() => setProfileFullscreen(f => !f)}
            />
          </div>
        </div>
      )}
      
      <ChatBot isLoggedIn={isAuthenticated} loggedInUser={user} onOpenLogin={() => setShowLoginModal(true)} onNavigate={(tab) => setActiveTab(tab)} />

      <NewsTickerThreeJS />
      
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
