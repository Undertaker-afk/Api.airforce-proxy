import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys, addApiKey, removeApiKey } from '@/lib/settings';

export async function GET() {
  const keys = await getApiKeys();
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const { key } = await req.json();
  await addApiKey(key);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { key } = await req.json();
  await removeApiKey(key);
  return NextResponse.json({ success: true });
}
