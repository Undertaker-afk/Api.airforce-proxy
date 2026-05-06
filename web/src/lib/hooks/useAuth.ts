'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    setIsAuthenticated(!!auth);
  }, []);

  const getAdminToken = () => {
    return localStorage.getItem('admin_password') || '';
  };

  const login = (password: string) => {
    return fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then(res => {
      if (res.ok) {
        localStorage.setItem('admin_auth', 'true');
        localStorage.setItem('admin_password', password);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    }).catch(() => false);
  };

  const logout = () => {
    localStorage.removeItem('admin_auth');
    localStorage.removeItem('admin_password');
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout, getAdminToken };
}
