import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/axiosConfig';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './HotspotMap.css';
import Leaderboard from './Leaderboard';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const SHADOW_URL = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';
const ICON_OPTS = { iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41], shadowUrl: SHADOW_URL };
const riskIcons = {
  low: new L.Icon({ ...ICON_OPTS, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png' }),
  medium: new L.Icon({ ...ICON_OPTS, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png' }),
  high: new L.Icon({ ...ICON_OPTS, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png' }),
  resolved: new L.Icon({ ...ICON_OPTS, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png' }),
};
function getMarkerIcon(hotspot) {
  if (hotspot.status === 'resolved') return riskIcons.resolved;
  return riskIcons[hotspot.riskLevel] || riskIcons.medium;
}

const currentLocationIcon = new L.Icon({
  ...ICON_OPTS,
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
});

function LocationMarker({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

function MapCenterController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || map.getZoom(), {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [center, zoom, map]);
  
  return null;
}

function HotspotMap({ user, isAuthenticated }) {
  const [hotspots, setHotspots] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [reportData, setReportData] = useState({
    description: '',
    riskLevel: 'medium'
  });
  const [reporterName, setReporterName] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [userLocation, setUserLocation] = useState([25.5941, 85.1376]);
  const [mapCenter, setMapCenter] = useState([25.5941, 85.1376]);
  const [mapZoom, setMapZoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [mapError, setMapError] = useState(null);
  const [tileUrl, setTileUrl] = useState('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  const [tileError, setTileError] = useState(false);
  const [tileErrorMsg, setTileErrorMsg] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterRisk, setFilterRisk] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [nearbyRadius, setNearbyRadius] = useState('');
  const [nearbyActive, setNearbyActive] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHotspots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterRisk, filterStatus, nearbyActive]);

  const fetchHotspots = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '50');
      if (filterRisk) params.append('riskLevel', filterRisk);
      if (filterStatus) params.append('status', filterStatus);
      if (nearbyActive && nearbyRadius) {
        params.append('lat', userLocation[0]);
        params.append('lng', userLocation[1]);
        params.append('radius', nearbyRadius);
      }
      const response = await apiClient.get(`/hotspots?${params.toString()}`);
      setHotspots(response.data.hotspots || []);
      setTotalPages(response.data.totalPages || 1);
      setTotalCount(response.data.total || 0);
      setMapError(null);
    } catch (error) {
      console.error('Error fetching hotspots:', error);
      setMapError('Failed to load hotspots. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation([lat, lng]);
          setMapCenter([lat, lng]);
          setMapZoom(15);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMsg = 'Unable to get your location. Using Patna as default.';
          if (error.code === 1) errorMsg = 'Location permission denied. Please enable location access.';
          if (error.code === 2) errorMsg = 'Location service unavailable. Check your network.';
          if (error.code === 3) errorMsg = 'Location request timeout. Try again.';
          alert(errorMsg);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported in your browser.');
    }
  };

  const handleManualLocationSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates');
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Invalid coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180');
      return;
    }
    
    setSelectedLocation({ lat, lng });
    setShowReportForm(true);
    setManualLat('');
    setManualLng('');
  };

  const handleMapClick = (latlng) => {
    setSelectedLocation(latlng);
    setShowReportForm(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { alert('Photo must be under 10MB'); return; }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLocation) { alert('Please click on the map to select a location'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('latitude', selectedLocation.lat);
      formData.append('longitude', selectedLocation.lng);
      formData.append('description', reportData.description);
      formData.append('riskLevel', reportData.riskLevel);
      if (reporterName.trim()) formData.append('reporterName', reporterName.trim());
      if (photoFile) formData.append('photo', photoFile);

      await apiClient.post(`/report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Hotspot reported successfully! Thank you for helping your community.');
      setShowReportForm(false);
      setSelectedLocation(null);
      setReportData({ description: '', riskLevel: 'medium' });
      setReporterName('');
      removePhoto();
      setPage(1);
      fetchHotspots();
      window.dispatchEvent(new Event('leaderboardUpdated'));
    } catch (error) {
      console.error('Error reporting hotspot:', error);
      alert('Failed to report hotspot. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (hotspotId, newStatus) => {
    try {
      await apiClient.patch(`/hotspots/${hotspotId}`, { status: newStatus });
      fetchHotspots();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update hotspot status.');
    }
  };

  const handleDelete = async (hotspotId) => {
    if (!window.confirm('Are you sure you want to delete this hotspot report?')) return;
    try {
      await apiClient.delete(`/hotspots/${hotspotId}`);
      fetchHotspots();
    } catch (error) {
      console.error('Error deleting hotspot:', error);
      alert('Failed to delete hotspot.');
    }
  };

  const toggleNearbySearch = () => {
    if (nearbyActive) {
      setNearbyActive(false);
      setNearbyRadius('');
      setPage(1);
    } else {
      if (!nearbyRadius) setNearbyRadius('5');
      setNearbyActive(true);
      setPage(1);
    }
  };

  const statusLabel = (status) => {
    const labels = { reported: 'Reported', investigating: 'Investigating', resolved: 'Resolved' };
    return labels[status] || status;
  };

  return (
    <div className="hotspot-map-container">
      <div className="hotspot-card">
        <div className="hotspot-header">
          <h2>Neighborhood Hotspots</h2>
          <p>Report and view mosquito breeding hotspots in your area</p>
        </div>

        <div className="hotspot-tabs">
          <button
            className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            Map
          </button>
          <button
            className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 Leaderboard
          </button>
        </div>

        {activeTab === 'map' && (
          <>
            <div className="map-instructions">
              <p>Click on the map to report a new hotspot</p>
              <button className="use-location-btn" onClick={handleRequestLocation}>
                📍 Use My Current Location
              </button>
              <p className="hotspot-count">Total hotspots: {totalCount}</p>
            </div>

            <div className="hotspot-filters">
              <div className="filter-group">
                <label>Risk:</label>
                <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟠 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Status:</label>
                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  <option value="reported">Reported</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="filter-group nearby-group">
                <label>Nearby:</label>
                <input type="number" placeholder="km" value={nearbyRadius} onChange={(e) => setNearbyRadius(e.target.value)} min="1" max="100" className="nearby-input" />
                <button className={`nearby-btn ${nearbyActive ? 'active' : ''}`} onClick={toggleNearbySearch}>
                  {nearbyActive ? '✕ Clear' : '🔍 Search'}
                </button>
              </div>
            </div>

            <div className="manual-location-form">
              <h4>Or Manually Enter Coordinates:</h4>
              <div className="manual-input-group">
                <input
                  type="number"
                  placeholder="Latitude (-90 to 90)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  step="0.0001"
                  min="-90"
                  max="90"
                  className="manual-input"
                />
                <input
                  type="number"
                  placeholder="Longitude (-180 to 180)"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  step="0.0001"
                  min="-180"
                  max="180"
                  className="manual-input"
                />
                <button onClick={handleManualLocationSubmit} className="manual-submit-btn">
                  Use Location
                </button>
              </div>
            </div>

            {mapError && (
              <div className="error-message">
                {mapError}
              </div>
            )}

            {tileErrorMsg && (
              <div className="tile-error-message">
                🔴 {tileErrorMsg}
              </div>
            )}

            {loading ? (
              <div className="loading-message">⏳ Loading map and hotspots...</div>
            ) : (
              <>
                <div className="map-wrapper">
              <MapContainer
                center={userLocation}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                maxBounds={[
                  [8.0, 68.0],
                  [35.0, 97.0]
                ]}
                maxBoundsViscosity={0.8}
              >
                <TileLayer
                  url={tileUrl}
                  attribution="&copy; OpenStreetMap contributors"
                  maxZoom={19}
                  tileSize={256}
                  crossOrigin="anonymous"
                  errorTileUrl="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23c0392b' font-size='14'%3ETile Error%3C/text%3E%3C/svg%3E"
                  eventHandlers={{
                    tileerror: (error) => {
                      if (!tileError) {
                        setTileError(true);
                        setTileErrorMsg('OpenStreetMap tiles blocked. Switching to CartoDB...');
                        setTileUrl('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png');
                      }
                    }
                  }}
                />
                <MapCenterController center={mapCenter} zoom={mapZoom} />
                <LocationMarker onLocationSelect={handleMapClick} />
                
                <Marker position={userLocation} icon={currentLocationIcon}>
                  <Popup>
                    <div className="popup-content">
                      <strong>📍 Your Location</strong>
                      <p>Lat: {userLocation[0].toFixed(4)}, Lng: {userLocation[1].toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>

                {hotspots.map((hotspot) => (
                  <Marker key={hotspot.id} position={[hotspot.latitude, hotspot.longitude]} icon={getMarkerIcon(hotspot)}>
                    <Popup maxWidth={280} minWidth={200}>
                      <div className="popup-content popup-rich">
                        <div className={`popup-risk-badge risk-${hotspot.riskLevel}`}>
                          {hotspot.riskLevel.toUpperCase()} RISK
                        </div>
                        <div className="popup-status">{statusLabel(hotspot.status)}</div>
                        {hotspot.description && <p className="popup-description">{hotspot.description}</p>}
                        {hotspot.photoUrl && (
                          <img
                            src={hotspot.photoUrl.startsWith('http') ? hotspot.photoUrl : hotspot.photoUrl}
                            alt="Hotspot"
                            className="popup-photo"
                            onClick={() => window.open(hotspot.photoUrl.startsWith('http') ? hotspot.photoUrl : hotspot.photoUrl, '_blank')}
                          />
                        )}
                        <p className="popup-reporter">By: {hotspot.reporterName}</p>
                        <p className="popup-date">{new Date(hotspot.reportedAt).toLocaleDateString()}</p>
                        <div className="popup-actions">
                          {hotspot.status === 'reported' && (
                            <button className="popup-btn investigating" onClick={() => handleStatusUpdate(hotspot.id, 'investigating')}>Investigate</button>
                          )}
                          {(hotspot.status === 'reported' || hotspot.status === 'investigating') && (
                            <button className="popup-btn resolved" onClick={() => handleStatusUpdate(hotspot.id, 'resolved')}>Resolve</button>
                          )}
                          {isAuthenticated && user && (user.role === 'admin' || (hotspot.reportedBy && hotspot.reportedBy === user.id)) && (
                            <button className="popup-btn delete" onClick={() => handleDelete(hotspot.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {totalPages > 1 && (
              <div className="hotspot-pagination">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
                <span className="page-info">Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
              </div>
            )}

            {hotspots.length === 0 && (
              <div className="error-message">
                No hotspots found. {nearbyActive ? 'Try a larger radius.' : 'Be the first to help your community!'}
              </div>
            )}

            {showReportForm && selectedLocation && (
              <div className="report-form-overlay">
                <div className="report-form">
                  <h3>📌 Report Hotspot</h3>
                  <form onSubmit={handleReportSubmit}>
                    <div className="form-group">
                      <label>Location:</label>
                      <p className="location-info">
                        {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Risk Level:</label>
                      <select value={reportData.riskLevel} onChange={(e) => setReportData({ ...reportData, riskLevel: e.target.value })} className="risk-select">
                        <option value="low">🟢 Low — Minor water accumulation</option>
                        <option value="medium">🟠 Medium — Visible stagnant water</option>
                        <option value="high">🔴 High — Large breeding site</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Reporter Name (optional):</label>
                      <input type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} placeholder="Your name (optional)" className="reporter-input" />
                    </div>

                    <div className="form-group">
                      <label>Description (optional):</label>
                      <textarea value={reportData.description} onChange={(e) => setReportData({ ...reportData, description: e.target.value })} placeholder="e.g., Stagnant water near park, old tyres in vacant lot..." rows="3" maxLength={500} />
                      <span className="char-count">{reportData.description.length}/500</span>
                    </div>

                    <div className="form-group">
                      <label>📷 Photo Evidence (optional):</label>
                      <div className="photo-upload-area">
                        {photoPreview ? (
                          <div className="photo-preview-container">
                            <img src={photoPreview} alt="Preview" className="photo-preview" />
                            <button type="button" className="photo-remove-btn" onClick={removePhoto}>✕</button>
                          </div>
                        ) : (
                          <div className="photo-dropzone" onClick={() => fileInputRef.current?.click()}>
                            <span className="dropzone-icon">📸</span>
                            <span className="dropzone-text">Click to add photo</span>
                            <span className="dropzone-hint">JPEG, PNG, WebP — max 10MB</span>
                          </div>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="submit-button" disabled={submitting}>
                        {submitting ? '⏳ Submitting...' : '📌 Report Hotspot'}
                      </button>
                      <button type="button" onClick={() => { setShowReportForm(false); setSelectedLocation(null); removePhoto(); }} className="cancel-button">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="hotspot-legend">
              <h4>Legend:</h4>
              <div className="legend-items">
                <span><span className="legend-dot" style={{ background: '#4caf50' }}></span> Low Risk</span>
                <span><span className="legend-dot" style={{ background: '#ff9800' }}></span> Medium Risk</span>
                <span><span className="legend-dot" style={{ background: '#f44336' }}></span> High Risk</span>
                <span><span className="legend-dot" style={{ background: '#9e9e9e' }}></span> Resolved</span>
              </div>
            </div>
              </>
            )}
          </>
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard />
        )}
      </div>
    </div>
  );
}

export default HotspotMap;
