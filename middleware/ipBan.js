const BannedIp = require('../models/BannedIp');
let cachedBannedIps = new Set();
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

async function refreshCache() {
  try {
    const banned = await BannedIp.find({}, 'ip').lean();
    cachedBannedIps = new Set(banned.map(b => b.ip));
    lastCacheTime = Date.now();
  } catch (err) {
    console.error('Failed to refresh banned IP cache:', err.message);
  }
}

const checkBannedIp = async (req, res, next) => {
  try {
    if (Date.now() - lastCacheTime > CACHE_TTL) {
      await refreshCache();
    }

    const clientIp = req.ip || req.connection?.remoteAddress || '';

    if (cachedBannedIps.has(clientIp)) {
      const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'arajsinha4@gmail.com').toLowerCase();
      if (req.path === '/login' && req.body && req.body.email && req.body.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Your IP address has been banned. Contact administrator.'
      });
    }

    next();
  } catch (error) {
    next();
  }
};
module.exports = { checkBannedIp, refreshCache };
