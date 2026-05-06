'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function SettingsPage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [maxQueueSize, setMaxQueueSize] = useState(10);
  const { getAdminToken } = useAuth();

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${getAdminToken()}` };
    fetch('/api/admin/keys', { headers }).then(res => res.ok ? res.json() : []).then(setKeys);
    fetch('/api/admin/settings', { headers }).then(res => res.ok ? res.json() : { maxQueueSize: 10 }).then(data => setMaxQueueSize(data.maxQueueSize));
  }, [getAdminToken]);

  const addKey = async () => {
    if (!newKey) return;
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`
      },
      body: JSON.stringify({ key: newKey }),
    });
    if (res.ok) {
      setKeys([...keys, newKey]);
      setNewKey('');
    } else {
      const err = await res.json();
      alert(`Failed to add key: ${err.error || res.statusText}`);
    }
  };

  const removeKey = async (key: string) => {
    const res = await fetch('/api/admin/keys', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`
      },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setKeys(keys.filter(k => k !== key));
    }
  };

  const saveSettings = async () => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`
      },
      body: JSON.stringify({ maxQueueSize }),
    });
    if (res.ok) {
      alert('Settings saved');
    } else {
      const err = await res.json();
      alert(`Failed to save settings: ${err.error || res.statusText}`);
    }
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
            value={maxQueueSize || ''}
            min={1}
            max={100}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setMaxQueueSize(isNaN(val) ? 0 : val);
            }}
          />
          <button onClick={saveSettings} className="block bg-blue-500 text-white px-4 py-2 rounded">Save Settings</button>
        </div>
      </section>
    </div>
  );
}
