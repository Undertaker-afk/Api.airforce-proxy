'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, login } = useAuth();
  const [password, setPassword] = useState('');

  if (isAuthenticated === null) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded shadow-md w-96">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <input
            type="password"
            className="w-full p-2 border rounded mb-4"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={() => login(password)}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <nav className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h2 className="text-xl font-bold">Admin</h2>
        </div>
        <ul className="mt-4">
          <li>
            <a href="/admin/settings" className="block p-4 hover:bg-gray-200">Settings</a>
          </li>
          <li>
            <a href="/admin/analytics" className="block p-4 hover:bg-gray-200">Analytics</a>
          </li>
          <li>
            <a href="/" className="block p-4 hover:bg-gray-200">Back to Chat</a>
          </li>
        </ul>
      </nav>
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
