'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [maxQueueSize, setMaxQueueSize] = useState(10);

  useEffect(() => {
    fetch('/api/admin/keys').then(res => res.json()).then(setKeys);
    fetch('/api/admin/settings').then(res => res.json()).then(data => setMaxQueueSize(data.maxQueueSize));
  }, []);

  const addKey = async () => {
    if (!newKey) return;
    await fetch('/api/admin/keys', {
      method: 'POST',
      body: JSON.stringify({ key: newKey }),
    });
    setKeys([...keys, newKey]);
    setNewKey('');
  };

  const removeKey = async (key: string) => {
    await fetch('/api/admin/keys', {
      method: 'DELETE',
      body: JSON.stringify({ key }),
    });
    setKeys(keys.filter(k => k !== key));
  };

  const saveSettings = async () => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ maxQueueSize }),
    });
    alert('Settings saved');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">API Keys (api.airforce)</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="flex-1 p-2 border rounded"
            placeholder="sk-air-..."
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <button onClick={addKey} className="bg-green-500 text-white px-4 py-2 rounded">Add Key</button>
        </div>
        <ul className="space-y-2">
          {keys.map(key => (
            <li key={key} className="flex justify-between items-center p-2 bg-white rounded border">
              <span className="font-mono">{key.slice(0, 10)}...{key.slice(-4)}</span>
              <button onClick={() => removeKey(key)} className="text-red-500">Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">General Settings</h2>
        <div className="bg-white p-6 rounded border">
          <label className="block mb-2">Max Queue Size</label>
          <input
            type="number"
            className="p-2 border rounded w-32 mb-4"
            value={maxQueueSize}
            onChange={(e) => setMaxQueueSize(parseInt(e.target.value))}
          />
          <button onClick={saveSettings} className="block bg-blue-500 text-white px-4 py-2 rounded">Save Settings</button>
        </div>
      </section>
    </div>
  );
}
