import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json([]);

  try {
    const history = await redis.get(`chat_history:${sessionId}`);
    return NextResponse.json(history ? JSON.parse(history) : []);
  } catch (err) {
    console.error("Failed to parse chat history:", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, messages } = await req.json();
    if (!sessionId) return NextResponse.json({ success: false }, { status: 400 });

    // Limit history size to 50 messages, and total size to ~100kb
    const trimmedMessages = messages.slice(-50);
    const serialized = JSON.stringify(trimmedMessages);
    if (serialized.length > 102400) {
       return NextResponse.json({ error: "Chat history too large" }, { status: 400 });
    }

    await redis.set(`chat_history:${sessionId}`, serialized, 'EX', 3600);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}
