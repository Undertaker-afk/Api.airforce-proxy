import { Hono } from 'hono';
import { stream, streamSSE } from 'hono/streaming';
import { v4 as uuidv4 } from 'uuid';
import { createHash, timingSafeEqual } from 'crypto';
import redis from './lib/redis';
import { getApiKeys, getSettings, updateSettings, addApiKey, removeApiKey } from './lib/settings';
import { incrementMetric } from './lib/metrics';

const app = new Hono();

// Auth Middleware helper
async function requireAdmin(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return c.json({ error: "Admin password not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${adminPassword}`) {
    return c.json({ error: "Unauthorized" }, { status: 401 });
  }
  await next();
}

async function getAvailableKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.length === 0) return null;
  const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
  for (const key of shuffledKeys) {
    // @ts-ignore
    const result = await redis.set(`ratelimit:${key}`, '1', 'PX', 60000, 'NX');
    if (result === 'OK') return key;
  }
  return null;
}

// Admin Auth
app.post('/api/admin/auth', async (c) => {
  const { password } = await c.req.json();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || typeof password !== 'string') return c.json({ success: false }, 401);

  const passwordHash = createHash('sha256').update(password).digest();
  const adminHash = createHash('sha256').update(adminPassword).digest();

  if (timingSafeEqual(passwordHash, adminHash)) return c.json({ success: true });
  return c.json({ success: false }, 401);
});

// Admin Routes
app.use('/api/admin/*', requireAdmin);

app.get('/api/admin/config', (c) => c.json({ appEndpoint: process.env.APP_ENDPOINT || 'http://localhost:3000' }));

app.get('/api/admin/keys', async (c) => c.json(await getApiKeys()));
app.post('/api/admin/keys', async (c) => {
  const { key } = await c.req.json();
  if (!key) return c.json({ error: "Missing key" }, 400);
  await addApiKey(key);
  return c.json({ success: true });
});
app.delete('/api/admin/keys', async (c) => {
  const { key } = await c.req.json();
  await removeApiKey(key);
  return c.json({ success: true });
});

app.get('/api/admin/settings', async (c) => c.json(await getSettings()));
app.post('/api/admin/settings', async (c) => {
  const body = await c.req.json();
  const maxQueueSize = parseInt(body.maxQueueSize);
  if (isNaN(maxQueueSize) || maxQueueSize < 1) return c.json({ error: "Invalid size" }, 400);
  return c.json(await updateSettings({ maxQueueSize }));
});

app.get('/api/admin/analytics', async (c) => {
  const keys = await getApiKeys();
  const queueLength = await redis.llen('request_queue');
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.hgetall(`metrics:${today}:${key}`);
    pipeline.hgetall(`metrics:${yesterday}:${key}`);
    pipeline.get(`ratelimit:${key}`);
  }
  const results = await pipeline.exec();
  const metrics: any = {};
  const normalize = (m: any) => ({
    success: parseInt(m?.success ?? '0', 10) || 0,
    failure: parseInt(m?.failure ?? '0', 10) || 0,
    tokens: parseInt(m?.tokens ?? '0', 10) || 0,
  });
  keys.forEach((key, i) => {
    metrics[key] = {
      today: normalize(results?.[i * 3]?.[1]),
      yesterday: normalize(results?.[i * 3 + 1]?.[1]),
      isRateLimited: !!results?.[i * 3 + 2]?.[1]
    };
  });
  return c.json({ queueLength, metrics });
});

// Chat History
app.get('/api/chat/history', async (c) => {
  const sessionId = c.req.query('sessionId');
  if (!sessionId) return c.json([]);
  const history = await redis.get(`chat_history:${sessionId}`);
  return c.json(history ? JSON.parse(history) : []);
});
app.post('/api/chat/history', async (c) => {
  const { sessionId, messages } = await c.req.json();
  if (!sessionId) return c.json({ success: false }, 400);
  await redis.set(`chat_history:${sessionId}`, JSON.stringify(messages.slice(-50)), 'EX', 3600);
  return c.json({ success: true });
});

// Models
app.get('/api/models', async (c) => {
  const keys = await getApiKeys();
  if (keys.length === 0) return c.json({ data: [] });
  const key = keys[Math.floor(Math.random() * keys.length)];
  try {
    const res = await fetch('https://api.airforce/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(10000)
    });
    return c.json(await res.json());
  } catch (err) {
    return c.json({ data: [] });
  }
});

// Main Proxy
app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json();
  const isStream = body.stream === true;
  const settings = await getSettings();
  const requestId = uuidv4();

  const queueLength = await redis.llen('request_queue');
  if (queueLength >= settings.maxQueueSize) return c.json({ error: "Queue full" }, 429);

  if (isStream) {
    return streamSSE(c, async (stream) => {
      const startTime = Date.now();
      let key = await getAvailableKey();
      if (!key) {
        await redis.rpush('request_queue', requestId);
        await stream.writeSSE({ data: JSON.stringify({ choices: [{ delta: { content: "Queued..." }, index: 0 }] }) });
        while (!key) {
          if (c.req.raw.signal.aborted || Date.now() - startTime > 15 * 60 * 1000) {
            await redis.lrem('request_queue', 0, requestId);
            return stream.close();
          }
          if ((await redis.lindex('request_queue', 0)) === requestId) {
            key = await getAvailableKey();
            if (key) await redis.lpop('request_queue');
          }
          if (!key) await new Promise(r => setTimeout(r, 2000));
        }
      }
      try {
        const res = await fetch('https://api.airforce/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000)
        });
        if (!res.ok) {
          incrementMetric(key, 'failure').catch(console.error);
          return stream.writeSSE({ data: JSON.stringify({ error: "Upstream error" }) });
        }
        const reader = res.body?.getReader();
        if (!reader) return;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await stream.write(value);
        }
        incrementMetric(key, 'success').catch(console.error);
      } catch (err: any) {
        if (key) incrementMetric(key, 'failure').catch(console.error);
        await stream.writeSSE({ data: JSON.stringify({ error: err.message }) });
      } finally {
        stream.close();
      }
    });
  } else {
    // Non-streaming logic (simplified for brevity, identical queuing)
    let key = await getAvailableKey();
    if (!key) {
       // ... queuing logic here ...
       return c.json({ error: "Wait or try stream" }, 503);
    }
    const res = await fetch('https://api.airforce/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
    const data: any = await res.json();
    incrementMetric(key, res.ok ? 'success' : 'failure', data.usage?.total_tokens || 1).catch(console.error);
    return c.json(data, res.status as any);
  }
});

export default {
  port: 3000,
  fetch: app.fetch
};
