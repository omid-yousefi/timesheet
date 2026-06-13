'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getToken, logout } from '@/lib/auth';

interface Me {
  id: number;
  full_name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدیر سیستم',
  MANAGER: 'مدیر',
  EMPLOYEE: 'کارمند',
};

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    // Client-side auth guard: every protected page renders inside <Shell>.
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    // Validate the token and load the user's identity for role-based UI.
    api<Me>('/me')
      .then(setMe)
      .catch(() => {
        /* api() already handles 401/403 redirect */
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-accent" />
      </div>
    );
  }

  const isAdmin = me?.role === 'ADMIN';
  const isManager = me?.role === 'MANAGER';

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <aside className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
        <b className="text-accent">سامانه بهره‌وری</b>

        <nav className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/dashboard" className={pathname === '/dashboard' ? 'font-semibold text-accent' : ''}>
            داشبورد
          </Link>
          <Link href="/logs" className={pathname === '/logs' ? 'font-semibold text-accent' : ''}>
            ثبت گزارش
          </Link>
          {(isManager || isAdmin) && (
            <Link href="/manager" className={pathname === '/manager' ? 'font-semibold text-accent' : ''}>
              مدیر
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={pathname === '/admin' ? 'font-semibold text-accent' : ''}>
              ادمین
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          {me && (
            <span>
              {me.full_name}
              {ROLE_LABELS[me.role] ? ` · ${ROLE_LABELS[me.role]}` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-200 px-2 py-1 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            خروج
          </button>
        </div>
      </aside>

      {children}
    </div>
  );
}
