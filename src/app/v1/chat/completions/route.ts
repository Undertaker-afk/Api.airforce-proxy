import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { getApiKeys, getSettings } from '@/lib/settings';
import { incrementMetric } from '@/lib/metrics';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

async function getAvailableKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.length === 0) return null;

  // Shuffle keys to distribute load
  const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

  for (const key of shuffledKeys) {
    // Atomic check and set using ioredis set options
    // @ts-ignore - ioredis types can be tricky with overloads
    const result = await redis.set(`ratelimit:${key}`, '1', 'PX', 60000, 'NX');
    if (result === 'OK') {
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
    const isStream = body.stream === true;

    // Check queue size
    const queueLength = await redis.llen('request_queue');
    if (queueLength >= settings.maxQueueSize) {
      return NextResponse.json({ error: { message: "Queue is full. Please contact admin.", type: "rate_limit_exceeded" } }, { status: 429 });
    }

    const encoder = new TextEncoder();

    if (isStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const startTime = Date.now();
          const QUEUE_TIMEOUT = 15 * 60 * 1000;
          let key = await getAvailableKey();

          if (!key) {
            await redis.rpush('request_queue', requestId);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Waiting for an available API key... You are in queue." }, index: 0 }] })}\n\n`));

            while (!key) {
              if (req.signal.aborted || Date.now() - startTime > QUEUE_TIMEOUT) {
                await redis.lrem('request_queue', 0, requestId);
                if (!req.signal.aborted) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Request timed out in queue." })}\n\n`));
                }
                controller.close();
                return;
              }

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
              signal: AbortSignal.timeout(60000),
            });

            if (!response.ok) {
              const error = await response.text();
              incrementMetric(key, 'failure').catch(console.error);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Airforce API error: " + error })}\n\n`));
              return;
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No reader");

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            incrementMetric(key, 'success').catch(console.error);
          } catch (err: unknown) {
            if (key) incrementMetric(key, 'failure').catch(console.error);
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming logic
      const startTime = Date.now();
      const QUEUE_TIMEOUT = 10 * 60 * 1000;
      let key = await getAvailableKey();

      if (!key) {
        await redis.rpush('request_queue', requestId);
        while (!key) {
          if (req.signal.aborted || Date.now() - startTime > QUEUE_TIMEOUT) {
            await redis.lrem('request_queue', 0, requestId);
            return NextResponse.json({ error: "Request timed out or aborted" }, { status: 504 });
          }
          const nextInQueue = await redis.lindex('request_queue', 0);
          if (nextInQueue === requestId) {
            key = await getAvailableKey();
            if (key) await redis.lpop('request_queue');
          }
          if (!key) await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const response = await fetch('https://api.airforce/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        incrementMetric(key, 'failure').catch(console.error);
        return NextResponse.json(await response.json(), { status: response.status });
      }

      const data = await response.json();
      incrementMetric(key, 'success', data.usage?.total_tokens || 1).catch(console.error);
      return NextResponse.json(data);
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
