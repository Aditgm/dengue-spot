import React, { useState, useEffect } from 'react';
import './NewsTicker.css';

function NewsTicker() {
  const allNewsItems = [
    {
      id: 1,
      text: 'Delhi reports 150+ dengue cases this week, authorities urge preventive measures',
      source: 'Health Ministry',
      date: 'Feb 7, 2026'
    },
    {
      id: 2,
      text: 'Maharashtra launches statewide anti-dengue campaign across all districts',
      source: 'PTI',
      date: 'Feb 6, 2026'
    },
    {
      id: 3,
      text: 'Tamil Nadu sees 40% reduction in dengue cases after community awareness drives',
      source: 'Times of India',
      date: 'Feb 5, 2026'
    },
    {
      id: 4,
      text: 'Karnataka government distributes free mosquito nets in dengue-affected areas',
      source: 'Deccan Herald',
      date: 'Feb 5, 2026'
    },
    {
      id: 5,
      text: 'AIIMS releases new dengue prevention guidelines for Indian households',
      source: 'AIIMS',
      date: 'Feb 4, 2026'
    },
    {
      id: 6,
      text: 'West Bengal reports spike in dengue cases, health camps set up in Kolkata',
      source: 'The Hindu',
      date: 'Feb 3, 2026'
    },
    {
      id: 7,
      text: 'Telangana launches mobile app for dengue hotspot reporting and tracking',
      source: 'IANS',
      date: 'Feb 2, 2026'
    },
    {
      id: 8,
      text: 'Gujarat reports zero dengue deaths this year due to early intervention programs',
      source: 'Indian Express',
      date: 'Feb 1, 2026'
    },
    {
      id: 9,
      text: 'Rajasthan health department launches dengue awareness campaign in schools',
      source: 'Hindustan Times',
      date: 'Jan 31, 2026'
    },
    {
      id: 10,
      text: 'Punjab reports decline in dengue cases after intensive fogging operations',
      source: 'Tribune India',
      date: 'Jan 30, 2026'
    },
    {
      id: 11,
      text: 'Uttar Pradesh deploys rapid response teams in dengue-prone districts',
      source: 'ANI',
      date: 'Jan 29, 2026'
    },
    {
      id: 12,
      text: 'Kerala introduces AI-based dengue prediction system across state',
      source: 'The Hindu',
      date: 'Jan 28, 2026'
    }
  ];

  const [newsItems, setNewsItems] = useState(allNewsItems.slice(0, 8));
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(8);

  // Simulate live news updates - rotate news every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused) {
        setNewsItems(prevItems => {
          const newItems = [...prevItems];
          // Remove first item and add new one from pool
          newItems.shift();
          const nextItem = allNewsItems[currentIndex % allNewsItems.length];
          newItems.push({
            ...nextItem,
            date: new Date().toLocaleString('en-IN', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit',
              minute: '2-digit'
            })
          });
          setCurrentIndex(prev => prev + 1);
          return newItems;
        });
      }
    }, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, [isPaused, currentIndex, allNewsItems]);

  return (
    <div className="news-ticker-wrapper">
      <div className="news-ticker-label">
        <span className="news-icon"></span>
        <span className="news-text">LIVE NEWS</span>
        <span className="live-indicator"></span>
      </div>
      <div 
        className="news-ticker-container"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className={`news-ticker-content ${isPaused ? 'paused' : ''}`}>
          {/* Duplicate news items for seamless loop */}
          {[...newsItems, ...newsItems].map((item, index) => (
            <div key={`${item.id}-${index}`} className="news-item">
              <span className="news-bullet">●</span>
              <span className="news-item-text">{item.text}</span>
              <span className="news-source">— {item.source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NewsTicker;
