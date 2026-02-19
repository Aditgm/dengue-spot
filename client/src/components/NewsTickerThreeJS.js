import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import apiClient from '../utils/axiosConfig';
import './NewsTickerThreeJS.css';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '📰' },
  { id: 'dengue', label: 'Dengue', icon: '🦟' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'prevention', label: 'Prevention', icon: '🛡️' },
  { id: 'general', label: 'General', icon: '🌍' },
];

function NewsTickerThreeJS() {
  const [newsItems, setNewsItems] = useState([]);
  const [allNews, setAllNews] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isPaused, setIsPaused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await apiClient.get(`/news`);

        if (response.data.success && response.data.articles?.length > 0) {
          const formatted = response.data.articles.map((article, index) => ({
            id: Date.now() + index,
            text: article.title,
            source: article.source,
            publishedAt: article.publishedAt,
            url: article.url,
            category: article.category
          }));

          setAllNews(formatted);
          setLastUpdate(response.data.cachedAt ? new Date(response.data.cachedAt) : new Date());
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setHasFetched(true);
      }
    };

    fetchNews();

    const interval = setInterval(fetchNews, 8 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeFilter === 'all') {
      setNewsItems(allNews);
    } else {
      setNewsItems(allNews.filter(item => item.category === activeFilter));
    }
  }, [activeFilter, allNews]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      width / -2, width / 2, height / 2, height / -2, 1, 1000
    );
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    sceneRef.current = scene;
    rendererRef.current = renderer;

    const particleCount = 100;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.CircleGeometry(1, 6);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.8, 0.5),
        transparent: true,
        opacity: Math.random() * 0.5 + 0.2
      });
      
      const particle = new THREE.Mesh(geometry, material);
      particle.position.x = (Math.random() - 0.5) * width;
      particle.position.y = (Math.random() - 0.5) * height;
      particle.position.z = Math.random() * 100;
      
      particle.userData = {
        velocityY: Math.random() * 0.5 + 0.2,
        velocityX: (Math.random() - 0.5) * 0.3,
        originalOpacity: particle.material.opacity
      };
      
      scene.add(particle);
      particles.push(particle);
    }

    particlesRef.current = particles;

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (!isPaused) {
        particles.forEach(particle => {
          particle.position.y += particle.userData.velocityY;
          particle.position.x += particle.userData.velocityX;
          particle.rotation.z += 0.01;

          if (particle.position.y > height / 2) {
            particle.position.y = -height / 2;
            particle.position.x = (Math.random() - 0.5) * width;
          }

          const pulse = Math.sin(Date.now() * 0.001 + particle.position.x) * 0.2;
          particle.material.opacity = particle.userData.originalOpacity + pulse;
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const newWidth = canvas.offsetWidth;
      const newHeight = canvas.offsetHeight;
      camera.left = newWidth / -2;
      camera.right = newWidth / 2;
      camera.top = newHeight / 2;
      camera.bottom = newHeight / -2;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      particles.forEach(particle => {
        scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
      });
      renderer.dispose();
    };
  }, [isPaused]);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const getCategoryColor = (cat) => {
    const colors = { dengue: '#ff6b6b', health: '#48cae4', prevention: '#66bb6a', general: '#ffa726' };
    return colors[cat] || '#90e0ef';
  };

  const displayItems = newsItems.length > 0 ? newsItems : [];
  const tickerItems = displayItems.slice(0, 20);
  const activeCategory = CATEGORIES.find(c => c.id === activeFilter);
  const scrollDuration = Math.max(60, tickerItems.length * 8);

  return (
    <div className={`news-ticker-threejs-wrapper ${isExpanded ? 'expanded' : ''}`}>
      <canvas ref={canvasRef} className="news-ticker-canvas" />
      
      {isExpanded && (
        <div className="news-expanded-panel">
          <div className="news-expanded-header">
            <h3>📡 Live News Feed</h3>
            <div className="news-filter-bar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`news-filter-btn ${activeFilter === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveFilter(cat.id)}
                  style={activeFilter === cat.id ? { borderColor: getCategoryColor(cat.id), color: getCategoryColor(cat.id) } : {}}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
            {lastUpdate && <span className="news-expanded-updated">Cached {formatTime(lastUpdate)} • Refreshes every 8h</span>}
          </div>
          <div className="news-expanded-list">
            {displayItems.length === 0 ? (
              <p className="news-empty">No news in this category yet.</p>
            ) : (
              displayItems.map((item, i) => (
                <a
                  key={item.id}
                  className="news-expanded-item"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ '--delay': `${i * 30}ms` }}
                >
                  <span className="news-cat-dot" style={{ background: getCategoryColor(item.category) }}></span>
                  <div className="news-expanded-item-content">
                    <span className="news-expanded-title">{item.text}</span>
                    <span className="news-expanded-meta">
                      <span className="news-expanded-source">{item.source}</span>
                      <span className="news-expanded-time">{formatTime(item.publishedAt)}</span>
                    </span>
                  </div>
                  <svg className="news-link-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                    <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                  </svg>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      <div className="news-ticker-threejs-content">
        <div className="news-ticker-label">
          <span className="news-icon">📡</span>
          <span className="news-text">LIVE</span>
          <span className="live-indicator"></span>
        </div>

        <div className="news-ticker-filters">
          <button
            className={`ticker-filter-pill ${showFilters ? 'open' : ''}`}
            onClick={() => setShowFilters(f => !f)}
            title="Filter news"
          >
            {activeCategory?.icon} {activeCategory?.label} ▾
          </button>
          {showFilters && (
            <div className="ticker-filter-dropdown">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`ticker-filter-option ${activeFilter === cat.id ? 'active' : ''}`}
                  onClick={() => { setActiveFilter(cat.id); setShowFilters(false); }}
                >
                  {cat.icon} {cat.label}
                  <span className="filter-count">
                    {cat.id === 'all' ? allNews.length : allNews.filter(n => n.category === cat.id).length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div 
          className="news-ticker-container"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className={`news-ticker-content ${isPaused ? 'paused' : ''}`}
            style={{ animationDuration: `${scrollDuration}s` }}
          >
            {tickerItems.length > 0 ? (
              [...tickerItems, ...tickerItems].map((item, index) => (
                <div key={`${item.id}-${index}`} className="news-item">
                  <span className="news-bullet" style={{ color: getCategoryColor(item.category) }}>●</span>
                  <span className="news-item-text">{item.text}</span>
                  <span className="news-source">— {item.source}</span>
                  <span className="news-time">{formatTime(item.publishedAt)}</span>
                </div>
              ))
            ) : (
              <div className="news-item">
                <span className="news-bullet" style={{ color: '#48cae4' }}>●</span>
                <span className="news-item-text" style={{ opacity: 0.6 }}>
                  {hasFetched
                    ? 'Stay alert — Remove standing water, use mosquito nets & report breeding spots in your area!'
                    : 'Fetching latest health news…'}
                </span>
                {!hasFetched && <span className="news-item-text" style={{ opacity: 0.4 }}>●  Connecting to news sources…</span>}
              </div>
            )}
          </div>
        </div>

        <button className="news-expand-btn" onClick={() => setIsExpanded(e => !e)} title={isExpanded ? 'Collapse' : 'Expand news'}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {isExpanded ? (
              <path fillRule="evenodd" d="M1.646 11.354a.5.5 0 0 1 0-.708L8 4.293l6.354 6.353a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708 0z"/>
            ) : (
              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

export default NewsTickerThreeJS;
