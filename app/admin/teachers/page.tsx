'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/data-table';
import { useAdminAuthorized, useTeachers, topupTeacher, setTeacherValidity, AdminTeacher } from '@/hooks/api/admin';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Type for error objects that may be thrown during API operations.
 * Represents both Error instances and generic error objects with optional message properties.
 */
interface ApiError {
  message?: string;
}

/**
 * Type guard to check if an error has a message property
 */
function isErrorWithMessage(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error types
 */
function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

function TopupDialog({ teacher, onSuccess }: { teacher: AdminTeacher; onSuccess: () => void }) {
  const [days, setDays] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const daysNum = parseInt(days, 10);
    if (!daysNum || daysNum <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid number of days', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await topupTeacher(teacher.id, daysNum);
      toast({ title: 'Success', description: `Added ${daysNum} days to ${teacher.name}'s account` });
      setDays('');
      onSuccess();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({ title: 'Error', description: errorMessage || 'Failed to top up account', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Top Up Validity - {teacher.name}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="days">Days to Add</Label>
          <Input
            id="days"
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="30"
            required
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add Days'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

function SetValidityDialog({ teacher, onSuccess }: { teacher: AdminTeacher; onSuccess: () => void }) {
  const [date, setDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({ title: 'Error', description: 'Please select a date', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await setTeacherValidity(teacher.id, date);
      toast({ title: 'Success', description: `Set validity for ${teacher.name} to ${format(date, 'PPP')}` });
      setDate(undefined);
      onSuccess();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({ title: 'Error', description: errorMessage || 'Failed to set validity date', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Set Validity Date - {teacher.name}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Validity Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !date}>
            {loading ? 'Setting...' : 'Set Date'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export default function AdminTeachersPage() {
  const router = useRouter();
  const { authorized, isLoading: authLoading } = useAdminAuthorized();
  const { teachers, isLoading: teachersLoading, mutate } = useTeachers();

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading && !authorized) {
      router.push('/admin/register');
    }
  }, [authLoading, authorized, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Will redirect
  }

  const columns: Column<AdminTeacher>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      searchable: true,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      searchable: true,
    },
    {
      key: 'timezone',
      header: 'Timezone',
      sortable: true,
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (value: string) => format(new Date(value), 'MMM d, yyyy'),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      sortable: true,
      render: (value: string | null) => value ? format(new Date(value), 'MMM d, yyyy HH:mm') : 'Never',
    },
    {
      key: 'validityUntil',
      header: 'Valid Until',
      sortable: true,
      render: (value: string | null) => value ? format(new Date(value), 'MMM d, yyyy') : 'No expiry',
    },
    {
      key: 'daysRemaining',
      header: 'Days Remaining',
      sortable: true,
      render: (value: number | null) => {
        if (value === null) {
          return <Badge variant="secondary">No expiry</Badge>;
        }
        if (value <= 0) {
          return <Badge variant="destructive">Expired</Badge>;
        }
        if (value <= 7) {
          return <Badge variant="outline" className="border-orange-500 text-orange-600">{value} days</Badge>;
        }
        return <Badge variant="outline" className="border-green-500 text-green-600">{value} days</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      render: (_value: undefined, row: AdminTeacher) => (
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Top Up
              </Button>
            </DialogTrigger>
            <TopupDialog teacher={row} onSuccess={() => mutate()} />
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Clock className="w-4 h-4 mr-1" />
                Set Date
              </Button>
            </DialogTrigger>
            <SetValidityDialog teacher={row} onSuccess={() => mutate()} />
          </Dialog>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage teacher accounts and validity periods</p>
          </div>
          <Button 
            onClick={() => router.push('/admin/register')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Teacher
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Teachers ({teachers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {teachersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <DataTable
                data={teachers}
                columns={columns}
                pageSize={10}
                searchable={true}
                sortable={true}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}