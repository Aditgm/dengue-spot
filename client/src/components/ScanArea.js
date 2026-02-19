import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../utils/axiosConfig';
import './ScanArea.css';
import ScanHero3D from './ScanHero3D';

function ScanArea() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const sectionRef = useRef(null);

  // Intersection Observer for scroll animation
  useEffect(() => {
    const currentSection = sectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (currentSection) {
      observer.observe(currentSection);
    }

    return () => {
      if (currentSection) {
        observer.unobserve(currentSection);
      }
    };
  }, []);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setResults(null);
      setError(null);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image) {
      setError('Please select an image first');
      return;
    }

    setScanning(true);
    setError(null);

    try {
      // Create form data with the file
      const formData = new FormData();
      formData.append('image', image);

      // Call API
      const result = await apiClient.post(`/scan`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResults(result.data);
      drawDetections(result.data.risks);
    } catch (err) {
      console.error('Scan error:', err);
      setError(err.response?.data?.message || 'Failed to scan image. Using mock data for demo.');
      
      // Use mock data for demo
      const mockResults = {
        success: true,
        risks: [
          {
            object: 'bucket',
            confidence: 0.85,
            advice: 'Empty and clean this container weekly. Store it upside down when not in use.'
          },
          {
            object: 'pot',
            confidence: 0.78,
            advice: 'Empty plant pot trays weekly. Cover or remove standing water.'
          }
        ],
        count: 2,
        message: 'Found 2 potential breeding site(s)',
        mock: true
      };
      setResults(mockResults);
    } finally {
      setScanning(false);
    }
  };

  const drawDetections = (risks) => {
    if (!canvasRef.current || !image) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Draw bounding boxes if available
      risks.forEach(risk => {
        if (risk.bbox) {
          const { x, y, width, height } = risk.bbox;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = '#ff0000';
          ctx.font = '16px Arial';
          ctx.fillText(`${risk.object} (${(risk.confidence * 100).toFixed(0)}%)`, x, y - 5);
        }
      });
    };
    
    img.src = imagePreview;
  };

  const resetScan = () => {
    setImage(null);
    setImagePreview(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="scan-area fade-in-section" ref={sectionRef}>
      <ScanHero3D>
        <div className="scan-content">
          {!imagePreview && (
            <div className="upload-strip">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="image-upload"
              />
              <label htmlFor="image-upload" className="upload-strip-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
                </svg>
                Choose Photo
              </label>
              <div className="upload-strip-divider"></div>
              <span className="upload-strip-text">or drag & drop here</span>
            </div>
          )}
        </div>
      </ScanHero3D>

      {imagePreview && (
        <div className="scan-card">
          <div className="image-container">
            <img src={imagePreview} alt="Preview" />
            <canvas ref={canvasRef} className="detection-canvas" />
          </div>
          <div className="scan-actions">
            <button onClick={handleScan} disabled={scanning} className="scan-button">
              {scanning ? 'Scanning...' : 'Scan for Breeding Sites'}
            </button>
            <button onClick={resetScan} className="reset-button">
              New Photo
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {results && (
            <div className="results">
              <div className="results-header">
                <h3>{results.message}</h3>
                {results.mock && (
                  <span className="mock-badge">Demo Mode</span>
                )}
              </div>
              
              {results.risks && results.risks.length > 0 ? (
                <div className="risks-list">
                  {results.risks.map((risk, index) => (
                    <div key={index} className="risk-item">
                      <div className="risk-header">
                        <span className="risk-object">{risk.object}</span>
                        <span className="risk-confidence">
                          {(risk.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      <p className="risk-advice">{risk.advice}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="success-message">
                  Great! No breeding sites detected. Keep up the good work!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScanArea;


