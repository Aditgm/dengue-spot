import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/axiosConfig';
import './Lessons.css';

function Lessons({ onNavigateToMythFacts, onNavigateToChecklist, onNavigateToFacts, onNavigateToCommunity }) {
  const [lessons, setLessons] = useState([]);
  const [language, setLanguage] = useState('english');
  const [loading, setLoading] = useState(true);

  const fetchLessons = useCallback(async () => {
    try {
      const response = await apiClient.get(`/lessons`);
      setLessons(response.data.lessons || []);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      // Use default lessons
      setLessons(getDefaultLessons());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const getDefaultLessons = () => {
    return [
      {
        id: 1,
        title: 'Why Source Reduction Matters',
        titleHindi: 'स्रोत कमी क्यों महत्वपूर्ण है',
        content: 'Mosquitoes breed in stagnant water. Removing breeding sites is the most effective way to prevent dengue.',
        contentHindi: 'मच्छर स्थिर पानी में प्रजनन करते हैं। प्रजनन स्थलों को हटाना डेंगू को रोकने का सबसे प्रभावी तरीका है।',
        type: 'fact'
      },
      {
        id: 2,
        title: 'Weekly Checklist',
        titleHindi: 'साप्ताहिक चेकलिस्ट',
        content: 'Check your home weekly: empty containers, cover tanks, clean gutters, remove waste.',
        contentHindi: 'साप्ताहिक रूप से अपने घर की जांच करें: कंटेनर खाली करें, टैंक ढकें, नालियां साफ करें, कचरा हटाएं।',
        type: 'action'
      },
      {
        id: 3,
        title: 'Myth vs Fact',
        titleHindi: 'मिथक बनाम तथ्य',
        content: 'Myth: Only dirty water breeds mosquitoes. Fact: Even clean water in containers can breed mosquitoes if left stagnant for 7+ days.',
        contentHindi: 'मिथक: केवल गंदा पानी मच्छर पैदा करता है। तथ्य: कंटेनरों में साफ पानी भी 7+ दिनों तक स्थिर रहने पर मच्छर पैदा कर सकता है।',
        type: 'myth'
      },
      {
        id: 4,
        title: 'Community Chat',
        titleHindi: 'सामुदायिक चैट',
        content: 'Join area-based chat rooms to discuss dengue prevention with your community in real-time. 💬',
        contentHindi: 'रियल-टाइम में अपने समुदाय के साथ डेंगू रोकथाम पर चर्चा करने के लिए क्षेत्र-आधारित चैट रूम में शामिल हों। 💬',
        type: 'community'
      }
    ];
  };

  const getTypeIcon = (type) => {
    const icons = {
      fact: '💡',
      action: '✅',
      myth: '❓',
      community: '🤝'
    };
    return icons[type] || '📚';
  };

  const getTypeColor = (type) => {
    const colors = {
      fact: '#667eea',
      action: '#4caf50',
      myth: '#ff9800',
      community: '#9c27b0'
    };
    return colors[type] || '#667eea';
  };

  if (loading) {
    return (
      <div className="lessons-container">
        <div className="lessons-card">
          <p>Loading lessons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lessons-container">
      <div className="lessons-card">
        <div className="lessons-header">
          <h2>📚 Learn About Dengue Prevention</h2>
          <div className="language-toggle">
            <button
              className={language === 'english' ? 'active' : ''}
              onClick={() => setLanguage('english')}
            >
              English
            </button>
            <button
              className={language === 'hindi' ? 'active' : ''}
              onClick={() => setLanguage('hindi')}
            >
              हिंदी
            </button>
          </div>
        </div>

        <div className="lessons-grid">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className={`lesson-card ${lesson.type === 'myth' || lesson.type === 'action' || lesson.type === 'fact' || lesson.type === 'community' ? 'clickable-card' : ''}`}
              style={{ borderTopColor: getTypeColor(lesson.type) }}
              onClick={() => {
                if (lesson.type === 'myth' && onNavigateToMythFacts) {
                  onNavigateToMythFacts();
                } else if (lesson.type === 'action' && onNavigateToChecklist) {
                  onNavigateToChecklist();
                } else if (lesson.type === 'fact' && onNavigateToFacts) {
                  onNavigateToFacts();
                } else if (lesson.type === 'community' && onNavigateToCommunity) {
                  onNavigateToCommunity();
                }
              }}
            >
              <div className="lesson-icon" style={{ color: getTypeColor(lesson.type) }}>
                {getTypeIcon(lesson.type)}
              </div>
              <h3 className="lesson-title">
                {language === 'hindi' ? lesson.titleHindi : lesson.title}
              </h3>
              <p className="lesson-content">
                {language === 'hindi' ? lesson.contentHindi : lesson.content}
              </p>
              <span className="lesson-type" style={{ background: getTypeColor(lesson.type) }}>
                {lesson.type}
              </span>
            </div>
          ))}
        </div>

        <div className="lessons-footer">
          <p className="source-info">
            💡 Based on WHO dengue prevention guidelines and source reduction best practices
          </p>
        </div>
      </div>
    </div>
  );
}

export default Lessons;


