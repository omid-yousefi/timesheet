'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { KpiCard } from '@/components/KpiCard';
import { Trend, TaskPie, Compare } from '@/components/Charts';
import { api } from '@/lib/api';

interface AnalyticsData {
  average_daily_working_hours: number;
  average_focus_rate: number;
  productivity_score: number;
  task_distribution: { name: string; hours: number }[];
}

interface MyAnalytics {
  personal: AnalyticsData;
  department_average: AnalyticsData;
}

export default function Dashboard() {
  const [data, setData] = useState<MyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await api<MyAnalytics>('/analytics/me');
        setData(res);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <Shell>
        <div className="flex h-96 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="text-center py-20 text-slate-500">داده‌ای برای نمایش یافت نشد. لطفا ابتدا گزارش‌های روزانه را ثبت کنید.</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-right">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">داشبورد شخصی</h1>
          <p className="text-slate-500">نمای کلی عملکرد، تمرکز و بهره‌وری شما</p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard 
            title="میانگین ساعات روزانه" 
            value={data.personal.average_daily_working_hours.toString()} 
            hint="ساعت در روز" 
          />
          <KpiCard 
            title="نرخ تمرکز" 
            value={`${data.personal.average_focus_rate}%`} 
          />
          <KpiCard 
            title="امتیاز بهره‌وری ماهانه" 
            value={data.personal.productivity_score.toString()} 
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Trend />
          <TaskPie items={data.personal.task_distribution} />
          <Compare 
            personalHours={data.personal.average_daily_working_hours}
            deptHours={data.department_average.average_daily_working_hours}
            personalFocus={data.personal.average_focus_rate}
            deptFocus={data.department_average.average_focus_rate}
          />
        </section>
      </div>
    </Shell>
  );
}
