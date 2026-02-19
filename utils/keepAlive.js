const http = require('http');

/**
 * Keep-Alive Service - Prevents Render free tier from sleeping
 * Pings the server every 25 minutes to keep it awake
 */

function keepServerAlive() {
  const port = process.env.PORT || 5000;
  const url = `http://localhost:${port}`;
  
  // Ping every 25 minutes (1500000 ms)
  // Render free tier puts apps to sleep after 15 min of inactivity
  const pingInterval = 25 * 60 * 1000;

  setInterval(() => {
    http.get(url, (res) => {
      console.log(`✅ Keep-alive ping sent at ${new Date().toLocaleTimeString()}`);
    }).on('error', (err) => {
      console.error(`⚠️  Keep-alive ping failed: ${err.message}`);
    });
  }, pingInterval);

  console.log('🔄 Keep-alive service started (pings every 25 minutes)');
}

module.exports = keepServerAlive;
