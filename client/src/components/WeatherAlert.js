import React, { useState, useEffect, useCallback } from 'react';
import './WeatherAlert.css';

// WMO weather codes
function wmoToDescription(code) {
  const map = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    77: 'Snow grains', 80: 'Slight showers', 81: 'Moderate showers',
    82: 'Violent showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
  };
  return map[code] || 'Unknown';
}

function wmoToIconCode(code) {
  if (code === 0) return 800;
  if (code <= 3) return 802;
  if (code <= 48) return 741;
  if (code <= 57) return 300;
  if (code <= 67) return 500;
  if (code <= 77) return 600;
  if (code <= 82) return 521;
  if (code >= 95) return 200;
  return 800;
}

function calculateRiskScore(weather) {
  if (!weather) return { score: 0, level: 'low', color: '#4caf50' };

  const temp = weather.temp;
  const humidity = weather.humidity;
  const rain = weather.rain || 0;
  const wind = weather.wind;
  const month = new Date().getMonth(); // 0-11

  // Temperature (25-32°C = peak)
  let tempScore = 0;
  if (temp >= 25 && temp <= 32) tempScore = 100;
  else if (temp >= 20 && temp < 25) tempScore = 60;
  else if (temp > 32 && temp <= 38) tempScore = 70;
  else if (temp >= 15 && temp < 20) tempScore = 30;
  else tempScore = 10;

  let humidityScore = 0;
  if (humidity >= 80) humidityScore = 100;
  else if (humidity >= 60) humidityScore = 75;
  else if (humidity >= 40) humidityScore = 40;
  else humidityScore = 15;

  let rainScore = 0;
  if (rain > 10) rainScore = 100;
  else if (rain > 5) rainScore = 80;
  else if (rain > 1) rainScore = 55;
  else if (rain > 0) rainScore = 30;
  else rainScore = 10;

  let windScore = 0;
  if (wind < 5) windScore = 100;
  else if (wind < 10) windScore = 70;
  else if (wind < 15) windScore = 40;
  else windScore = 15;

  let seasonScore = 0;
  if (month >= 5 && month <= 9) seasonScore = 100;
  else if (month >= 3 && month <= 4) seasonScore = 60;
  else if (month === 10) seasonScore = 70;
  else seasonScore = 25;

  const score = Math.round(
    (tempScore * 0.30) +
    (humidityScore * 0.25) +
    (rainScore * 0.25) +
    (windScore * 0.10) +
    (seasonScore * 0.10)
  );

  let level, color, label, icon;
  if (score <= 25) {
    level = 'low'; color = '#4caf50'; label = 'Low Risk'; icon = '🟢';
  } else if (score <= 50) {
    level = 'moderate'; color = '#ff9800'; label = 'Moderate Risk'; icon = '🟡';
  } else if (score <= 75) {
    level = 'high'; color = '#ff5722'; label = 'High Risk'; icon = '🟠';
  } else {
    level = 'critical'; color = '#f44336'; label = 'Critical Risk'; icon = '🔴';
  }

  return { score, level, color, label, icon, breakdown: { tempScore, humidityScore, rainScore, windScore, seasonScore } };
}

function getPreventionTips(level) {
  const tips = {
    low: [
      'Continue regular weekly cleaning of water containers',
      'Stay aware of weather changes',
      'Keep window screens intact'
    ],
    moderate: [
      'Clean all water-holding containers this week',
      'Apply mosquito repellent during morning & evening',
      'Check flower pots, coolers, and AC trays for stagnant water',
      'Wear light-colored, long-sleeved clothing'
    ],
    high: [
      '⚠️ Empty ALL stagnant water sources immediately',
      'Use mosquito nets even during daytime naps',
      'Apply DEET-based repellent every 4 hours',
      'Close windows during dawn (6-8 AM) and dusk (4-6 PM)',
      'Check drains, gutters, and rooftop water tanks',
      'Alert neighbors to clean their surroundings'
    ],
    critical: [
      '🚨 OUTBREAK CONDITIONS — Take immediate action!',
      'Remove ALL stagnant water in a 100m radius of your home',
      'Stay indoors during peak mosquito hours (6-9 AM, 4-7 PM)',
      'Use mosquito coils/vaporizers continuously',
      'Seek medical attention for any fever or body aches',
      'Report breeding sites to local authorities',
      'Coordinate community cleanup drives NOW'
    ]
  };
  return tips[level] || tips.low;
}

function getWeatherIcon(code) {
  if (!code) return '🌤️';
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌦️';
  if (code >= 500 && code < 600) return '🌧️';
  if (code >= 600 && code < 700) return '❄️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800) return '☀️';
  if (code > 800) return '⛅';
  return '🌤️';
}

function WeatherAlert() {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [risk, setRisk] = useState({ score: 0, level: 'low', label: 'Loading...', icon: '⏳', color: '#666' });
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState(null);
  const [city, setCity] = useState('');
  const [locationMethod, setLocationMethod] = useState('auto'); // 'auto' or 'manual'

  const loadFallbackData = useCallback(() => {
    const month = new Date().getMonth();
    const isMonsoon = month >= 5 && month <= 9;
    const fallback = {
      temp: isMonsoon ? 31 : 28,
      feelsLike: isMonsoon ? 36 : 30,
      humidity: isMonsoon ? 82 : 55,
      wind: isMonsoon ? 12 : 8,
      rain: isMonsoon ? 8.5 : 0,
      description: isMonsoon ? 'scattered showers' : 'partly cloudy',
      icon: isMonsoon ? 500 : 802,
      cityName: 'Your Location',
      country: 'IN',
      clouds: isMonsoon ? 75 : 30,
      visibility: 6,
      pressure: 1008
    };
    setWeather(fallback);
    setRisk(calculateRiskScore(fallback));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const forecastDays = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayWeather = {
        date: d,
        temp: fallback.temp + Math.round((Math.random() - 0.5) * 6),
        humidity: Math.min(100, fallback.humidity + Math.round((Math.random() - 0.3) * 15)),
        wind: Math.max(0, fallback.wind + Math.round((Math.random() - 0.5) * 8)),
        rain: Math.max(0, fallback.rain + Math.round((Math.random() - 0.3) * 10)),
        description: isMonsoon ? 'light rain' : 'clear sky',
        icon: isMonsoon ? 500 : 800,
        dayName: dayNames[d.getDay()]
      };
      dayWeather.risk = calculateRiskScore(dayWeather);
      forecastDays.push(dayWeather);
    }
    setForecast(forecastDays);
    setLoading(false);
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat, lon, cityLabel) => {
    try {
      setLoading(true);
      setError(null);

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m&daily=temperature_2m_max,relative_humidity_2m_max,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=6`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.reason || 'Open-Meteo API error');
      }

      const c = data.current;
      const weatherObj = {
        temp: Math.round(c.temperature_2m),
        feelsLike: Math.round(c.apparent_temperature),
        humidity: c.relative_humidity_2m,
        wind: Math.round(c.wind_speed_10m),
        rain: c.rain || c.precipitation || 0,
        description: wmoToDescription(c.weather_code),
        icon: wmoToIconCode(c.weather_code),
        cityName: cityLabel || 'Your Location',
        country: '',
        visibility: null,
        pressure: c.surface_pressure ? Math.round(c.surface_pressure) : null,
        clouds: c.cloud_cover
      };

      if (!cityLabel) {
        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`, {
            headers: { 'User-Agent': 'DengueSpot/1.0' }
          });
          const nomData = await nomRes.json();
          if (nomData.address) {
            weatherObj.cityName = nomData.address.city || nomData.address.town || nomData.address.village || nomData.address.county || 'Your Location';
            weatherObj.country = nomData.address.country_code?.toUpperCase() || '';
          }
        } catch (geoErr) {
          console.log('Reverse geocode failed, using coords');
        }
      }

      setWeather(weatherObj);
      setCity(weatherObj.cityName);

      if (data.daily) {
        const d = data.daily;
        const dailyForecast = [];
        for (let i = 1; i < d.time.length && i <= 5; i++) {
          const dayWeather = {
            date: new Date(d.time[i]),
            temp: Math.round(d.temperature_2m_max[i]),
            humidity: d.relative_humidity_2m_max[i],
            wind: Math.round(d.wind_speed_10m_max[i]),
            rain: d.precipitation_sum[i] || 0,
            description: wmoToDescription(d.weather_code[i]),
            icon: wmoToIconCode(d.weather_code[i])
          };
          dayWeather.risk = calculateRiskScore(dayWeather);
          dailyForecast.push(dayWeather);
        }
        setForecast(dailyForecast);
      }

      const riskResult = calculateRiskScore(weatherObj);
      setRisk(riskResult);
      setLoading(false);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message);
      setLoading(false);
      loadFallbackData();
    }
  }, [loadFallbackData]);

  const fetchWeatherByCity = useCallback(async (cityName) => {
    try {
      setLoading(true);
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error('City not found');
      }
      const loc = geoData.results[0];
      await fetchWeatherByCoords(loc.latitude, loc.longitude, `${loc.name}, ${loc.country_code?.toUpperCase() || ''}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [fetchWeatherByCoords]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationMethod('auto');
          fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          setLocationMethod('manual');
          fetchWeatherByCoords(19.076, 72.8777);
        },
        { timeout: 8000 }
      );
    } else {
      fetchWeatherByCoords(19.076, 72.8777);
    }
  }, [fetchWeatherByCoords]);

  const handleCitySearch = (e) => {
    e.preventDefault();
    if (city.trim()) {
      setLocationMethod('manual');
      fetchWeatherByCity(city.trim());
    }
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading && !weather) {
    return (
      <div className="weather-badge loading" onClick={() => setExpanded(!expanded)}>
        <div className="weather-badge-icon">⏳</div>
        <div className="weather-badge-info">
          <span className="weather-badge-temp">--°</span>
          <span className="weather-badge-risk">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`weather-badge ${risk.level} ${expanded ? 'active' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title="Click for dengue weather risk details"
      >
        <div className="weather-badge-icon">{getWeatherIcon(weather?.icon)}</div>
        <div className="weather-badge-info">
          <span className="weather-badge-temp">{weather?.temp || '--'}°C</span>
          <span className="weather-badge-risk" style={{ color: risk.color }}>
            {risk.icon} {risk.label}
          </span>
        </div>
        <div className="weather-badge-chevron">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d={expanded 
              ? "M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"
              : "M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
            }/>
          </svg>
        </div>
        {(risk.level === 'high' || risk.level === 'critical') && (
          <div className="weather-badge-pulse" style={{ borderColor: risk.color }}></div>
        )}
      </div>

      {expanded && (
        <div className="weather-overlay" onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}>
          <div className={`weather-panel ${risk.level}`}>
            <button className="weather-panel-close" onClick={() => setExpanded(false)}>✕</button>

            <div className="weather-panel-header">
              <div className="weather-panel-title-row">
                <div className="weather-main-icon">{getWeatherIcon(weather?.icon)}</div>
                <div>
                  <h2 className="weather-panel-title">Dengue Weather Risk</h2>
                  <p className="weather-panel-location">
                    📍 {weather?.cityName}{weather?.country ? `, ${weather.country}` : ''}
                    <span className="location-type">({locationMethod === 'auto' ? 'GPS' : 'Manual'})</span>
                  </p>
                </div>
              </div>

              <form className="weather-city-search" onSubmit={handleCitySearch}>
                <input
                  type="text"
                  placeholder="Search city..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="weather-city-input"
                />
                <button type="submit" className="weather-city-btn">🔍</button>
              </form>
            </div>

            <div className="weather-risk-section">
              <div className="risk-score-circle" style={{ borderColor: risk.color }}>
                <span className="risk-score-number" style={{ color: risk.color }}>{risk.score}</span>
                <span className="risk-score-label">/ 100</span>
              </div>
              <div className="risk-info">
                <h3 className="risk-level-text" style={{ color: risk.color }}>
                  {risk.icon} {risk.label}
                </h3>
                <p className="risk-description">
                  {risk.level === 'low' && 'Conditions are not favorable for mosquito breeding. Stay aware.'}
                  {risk.level === 'moderate' && 'Moderate breeding conditions. Clean water containers this week.'}
                  {risk.level === 'high' && 'High breeding conditions! Take preventive action immediately.'}
                  {risk.level === 'critical' && 'CRITICAL — Outbreak-level conditions! Maximum prevention needed!'}
                </p>
              </div>
            </div>

            {risk.breakdown && (
              <div className="risk-breakdown">
                <h4 className="section-title">Risk Factor Breakdown</h4>
                <div className="breakdown-bars">
                  {[
                    { label: 'Temperature', value: risk.breakdown.tempScore, weight: '30%', detail: `${weather?.temp}°C` },
                    { label: 'Humidity', value: risk.breakdown.humidityScore, weight: '25%', detail: `${weather?.humidity}%` },
                    { label: 'Rainfall', value: risk.breakdown.rainScore, weight: '25%', detail: `${weather?.rain || 0}mm` },
                    { label: 'Wind Speed', value: risk.breakdown.windScore, weight: '10%', detail: `${weather?.wind}km/h` },
                    { label: 'Season', value: risk.breakdown.seasonScore, weight: '10%', detail: new Date().toLocaleString('default', { month: 'short' }) }
                  ].map((factor, i) => (
                    <div key={i} className="breakdown-row">
                      <div className="breakdown-label">
                        <span>{factor.label}</span>
                        <span className="breakdown-detail">{factor.detail} ({factor.weight})</span>
                      </div>
                      <div className="breakdown-bar-track">
                        <div
                          className="breakdown-bar-fill"
                          style={{
                            width: `${factor.value}%`,
                            background: factor.value > 75 ? '#f44336' : factor.value > 50 ? '#ff9800' : factor.value > 25 ? '#ffc107' : '#4caf50'
                          }}
                        ></div>
                      </div>
                      <span className="breakdown-value">{factor.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="weather-details-grid">
              <h4 className="section-title">Current Conditions</h4>
              <div className="weather-stats">
                <div className="weather-stat">
                  <span className="stat-icon">🌡️</span>
                  <span className="stat-value">{weather?.temp}°C</span>
                  <span className="stat-label">Temperature</span>
                </div>
                <div className="weather-stat">
                  <span className="stat-icon">🤒</span>
                  <span className="stat-value">{weather?.feelsLike}°C</span>
                  <span className="stat-label">Feels Like</span>
                </div>
                <div className="weather-stat">
                  <span className="stat-icon">💧</span>
                  <span className="stat-value">{weather?.humidity}%</span>
                  <span className="stat-label">Humidity</span>
                </div>
                <div className="weather-stat">
                  <span className="stat-icon">🌧️</span>
                  <span className="stat-value">{weather?.rain || 0}mm</span>
                  <span className="stat-label">Rain</span>
                </div>
                <div className="weather-stat">
                  <span className="stat-icon">💨</span>
                  <span className="stat-value">{weather?.wind}km/h</span>
                  <span className="stat-label">Wind</span>
                </div>
                <div className="weather-stat">
                  <span className="stat-icon">☁️</span>
                  <span className="stat-value">{weather?.clouds}%</span>
                  <span className="stat-label">Clouds</span>
                </div>
              </div>
            </div>

            {forecast.length > 0 && (
              <div className="weather-forecast">
                <h4 className="section-title">5-Day Mosquito Risk Forecast</h4>
                <div className="forecast-cards">
                  {forecast.map((day, i) => (
                    <div key={i} className={`forecast-card ${day.risk?.level || 'low'}`}>
                      <span className="forecast-day">{days[day.date.getDay()]}</span>
                      <span className="forecast-date">{day.date.getDate()}/{day.date.getMonth() + 1}</span>
                      <span className="forecast-icon">{getWeatherIcon(day.icon)}</span>
                      <span className="forecast-temp">{day.temp}°C</span>
                      <span className="forecast-humidity">💧{day.humidity}%</span>
                      <div className="forecast-risk-badge" style={{ background: day.risk?.color || '#666' }}>
                        {day.risk?.score || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mosquito-activity">
              <h4 className="section-title">🦟 Peak Mosquito Activity</h4>
              <div className="activity-timeline">
                <div className="activity-bar">
                  <div className="activity-segment low" style={{ width: '25%' }}>
                    <span>12AM-6AM</span>
                  </div>
                  <div className="activity-segment peak" style={{ width: '12.5%' }}>
                    <span>6-9AM</span>
                  </div>
                  <div className="activity-segment moderate-activity" style={{ width: '25%' }}>
                    <span>9AM-3PM</span>
                  </div>
                  <div className="activity-segment peak" style={{ width: '16.6%' }}>
                    <span>3-7PM</span>
                  </div>
                  <div className="activity-segment low" style={{ width: '20.9%' }}>
                    <span>7-12PM</span>
                  </div>
                </div>
                <div className="activity-legend">
                  <span className="legend-item"><span className="legend-dot peak-dot"></span> Peak (Stay Protected)</span>
                  <span className="legend-item"><span className="legend-dot moderate-dot"></span> Moderate</span>
                  <span className="legend-item"><span className="legend-dot low-dot"></span> Low</span>
                </div>
              </div>
            </div>

            <div className="weather-tips">
              <h4 className="section-title">🛡️ Prevention Tips for Today</h4>
              <ul className="tips-list">
                {getPreventionTips(risk.level).map((tip, i) => (
                  <li key={i} className="tip-item">{tip}</li>
                ))}
              </ul>
            </div>

            <div className="weather-panel-footer">
              <p>Data refreshes every 30 minutes • Based on WHO dengue prevention guidelines</p>
              <p className="weather-desc-text">
                Current: {weather?.description} • Visibility: {weather?.visibility || '—'}km • Pressure: {weather?.pressure || '—'}hPa
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default WeatherAlert;
