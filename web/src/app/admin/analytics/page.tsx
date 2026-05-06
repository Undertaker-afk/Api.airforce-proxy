'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

interface KeyMetric {
  isRateLimited: boolean;
  today: { success: number; failure: number; tokens: number };
  yesterday: { success: number; failure: number; tokens: number };
}

interface AnalyticsResponse {
  queueLength: number;
  metrics: Record<string, KeyMetric>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { getAdminToken } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/analytics', {
          headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });
        if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    fetch('/api/admin/config', {
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(setConfig);

    return () => clearInterval(interval);
  }, [getAdminToken]);

  if (error) return <div className="text-red-500 p-4">Error: {error}</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>

      {config && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
          <p className="text-blue-700">
            <strong>Public API Endpoint:</strong> <code className="bg-blue-100 px-1 rounded">{config.appEndpoint}/v1/chat/completions</code>
          </p>
          <p className="text-sm text-blue-600 mt-1">Use this URL in your OpenAI-compatible clients.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-gray-500 uppercase text-sm font-bold">Current Queue</h3>
          <p className="text-4xl font-bold">{data.queueLength}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded shadow">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 text-left">Key (partial)</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Today (S/F/T)</th>
              <th className="p-4 text-left">Yesterday (S/F/T)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.metrics).map(([key, metrics]) => (
              <tr key={key} className="border-b">
                <td className="p-4 font-mono">{key.slice(0, 8)}...</td>
                <td className="p-4">
                  {metrics.isRateLimited ? (
                    <span className="text-orange-500">Rate Limited</span>
                  ) : (
                    <span className="text-green-500">Ready</span>
                  )}
                </td>
                <td className="p-4">
                  {metrics.today.success} / {metrics.today.failure} / {metrics.today.tokens}
                </td>
                <td className="p-4">
                  {metrics.yesterday.success} / {metrics.yesterday.failure} / {metrics.yesterday.tokens}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
