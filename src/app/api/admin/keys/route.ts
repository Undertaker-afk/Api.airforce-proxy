import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys, addApiKey, removeApiKey } from '@/lib/settings';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const keys = await getApiKeys();
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { key } = await req.json();
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  await addApiKey(key);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { key } = await req.json();
  await removeApiKey(key);
  return NextResponse.json({ success: true });
}
