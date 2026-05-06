import redis from './redis';

export async function incrementMetric(key: string, field: 'success' | 'failure' | 'tokens') {
  const dateKey = `metrics:${new Date().toISOString().split('T')[0]}`;
  const fullKey = `${dateKey}:${key}`;

  await redis.hincrby(fullKey, field, 1);
  await redis.expire(dateKey, 48 * 60 * 60); // 48 hours
}

export async function getQueueLength(): Promise<number> {
  return await redis.llen('request_queue');
}
