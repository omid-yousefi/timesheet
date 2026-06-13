'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, type LoginResponse } from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });

      // The role is decoded from the JWT on the client is unsafe; we store the
      // token now and let the app shell fetch /me for the authoritative role.
      setAuth(res.access_token, '');
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نام کاربری یا رمز عبور نادرست است');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-5">
        <div className="text-right">
          <h1 className="text-2xl font-semibold">ورود به سامانه</h1>
          <p className="mt-1 text-sm text-slate-500">سامانه تایم‌شیت و بهره‌وری</p>
        </div>

        <div className="space-y-1 text-right">
          <label className="text-xs text-slate-600 dark:text-slate-300">نام کاربری</label>
          <input
            className="input w-full"
            placeholder="نام کاربری"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1 text-right">
          <label className="text-xs text-slate-600 dark:text-slate-300">رمز عبور</label>
          <input
            className="input w-full"
            type="password"
            placeholder="رمز عبور"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn w-full" type="submit" disabled={loading}>
          {loading ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
    </div>
  );
}
