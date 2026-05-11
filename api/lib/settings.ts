import redis from './redis';

export interface Settings {
  maxQueueSize: number;
}

const DEFAULT_SETTINGS: Settings = {
  maxQueueSize: 10,
};

export async function getSettings(): Promise<Settings> {
  try {
    const settings = await redis.get('settings');
    if (!settings) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
  } catch (err) {
    console.error("Failed to parse settings:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(settings: Partial<Settings>) {
  // Use a simple atomic set for now as it's low traffic,
  // but we validate on the route level.
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await redis.set('settings', JSON.stringify(updated));
  return updated;
}

export async function getApiKeys(): Promise<string[]> {
  return await redis.smembers('airforce_keys');
}

export async function addApiKey(key: string) {
  if (!key) return;
  await redis.sadd('airforce_keys', key);
}

export async function removeApiKey(key: string) {
  if (!key) return;
  await redis.srem('airforce_keys', key);
}
