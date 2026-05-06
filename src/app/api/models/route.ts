import { NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/settings';

async function getAvailableKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.length === 0) return null;
  // Pick random key for models list to avoid hammering first key
  return keys[Math.floor(Math.random() * keys.length)];
}

export async function GET() {
  const key = await getAvailableKey();
  if (!key) return NextResponse.json({ data: [] });

  try {
    const response = await fetch('https://api.airforce/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Upstream models API error: ${response.status}`);
      return NextResponse.json({ error: "Failed to fetch models from upstream" }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Models fetch failed:", err);
    return NextResponse.json({ data: [] });
  }
}
