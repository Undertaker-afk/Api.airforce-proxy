import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const globalForRedis = global as unknown as { redis: Redis };

const redis = globalForRedis.redis || new Redis(redisUrl, {
  maxRetriesPerRequest: 20
});

redis.on('error', (err) => {
  console.error('[Redis Error]', err);
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export { redis };
export default redis;
