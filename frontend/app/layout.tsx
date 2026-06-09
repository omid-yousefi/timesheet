import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'سامانه تایم‌شیت و بهره‌وری', description: 'Enterprise Timesheet Analytics' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl"><body className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50"><main>{children}</main></body></html>;
}
