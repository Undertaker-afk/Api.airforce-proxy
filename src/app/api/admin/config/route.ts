import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    appEndpoint: process.env.APP_ENDPOINT || 'http://localhost:3000'
  });
}
