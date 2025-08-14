"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type User = { 
  id: string; 
  name: string; 
  email: string; 
  timezone: string;
  validityUntil?: Date | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const fetchMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/me', { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data);
      } else if (res.status === 401) {
        setUser(null);
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error || `HTTP ${res.status}`);
        setUser(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchMe(); 
  }, [fetchMe]);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setUser(json.data);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Login failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.replace('/login');
  }, [router]);

  const refresh = fetchMe;

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}