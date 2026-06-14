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
      <div className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const isAdmin = me?.role === 'ADMIN';
  const isManager = me?.role === 'MANAGER';

  const navLinks = [
    { href: '/dashboard', label: 'داشبورد' },
    { href: '/logs', label: 'ثبت گزارش' },
    ...(isAdmin ? [{ href: '/admin', label: 'پنل مدیریت' }] : []),
    ...(isAdmin || isManager ? [{ href: '/manager', label: 'مدیریت تیم' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-accent">
              تایم‌شیت
            </Link>
            <nav className="hidden md:flex gap-4">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm transition ${
                    pathname === link.href
                      ? 'text-accent font-medium'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {me && (
              <span className="text-sm text-slate-500">
                {me.full_name}
                <span className="mr-1 text-xs text-slate-400">({ROLE_LABELS[me.role] || me.role})</span>
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-600 transition"
            >
              خروج
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-2">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${
                pathname === link.href
                  ? 'bg-accent text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}
