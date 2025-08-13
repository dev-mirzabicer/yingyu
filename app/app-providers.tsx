"use client"

import React from 'react';
import { SWRConfig } from 'swr';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/hooks/auth/use-auth';

const publicRoutes = ['/login', '/admin/register', '/admin/teachers']; // Public routes that don't require authentication

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/admin');

  React.useEffect(() => {
    if (!loading && !isPublic && !user) {
      router.replace('/login');
    }
  }, [loading, isPublic, user, router]);

  // Show loading state only for protected routes
  if (!isPublic && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  // Don't render protected content if not authenticated
  if (!isPublic && !user) return null;

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  return (
    <SWRConfig value={{
      fetcher: async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const err: any = new Error(body.error || `HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        const body = await res.json();
        return body.data;
      },
      onError: (err: any) => {
        if (typeof window !== 'undefined' && err?.status === 401) {
          router.replace('/login');
        }
      },
      dedupingInterval: 1000,
    }}>
      <AuthProvider>
        <Gate>{children}</Gate>
      </AuthProvider>
    </SWRConfig>
  );
}