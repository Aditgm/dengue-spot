import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/axiosConfig';
import './Checklist.css';

function Checklist() {
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const userId = localStorage.getItem('userId') || `user_${Date.now()}`;

  const fetchChecklist = useCallback(async () => {
    try {
      const response = await apiClient.get(`/checklist/${userId}`);
      const week = getCurrentWeek();
      const items = response.data.checklist[week] || response.data.checklist[Object.keys(response.data.checklist)[0]] || [];
      setChecklist(items);
      updateCompletedCount(items);
    } catch (error) {
      console.error('Error fetching checklist:', error);
      // Use default checklist
      const defaultItems = getDefaultChecklist();
      setChecklist(defaultItems);
      updateCompletedCount(defaultItems);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', userId);
    }
    fetchChecklist();
  }, [userId, fetchChecklist]);



  const getDefaultChecklist = () => {
    return [
      { id: 1, task: 'Empty and clean all water containers', completed: false, tip: 'Check buckets, drums, and barrels weekly' },
      { id: 2, task: 'Cover water storage tanks tightly', completed: false, tip: 'Use tight-fitting lids to prevent mosquito entry' },
      { id: 4, task: 'Clean gutters and drains', completed: false, tip: 'Remove leaves and debris that trap water' },
      { id: 5, task: 'Empty plant pot trays', completed: false, tip: 'Change water in vases and saucers every 2 days' },
      { id: 6, task: 'Dispose of bottles, cans, and containers', completed: false, tip: 'Remove any items that can collect rainwater' },
      { id: 7, task: 'Check for stagnant water in yard/roof', completed: false, tip: 'Inspect all outdoor areas after rain' },
      { id: 8, task: 'Ensure proper waste disposal', completed: false, tip: 'Keep trash bins covered and dispose regularly' }
    ];
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  };

  const updateCompletedCount = (items) => {
    const count = items.filter(item => item.completed).length;
    setCompletedCount(count);
  };

  const toggleTask = async (taskId) => {
    const updatedChecklist = checklist.map(item =>
      item.id === taskId ? { ...item, completed: !item.completed } : item
    );
    
    setChecklist(updatedChecklist);
    updateCompletedCount(updatedChecklist);

    // Check if all completed
    const allDone = updatedChecklist.every(item => item.completed);
    if (allDone) {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 3000);
    }

    // Save to backend
    try {
      const week = getCurrentWeek();
      await apiClient.post(`/checklist/${userId}`, {
        week,
        items: updatedChecklist
      });
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const resetWeek = () => {
    const resetChecklist = checklist.map(item => ({ ...item, completed: false }));
    setChecklist(resetChecklist);
    updateCompletedCount(resetChecklist);
  };

  if (loading) {
    return (
      <div className="checklist-container">
        <div className="checklist-card">
          <p>Loading checklist...</p>
        </div>
      </div>
    );
  }

  const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;
  const allDone = checklist.length > 0 && completedCount === checklist.length;

  return (
    <div className="checklist-container">
      <div className={`checklist-card ${celebrating ? 'celebrating' : ''}`}>
        
        {/* Hero Banner — pure CSS, no Three.js */}
        <div className="checklist-hero">
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="hero-content">
            <span className="hero-icon">{allDone ? '🎉' : '🛡️'}</span>
            <h2 className="hero-title">Weekly Prevention Checklist</h2>
            <p className="hero-subtitle">
              Week {getCurrentWeek()} of {new Date().getFullYear()} • {allDone ? 'All tasks completed!' : `${checklist.length - completedCount} tasks remaining`}
            </p>
          </div>
        </div>

        {/* Progress Section */}
        <div className="progress-section">
          <div className="progress-circle-container">
            <svg className="progress-circle" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00b4d8" />
                  <stop offset="100%" stopColor="#48cae4" />
                </linearGradient>
              </defs>
              <circle className="progress-circle-bg" cx="100" cy="100" r="90" />
              <circle
                className="progress-circle-fill"
                cx="100"
                cy="100"
                r="90"
                style={{ strokeDashoffset: 565.48 - (565.48 * progress) / 100 }}
              />
            </svg>
            <div className="progress-circle-text">
              <div className="progress-percentage">{Math.round(progress)}%</div>
              <div className="progress-label">Complete</div>
            </div>
          </div>
          <div className="progress-stats">
            <div className="stat-item">
              <span className="stat-number">{completedCount}</span>
              <span className="stat-label">Done</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">{checklist.length - completedCount}</span>
              <span className="stat-label">Left</span>
            </div>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="checklist-items">
          {checklist.map((item, index) => (
            <div 
              key={item.id} 
              className={`checklist-item ${item.completed ? 'completed' : ''}`}
              onClick={() => toggleTask(item.id)}
              style={{ '--delay': `${index * 60}ms` }}
            >
              <div className="checkbox">
                {item.completed ? '✓' : <span className="checkbox-num">{index + 1}</span>}
              </div>
              <div className="task-content">
                <span className="task-text">{item.task}</span>
                {item.tip && <span className="task-tip">💡 {item.tip}</span>}
              </div>
              {item.completed && <span className="completed-badge">Done ✓</span>}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="checklist-footer">
          <button onClick={resetWeek} className="reset-button">
            🔄 Reset Week
          </button>
          <p className="reminder-text">
            🦟 Complete this checklist every week to prevent mosquito breeding
          </p>
        </div>
      </div>
    </div>
  );
}

export default Checklist;


