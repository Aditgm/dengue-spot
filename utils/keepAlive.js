const http = require('http');


function keepServerAlive() {
  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL;
  if (!externalUrl) {
    console.log('⚠️  Keep-alive skipped: RENDER_EXTERNAL_URL or FRONTEND_URL is not set');
    return;
  }

  const url = externalUrl.endsWith('/') ? `${externalUrl}api/health` : `${externalUrl}/api/health`; // Render sleeps after 15 mins of inactivity. Ping every 14 mins.
  const pingInterval = 14 * 60 * 1000;

  setInterval(() => {
    const defaultProto = url.startsWith('https') ? require('https') : require('http');
    defaultProto.get(url, (res) => {
      console.log(`✅ Keep-alive ping sent to ${url} at ${new Date().toLocaleTimeString()}`);
    }).on('error', (err) => {
      console.error(`⚠️  Keep-alive ping failed: ${err.message}`);
    });
  }, pingInterval);

  console.log(`🔄 Keep-alive service started (pings ${url} every 14 minutes)`);
}

module.exports = keepServerAlive;
