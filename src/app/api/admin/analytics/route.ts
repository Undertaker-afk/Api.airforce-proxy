import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { getApiKeys } from '@/lib/settings';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const keys = await getApiKeys();
  const queueLength = await redis.llen('request_queue');

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.hgetall(`metrics:${today}:${key}`);
    pipeline.hgetall(`metrics:${yesterday}:${key}`);
    pipeline.get(`ratelimit:${key}`);
  }

  const results = await pipeline.exec();
  const metrics: any = {};

  const normalize = (m: any) => ({
    success: parseInt(m?.success ?? '0', 10) || 0,
    failure: parseInt(m?.failure ?? '0', 10) || 0,
    tokens: parseInt(m?.tokens ?? '0', 10) || 0,
  });

  keys.forEach((key, i) => {
    const todayData = results?.[i * 3]?.[1];
    const yesterdayData = results?.[i * 3 + 1]?.[1];
    const rateLimited = results?.[i * 3 + 2]?.[1];

    metrics[key] = {
      today: normalize(todayData),
      yesterday: normalize(yesterdayData),
      isRateLimited: !!rateLimited
    };
  });

  return NextResponse.json({
    queueLength,
    metrics
  });
}
