import { NextRequest, NextResponse } from 'next/server';

export async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return { authorized: false, response: NextResponse.json({ error: "Admin password not configured on server" }, { status: 500 }) };
  }

  // Simple token-based check for simplicity, or we could check a specific header
  // In our useAuth hook, we'll need to send this
  if (authHeader !== `Bearer ${adminPassword}`) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { authorized: true };
}
