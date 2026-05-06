import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || typeof password !== 'string') {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const passwordHash = createHash('sha256').update(password).digest();
    const adminHash = createHash('sha256').update(adminPassword).digest();

    if (timingSafeEqual(passwordHash, adminHash)) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
}
