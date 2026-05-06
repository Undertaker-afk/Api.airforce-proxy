import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { getApiKeys, getSettings } from '@/lib/settings';
import { incrementMetric } from '@/lib/metrics';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

const QUEUE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

async function getAvailableKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.length === 0) return null;

  for (const key of keys) {
    const lastUsed = await redis.get(`ratelimit:${key}`);
    if (!lastUsed) {
      // Key is available (1 RPM limit)
      await redis.set(`ratelimit:${key}`, '1', 'PX', 60000);
      return key;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await getSettings();
    const requestId = uuidv4();

    // Check queue size
    const queueLength = await redis.llen('request_queue');
    if (queueLength >= settings.maxQueueSize) {
      return NextResponse.json({ error: { message: "Queue is full. Please contact admin.", type: "rate_limit_exceeded" } }, { status: 429 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now();
        let key = await getAvailableKey();

        if (!key) {
          // Add to queue
          await redis.rpush('request_queue', requestId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Waiting for an available API key... You are in queue." }, index: 0 }] })}\n\n`));

          while (!key) {
            if (Date.now() - startTime > QUEUE_TIMEOUT) {
              await redis.lrem('request_queue', 0, requestId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Request timed out in queue. Please contact admin." })}\n\n`));
              controller.close();
              return;
            }

            // Check if it's our turn
            const nextInQueue = await redis.lindex('request_queue', 0);
            if (nextInQueue === requestId) {
              key = await getAvailableKey();
              if (key) {
                await redis.lpop('request_queue');
              }
            }

            if (!key) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        try {
          const response = await fetch('https://api.airforce/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const error = await response.text();
            incrementMetric(key, 'failure');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Airforce API error: " + error })}\n\n`));
            controller.close();
            return;
          }

          if (body.stream) {
            const reader = response.body?.getReader();
            if (!reader) throw new Error("No reader");

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            incrementMetric(key, 'success');
          } else {
            const data = await response.json();
            incrementMetric(key, 'success');
            controller.enqueue(encoder.encode(JSON.stringify(data)));
          }
        } catch (err: any) {
          if (key) incrementMetric(key, 'failure');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': body.stream ? 'text/event-stream' : 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
