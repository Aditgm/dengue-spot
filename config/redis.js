const Redis = require('ioredis');

const commonOpts = {
  db: 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false
};

const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      ...commonOpts,
      tls: process.env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
    })
  : new Redis({
      ...commonOpts,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    });

redisClient.on('ready', () => console.log('✅ Redis connected'));
redisClient.on('error', (err) => console.error('❌ Redis error:', err.message || err.code || err));

module.exports = redisClient;
