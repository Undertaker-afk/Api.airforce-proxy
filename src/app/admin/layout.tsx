'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, login } = useAuth();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
            onKeyDown={(e) => e.key === 'Enter' && !isLoggingIn && handleLogin()}
          />
          {loginError && <p className="text-red-500 text-sm mb-4">{loginError}</p>}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  async function handleLogin() {
    setIsLoggingIn(true);
    setLoginError('');
    const success = await login(password);
    if (!success) {
      setLoginError('Invalid password');
    }
    setIsLoggingIn(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <nav className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h2 className="text-xl font-bold">Admin</h2>
        </div>
        <ul className="mt-4">
          <li>
            <Link href="/admin/settings" className="block p-4 hover:bg-gray-200">Settings</Link>
          </li>
          <li>
            <Link href="/admin/analytics" className="block p-4 hover:bg-gray-200">Analytics</Link>
          </li>
          <li>
            <Link href="/" className="block p-4 hover:bg-gray-200">Back to Chat</Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
