const redisClient = require('../config/redis');

const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 5,
    keyPrefix = 'rate_limit:',
    message = 'Too many requests. Please try again later.'
  } = options;

  return async (req, res, next) => {
    try {
      const identifier = req.ip || req.connection.remoteAddress || 'unknown';
      const key = `${keyPrefix}${identifier}`;

      const current = await redisClient.get(key);
      
      if (current && parseInt(current) >= max) {
        const ttl = await redisClient.ttl(key);
        const retryAfter = Math.ceil(ttl / 60);
        
        res.setHeader('Retry-After', ttl);
        return res.status(429).json({
          success: false,
          message: `${message} Try again in ${retryAfter} minute${retryAfter > 1 ? 's' : ''}.`,
          retryAfter: ttl
        });
      }

      const count = await redisClient.incr(key);
      
      if (count === 1) {
        await redisClient.expire(key, Math.floor(windowMs / 1000));
      }

      // Rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + Math.floor(windowMs / 1000));
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

module.exports = rateLimiter;
