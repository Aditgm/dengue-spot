const BannedIp = require('../models/BannedIp');
let cachedBannedIps = new Set();
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000;

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
