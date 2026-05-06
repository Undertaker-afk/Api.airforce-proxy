import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.response;

  return NextResponse.json({
    appEndpoint: process.env.APP_ENDPOINT || 'http://localhost:3000'
  });
}
