import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/settings';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const body = await req.json();

  // Validation
  const maxQueueSize = parseInt(body.maxQueueSize);
  if (isNaN(maxQueueSize) || maxQueueSize < 1 || maxQueueSize > 100) {
    return NextResponse.json({ error: "Invalid maxQueueSize" }, { status: 400 });
  }

  const updated = await updateSettings({ maxQueueSize });
  return NextResponse.json(updated);
}
