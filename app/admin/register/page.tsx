"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Type definitions for admin API responses
interface AuthorizeResponse {
  ok: boolean;
  data: null;
  error: string | null;
}

interface CreateTeacherResponse {
  ok: boolean;
  data: {
    id: string;
    name: string;
    email: string;
  } | null;
  error: string | null;
}

interface AuthorizedCheckResponse {
  ok: boolean;
  data: {
    authorized: boolean;
  } | null;
  error: string | null;
}

// Utility function for safe error message extraction
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const errorObj = error as { message: unknown };
    return typeof errorObj.message === 'string' ? errorObj.message : 'An error occurred';
  }
  return 'An unexpected error occurred';
}

function AdminKeyForm({ onAuthorized }: { onAuthorized: () => void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/register/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const json: AuthorizeResponse = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast({ title: 'Authorized', description: 'Admin registration session started.' });
      onAuthorized();
    } catch (error: unknown) {
      toast({ 
        title: 'Authorization failed', 
        description: getErrorMessage(error) || 'Invalid key', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Admin Registration Access</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Registration Key</Label>
            <Input id="key" type="password" value={key} onChange={(e) => setKey(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full">Authorize</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TeacherCreateForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [phone, setPhone] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, timezone, phone: phone || undefined, validityDays: parseInt(validityDays, 10) }),
      });
      const json: CreateTeacherResponse = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast({ title: 'Teacher created', description: `Account for ${json.data?.name} created.` });
      setEmail(''); setName(''); setPassword(''); setPhone(''); setValidityDays('30');
    } catch (error: unknown) {
      toast({ 
        title: 'Creation failed', 
        description: getErrorMessage(error) || 'Error creating teacher', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Create Teacher Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validityDays">Validity (days)</Label>
            <Input 
              id="validityDays" 
              type="number" 
              min="1" 
              value={validityDays} 
              onChange={(e) => setValidityDays(e.target.value)} 
              required 
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full">Create</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminRegisterPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/admin/register/authorized');
        const json: AuthorizedCheckResponse = await res.json();
        setAuthorized(Boolean(json?.data?.authorized));
      } catch {
        setAuthorized(false);
      }
    };
    check();
  }, []);

  if (authorized === null) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      {authorized ? <TeacherCreateForm /> : <AdminKeyForm onAuthorized={() => setAuthorized(true)} />}
    </div>
  );
}

