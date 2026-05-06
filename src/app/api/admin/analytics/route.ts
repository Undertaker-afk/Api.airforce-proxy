import { NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { getApiKeys } from '@/lib/settings';

export async function GET() {
  const keys = await getApiKeys();
  const queueLength = await redis.llen('request_queue');

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const metrics: any = {};

  for (const key of keys) {
    const todayData = await redis.hgetall(`metrics:${today}:${key}`);
    const yesterdayData = await redis.hgetall(`metrics:${yesterday}:${key}`);

    metrics[key] = {
      today: todayData || { success: 0, failure: 0, tokens: 0 },
      yesterday: yesterdayData || { success: 0, failure: 0, tokens: 0 },
      isRateLimited: !!(await redis.get(`ratelimit:${key}`))
    };
  }

  return NextResponse.json({
    queueLength,
    metrics
  });
}
