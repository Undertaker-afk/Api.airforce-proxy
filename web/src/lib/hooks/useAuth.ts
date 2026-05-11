'use client';

import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    setIsAuthenticated(!!auth);
  }, []);

  const getAdminToken = useCallback(() => {
    return localStorage.getItem('admin_password') || '';
  }, []);

  const login = useCallback(async (password: string) => {
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        localStorage.setItem('admin_auth', 'true');
        localStorage.setItem('admin_password', password);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_auth');
    localStorage.removeItem('admin_password');
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, login, logout, getAdminToken };
}
