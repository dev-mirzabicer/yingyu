"use client"

import React from 'react';
import { SWRConfig } from 'swr';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/hooks/auth/use-auth';

const publicRoutes = ['/login', '/admin/register', '/admin/teachers']; // Public routes that don't require authentication

/**
 * Custom HTTP error class for typed error handling in SWR fetcher.
 * Extends the base Error class with HTTP status information.
 */
class HttpError extends Error {
  public readonly status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Type guard to safely check if an error object has a status property.
 * Used for type-safe error handling in SWR callbacks.
 */
function hasStatusProperty(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}

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
          const errorMessage = body.error || `HTTP ${res.status}`;
          throw new HttpError(errorMessage, res.status);
        }
        const body = await res.json();
        return body.data;
      },
      onError: (err: unknown) => {
        if (typeof window !== 'undefined' && hasStatusProperty(err) && err.status === 401) {
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