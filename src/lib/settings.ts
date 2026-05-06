import redis from './redis';

export interface Settings {
  maxQueueSize: number;
}

const DEFAULT_SETTINGS: Settings = {
  maxQueueSize: 10,
};

export async function getSettings(): Promise<Settings> {
  const settings = await redis.get('settings');
  if (!settings) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
}

export async function updateSettings(settings: Partial<Settings>) {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await redis.set('settings', JSON.stringify(updated));
  return updated;
}

export async function getApiKeys(): Promise<string[]> {
  return await redis.smembers('airforce_keys');
}

export async function addApiKey(key: string) {
  await redis.sadd('airforce_keys', key);
}

export async function removeApiKey(key: string) {
  await redis.srem('airforce_keys', key);
}
