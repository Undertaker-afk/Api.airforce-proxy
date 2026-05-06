'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    setIsAuthenticated(!!auth);
  }, []);

  const login = (password: string) => {
    // We'll call an API to verify the password
    return fetch('/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }).then(res => {
      if (res.ok) {
        localStorage.setItem('admin_auth', 'true');
        setIsAuthenticated(true);
        return true;
      }
      return false;
    });
  };

  const logout = () => {
    localStorage.removeItem('admin_auth');
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout };
}
