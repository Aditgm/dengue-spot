import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/axiosConfig';
import './ChatBot.css';

const generateSessionId = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};

function ChatBot({ isLoggedIn, loggedInUser, onOpenLogin, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('chatSessionId');
    if (stored) return stored;
    const newId = generateSessionId();
    sessionStorage.setItem('chatSessionId', newId);
    return newId;
  });
  const [userName, setUserName] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestMessageCount, setGuestMessageCount] = useState(() => {
    return parseInt(localStorage.getItem('chatGuestCount') || '0');
  });
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatBodyRef = useRef(null);

  // Sync auth state from parent props
  useEffect(() => {
    if (isLoggedIn && loggedInUser) {
      setUserName(loggedInUser.name);
      setIsAuthenticated(true);
      setIsRateLimited(false);
      // Reset guest limits on login
      setGuestMessageCount(0);
      localStorage.setItem('chatGuestCount', '0');
    } else {
      // Try fetching from backend as fallback
      const checkAuth = async () => {
        try {
          const response = await apiClient.get('/chat/user-info');
          if (response.data.success && response.data.authenticated && response.data.name) {
            setUserName(response.data.name);
            setIsAuthenticated(true);
            setIsRateLimited(false);
          } else {
            setUserName(null);
            setIsAuthenticated(false);
            const count = parseInt(localStorage.getItem('chatGuestCount') || '0');
            setGuestMessageCount(count);
            if (count >= 2) setIsRateLimited(true);
          }
        } catch (error) {
          setIsAuthenticated(false);
        }
      };
      checkAuth();
    }
  }, [isLoggedIn, loggedInUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && !hasGreeted) {
      const firstName = userName ? userName.split(' ')[0] : null;
      let greeting;
      if (firstName) {
        greeting = `Hi ${firstName}! 👋 I'm DengueSpot AI, your dengue prevention assistant. How can I help you today?`;
      } else {
        greeting = `Hi there! 👋 I'm DengueSpot AI, your dengue prevention assistant. How can I help you today?\n\n💡 *Log in for unlimited questions and personalized help!*`;
      }

      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: new Date()
      }]);
      setHasGreeted(true);
    }
  }, [isOpen, hasGreeted, userName]);

  // When user logs in mid-session, add a welcome message
  useEffect(() => {
    if (isLoggedIn && loggedInUser && hasGreeted) {
      const firstName = loggedInUser.name ? loggedInUser.name.split(' ')[0] : 'there';
      setMessages(prev => [...prev, {
        id: 'login_' + Date.now(),
        role: 'assistant',
        content: `Welcome back, ${firstName}! 🎉 You now have unlimited questions. Ask me anything about dengue!`,
        timestamp: new Date()
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, loggedInUser]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    setUnreadCount(0);
  }, [isOpen, isMinimized]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping || isRateLimited) return;

    const userMessage = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await apiClient.post('/chat', {
        message: text,
        sessionId
      });

      if (response.data.metadata?.rateLimited) {
        setIsRateLimited(true);
      }

      if (!isAuthenticated) {
        const newCount = guestMessageCount + 1;
        setGuestMessageCount(newCount);
        localStorage.setItem('chatGuestCount', newCount.toString());
        if (newCount >= 2) {
          setIsRateLimited(true);
        }
      }

      const botMessage = {
        id: 'bot_' + Date.now(),
        role: 'assistant',
        content: response.data.response || "I couldn't process that. Please try again.",
        timestamp: new Date(),
        metadata: response.data.metadata
      };

      setMessages(prev => [...prev, botMessage]);

      if (isMinimized) {
        setUnreadCount(prev => prev + 1);
      }
    } catch (error) {
      const errorMessage = {
        id: 'error_' + Date.now(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment. 🙏",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    try {
      await apiClient.delete(`/chat/memory/${sessionId}`);
    } catch (e) { /* ignore */ }

    const firstName = userName ? userName.split(' ')[0] : null;
    const greeting = firstName
      ? `Hi ${firstName}! 👋 Fresh conversation started. How can I help you?`
      : `Hi there! 👋 Fresh conversation started. How can I help you?`;

    setMessages([{
      id: 'greeting_new',
      role: 'assistant',
      content: greeting,
      timestamp: new Date()
    }]);
  };

  const suggestions = [
    '🦟 What are dengue symptoms?',
    '💊 How to treat dengue at home?',
    '🛡️ Prevention tips',
    '� Where is the chat room?'
  ];

  const handleSuggestion = (text) => {
    setInput(text);
    setTimeout(() => sendMessage(), 100);
  };

  const NAV_LABELS = {
    scan: '🔍 Go to Scan',
    checklist: '✅ Go to Checklist',
    map: '🗺️ Go to Hotspots',
    learn: '📚 Go to Learn',
    community: '💬 Go to Community Chat'
  };

  const formatMessage = (text) => {
    if (!text) return '';

    // Bold
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    formatted = formatted.replace(/^[•-]\s+(.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    // Fix nested uls
    formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
    // Convert [NAV:xxx] to clickable buttons
    formatted = formatted.replace(/\[NAV:(scan|checklist|map|learn|community)\]/gi, (match, tab) => {
      const label = NAV_LABELS[tab.toLowerCase()] || tab;
      return `<button class="chatbot-nav-btn" data-nav="${tab.toLowerCase()}">${label}</button>`;
    });
    // Newlines
    formatted = formatted.replace(/\n/g, '<br/>');
    // Clean up
    formatted = formatted.replace(/<br\/>\s*<ul>/g, '<ul>');
    formatted = formatted.replace(/<\/ul>\s*<br\/>/g, '</ul>');

    return formatted;
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {!isOpen && (
        <button
          className="chatbot-fab"
          onClick={() => setIsOpen(true)}
          title="Chat with DengueSpot AI"
        >
          <div className="chatbot-fab-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 5.92 2 10.5c0 2.56 1.34 4.85 3.43 6.38L4 22l4.55-2.53C9.63 19.82 10.79 20 12 20c5.52 0 10-3.92 10-8.5S17.52 2 12 2z" fill="currentColor"/>
              <circle cx="8" cy="10.5" r="1.2" fill="#0d1c32"/>
              <circle cx="12" cy="10.5" r="1.2" fill="#0d1c32"/>
              <circle cx="16" cy="10.5" r="1.2" fill="#0d1c32"/>
            </svg>
          </div>
          {unreadCount > 0 && (
            <span className="chatbot-unread">{unreadCount}</span>
          )}
          <div className="chatbot-fab-pulse" />
        </button>
      )}

      {isOpen && (
        <div className={`chatbot-window ${isMinimized ? 'minimized' : ''}`}>
          <div className="chatbot-header" onClick={() => isMinimized && setIsMinimized(false)}>
            <div className="chatbot-header-left">
              <div className="chatbot-avatar">
                <span className="chatbot-avatar-emoji">🦟</span>
                <span className="chatbot-status-dot" />
              </div>
              <div className="chatbot-header-info">
                <h3>DengueSpot AI</h3>
                <span className="chatbot-status-text">
                  {isTyping ? 'Typing...' : 'Online • RAG powered'}
                </span>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-header-btn"
                onClick={(e) => { e.stopPropagation(); clearChat(); }}
                title="Clear chat"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
              <button
                className="chatbot-header-btn"
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  {isMinimized
                    ? <path d="M4 8h16v2H4z"/>
                    : <path d="M4 8h16v2H4z"/>
                  }
                </svg>
              </button>
              <button
                className="chatbot-header-btn chatbot-close-btn"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
                title="Close"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="chatbot-body" ref={chatBodyRef}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chatbot-message ${msg.role === 'user' ? 'user' : 'bot'} ${msg.isError ? 'error' : ''}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="chatbot-msg-avatar">🦟</div>
                    )}
                    <div className="chatbot-msg-bubble">
                      <div
                        className="chatbot-msg-content"
                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                        onClick={(e) => {
                          const navBtn = e.target.closest('[data-nav]');
                          if (navBtn && onNavigate) {
                            onNavigate(navBtn.dataset.nav);
                          }
                        }}
                      />
                      <span className="chatbot-msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="chatbot-message bot">
                    <div className="chatbot-msg-avatar">🦟</div>
                    <div className="chatbot-msg-bubble typing">
                      <div className="chatbot-typing-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                )}

                {messages.length <= 1 && !isTyping && (
                  <div className="chatbot-suggestions">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className="chatbot-suggestion-btn"
                        onClick={() => handleSuggestion(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="chatbot-input-area">
                {isRateLimited && !isAuthenticated ? (
                  <div className="chatbot-login-prompt">
                    <span className="chatbot-lock-icon">🔒</span>
                    <p>Log in for unlimited questions</p>
                    <button 
                      className="chatbot-login-btn"
                      onClick={() => {
                        if (onOpenLogin) {
                          onOpenLogin();
                        } else {
                          const loginBtn = document.querySelector('.login-btn, .auth-login-btn, [data-login]');
                          if (loginBtn) loginBtn.click();
                          else window.dispatchEvent(new CustomEvent('openLogin'));
                        }
                      }}
                    >
                      Login / Sign Up
                    </button>
                  </div>
                ) : (
                <div className="chatbot-input-wrapper">
                  <textarea
                    ref={inputRef}
                    className="chatbot-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={!isAuthenticated ? `Ask about dengue... (${2 - guestMessageCount} free left)` : "Ask about dengue..."}
                    rows={1}
                    disabled={isTyping}
                  />
                  <button
                    className={`chatbot-send-btn ${input.trim() && !isTyping ? 'active' : ''}`}
                    onClick={sendMessage}
                    disabled={!input.trim() || isTyping}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
                )}
                <div className="chatbot-powered-by">
                  Powered by Groq + Pinecone RAG
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default ChatBot;
