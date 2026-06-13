'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-accent" />
    </div>
  );
}
