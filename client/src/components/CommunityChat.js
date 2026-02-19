import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from '../utils/axiosConfig';
import './CommunityChat.css';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : window.location.origin;

function CommunityChat({ user, isAuthenticated, onBack }) {
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showRoomList, setShowRoomList] = useState(true);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Get auth token
  const getToken = useCallback(() => {
    return localStorage.getItem('accessToken');
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to community chat');
    });

    newSocket.on('error-msg', ({ message }) => {
      alert(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axios.get('/community/rooms');
        setRooms(res.data.rooms || []);
      } catch (err) {
        console.error('Error fetching rooms:', err);
      }
    };
    fetchRooms();
  }, []);

  // Socket event listeners for messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
      // Auto-scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, reactions } : m
      ));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, text: '[Message deleted]', isDeleted: true } : m
      ));
    };

    const handleOnlineCount = ({ count }) => {
      setOnlineCount(count);
    };

    const handleUserTyping = ({ userId, userName }) => {
      setTypingUsers(prev => {
        if (prev.find(u => u.userId === userId)) return prev;
        return [...prev, { userId, userName }];
      });
    };

    const handleStopTyping = ({ userId }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    };

    const handleUserJoined = ({ userName }) => {
      // Optional: show system message
    };

    const handleUserLeft = ({ userName }) => {
      // Optional: show system message
    };

    socket.on('new-message', handleNewMessage);
    socket.on('reaction-updated', handleReactionUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('online-count', handleOnlineCount);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleStopTyping);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('reaction-updated', handleReactionUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('online-count', handleOnlineCount);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleStopTyping);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  // Join a room
  const joinRoom = useCallback(async (room) => {
    if (!socket || !isAuthenticated) return;

    setActiveRoom(room);
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setOnlineCount(0);
    setTypingUsers([]);
    setShowRoomList(false);

    // Emit join
    socket.emit('join-room', { room: room.id, token: getToken() });

    // Fetch message history
    setLoading(true);
    try {
      const res = await axios.get(`/community/messages/${room.id}?page=1&limit=30`);
      setMessages(res.data.messages || []);
      setHasMore(res.data.hasMore || false);
      setPage(2);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
    setLoading(false);
  }, [socket, isAuthenticated, getToken]);

  // Load more messages (pagination)
  const loadMore = useCallback(async () => {
    if (!activeRoom || loading || !hasMore) return;
    setLoading(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const res = await axios.get(`/community/messages/${activeRoom.id}?page=${page}&limit=30`);
      const older = res.data.messages || [];
      setMessages(prev => [...older, ...prev]);
      setHasMore(res.data.hasMore || false);
      setPage(p => p + 1);
      // Maintain scroll position
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error('Error loading more:', err);
    }
    setLoading(false);
  }, [activeRoom, loading, hasMore, page]);

  // Send message
  const sendMessage = useCallback(() => {
    if (!socket || !activeRoom || !inputText.trim()) return;
    socket.emit('send-message', {
      room: activeRoom.id,
      text: inputText.trim(),
      token: getToken()
    });
    setInputText('');
    // Stop typing
    socket.emit('stop-typing', { room: activeRoom.id });
    inputRef.current?.focus();
  }, [socket, activeRoom, inputText, getToken]);

  // Handle typing
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeRoom) return;
    socket.emit('typing', { room: activeRoom.id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { room: activeRoom.id });
    }, 2000);
  };

  // Toggle reaction
  const toggleReaction = (messageId, emoji) => {
    if (!socket) return;
    socket.emit('toggle-reaction', { messageId, emoji, token: getToken() });
  };

  // Delete message
  const deleteMessage = (messageId) => {
    if (!socket) return;
    socket.emit('delete-message', { messageId, token: getToken() });
  };

  // Format time
  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Count total reactions
  const getReactionCount = (reactions, emoji) => {
    if (!reactions || !reactions[emoji]) return 0;
    return reactions[emoji].length;
  };

  // Check if user reacted
  const hasUserReacted = (reactions, emoji) => {
    if (!reactions || !reactions[emoji] || !user) return false;
    return reactions[emoji].some(id => id === user._id || id === user.id);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="cc-container">
        <div className="cc-auth-wall">
          <div className="cc-auth-icon">💬</div>
          <h2>Community Chat</h2>
          <p>Please log in to join the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-container">
      {/* Header */}
      <div className="cc-header">
        {activeRoom && !showRoomList && (
          <button className="cc-btn-back" onClick={() => { setShowRoomList(true); setActiveRoom(null); }}>
            ← Rooms
          </button>
        )}
        <div className="cc-header-title">
          <span className="cc-header-icon">💬</span>
          <h2>{activeRoom && !showRoomList ? activeRoom.name : 'Community Chat'}</h2>
        </div>
        {activeRoom && !showRoomList && (
          <div className="cc-online-badge">
            <span className="cc-online-dot"></span>
            {onlineCount} online
          </div>
        )}
      </div>

      <div className="cc-body">
        {/* Room List */}
        {showRoomList && (
          <div className="cc-room-list">
            <div className="cc-room-header">
              <h3>🏙️ Choose Your Area</h3>
              <p>Join area-based chat rooms to discuss dengue prevention with your community</p>
            </div>
            <div className="cc-rooms-grid">
              {rooms.map(room => (
                <button
                  key={room.id}
                  className={`cc-room-card ${activeRoom?.id === room.id ? 'active' : ''}`}
                  onClick={() => joinRoom(room)}
                >
                  <span className="cc-room-emoji">{room.emoji}</span>
                  <span className="cc-room-name">{room.name}</span>
                  <span className="cc-room-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        {activeRoom && !showRoomList && (
          <div className="cc-chat-area">
            {/* Messages */}
            <div className="cc-messages" ref={messagesContainerRef}>
              {hasMore && (
                <button className="cc-load-more" onClick={loadMore} disabled={loading}>
                  {loading ? '⏳ Loading...' : '↑ Load older messages'}
                </button>
              )}
              {loading && messages.length === 0 && (
                <div className="cc-loading">
                  <div className="cc-loading-spinner"></div>
                  <p>Loading messages...</p>
                </div>
              )}
              {!loading && messages.length === 0 && (
                <div className="cc-empty">
                  <span className="cc-empty-icon">💭</span>
                  <p>No messages yet. Be the first to start the conversation!</p>
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.userId === (user?._id || user?.id);
                const isDeleted = msg.isDeleted;
                return (
                  <div key={msg._id} className={`cc-message ${isOwn ? 'own' : ''} ${isDeleted ? 'deleted' : ''}`}>
                    <div className="cc-msg-avatar">
                      {msg.userAvatar ? (
                        <img src={msg.userAvatar} alt="" />
                      ) : (
                        <span>{msg.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="cc-msg-content">
                      <div className="cc-msg-header">
                        <span className="cc-msg-name">{msg.userName}</span>
                        <span className="cc-msg-time">{formatTime(msg.createdAt)}</span>
                        {isOwn && !isDeleted && (
                          <button
                            className="cc-msg-delete"
                            onClick={() => deleteMessage(msg._id)}
                            title="Delete message"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <div className="cc-msg-text">{msg.text}</div>
                      {!isDeleted && (
                        <div className="cc-msg-reactions">
                          {REACTIONS.map(emoji => {
                            const count = getReactionCount(msg.reactions, emoji);
                            const reacted = hasUserReacted(msg.reactions, emoji);
                            return (
                              <button
                                key={emoji}
                                className={`cc-reaction-btn ${reacted ? 'active' : ''} ${count > 0 ? 'has-count' : ''}`}
                                onClick={() => toggleReaction(msg._id, emoji)}
                                title={emoji}
                              >
                                <span className="cc-reaction-emoji">{emoji}</span>
                                {count > 0 && <span className="cc-reaction-count">{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="cc-typing">
                <div className="cc-typing-dots">
                  <span></span><span></span><span></span>
                </div>
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0].userName} is typing...`
                    : `${typingUsers.length} people are typing...`
                  }
                </span>
              </div>
            )}

            {/* Input */}
            <div className="cc-input-area">
              <div className="cc-input-wrapper">
                <textarea
                  ref={inputRef}
                  className="cc-input"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  maxLength={500}
                  rows={1}
                />
                <span className="cc-char-count">{inputText.length}/500</span>
              </div>
              <button
                className="cc-send-btn"
                onClick={sendMessage}
                disabled={!inputText.trim()}
              >
                <span>➤</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunityChat;
