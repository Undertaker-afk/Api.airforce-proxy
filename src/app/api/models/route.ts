import { NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/settings';

export async function GET() {
  const keys = await getApiKeys();
  if (keys.length === 0) return NextResponse.json({ data: [] });

  try {
    const response = await fetch('https://api.airforce/v1/models', {
      headers: { 'Authorization': `Bearer ${keys[0]}` }
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ data: [] });
  }
}
