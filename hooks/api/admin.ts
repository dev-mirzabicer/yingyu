import useSWR from 'swr';
import { fetcher, mutateWithOptimistic } from './utils';
import { DataTableCompatible } from '@/components/data-table';

// Types for teacher data with admin fields
export interface AdminTeacher extends DataTableCompatible {
  id: string;
  name: string;
  email: string;
  timezone: string;
  createdAt: string;
  lastLoginAt: string | null;
  validityUntil: string | null;
  daysRemaining: number | null;
  [key: string]: unknown;
}

// Hook to check if admin registration is authorized
export function useAdminAuthorized() {
  const { data, error, isLoading } = useSWR('/api/admin/register/authorized', fetcher);
  
  return {
    authorized: data?.authorized || false,
    isLoading,
    isError: !!error
  };
}

// Hook to fetch all teachers for admin dashboard
export function useTeachers() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/teachers', fetcher);
  
  return {
    teachers: (data || []) as AdminTeacher[],
    isLoading,
    isError: !!error,
    mutate
  };
}

// Create a new teacher with validity
export async function createTeacher(payload: {
  email: string;
  name: string;
  password: string;
  phone?: string;
  timezone?: string;
  validityUntil?: Date;
  validityDays?: number;
}) {
  const response = await fetch('/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.data;
}

// Top up a teacher's validity by a number of days
export async function topupTeacher(teacherId: string, days: number) {
  const response = await fetch(`/api/admin/teachers/${teacherId}/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.data;
}

// Set a teacher's exact validity date
export async function setTeacherValidity(teacherId: string, validityUntil: Date) {
  const response = await fetch(`/api/admin/teachers/${teacherId}/validity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validityUntil: validityUntil.toISOString() }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.data;
}