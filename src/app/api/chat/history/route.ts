import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json([]);

  const history = await redis.get(`chat_history:${sessionId}`);
  return NextResponse.json(history ? JSON.parse(history) : []);
}

export async function POST(req: NextRequest) {
  const { sessionId, messages } = await req.json();
  if (!sessionId) return NextResponse.json({ success: false });

  await redis.set(`chat_history:${sessionId}`, JSON.stringify(messages), 'EX', 3600);
  return NextResponse.json({ success: true });
}
