'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { KpiCard } from '@/components/KpiCard';
import { PeriodTrend, TaskPie, Compare } from '@/components/Charts';
import { api } from '@/lib/api';
import { format } from 'date-fns-jalali';

type Period = 'daily' | 'weekly' | 'monthly';

interface AnalyticsData {
  average_daily_working_hours: number;
  average_focus_rate: number;
  productivity_score: number;
  task_distribution: { name: string; hours: number }[];
}

interface BreakdownEntry {
  label: string;
  total_hours: number;
  average_focus_rate: number;
  productivity_score: number;
}

interface PeriodData {
  period: Period;
  period_label: string;
  summary: AnalyticsData;
  breakdown: BreakdownEntry[];
  date_range: { start: string; end: string; start_jalali: string; end_jalali: string };
  today_info: { jalali: string; weekday: string; month_name: string };
  available_months: { value: string; label: string }[];
}

interface MyAnalytics {
  personal: AnalyticsData;
  department_average: AnalyticsData;
}

export default function Dashboard() {
  const [data, setData] = useState<MyAnalytics | null>(null);
  const [periodData, setPeriodData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('daily');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Set default month to current Jalali month
  useEffect(() => {
    const now = new Date();
    const jal = format(now, 'yyyy/MM');
    setSelectedMonth(jal);
  }, []);

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

  useEffect(() => {
    async function fetchPeriodData() {
      try {
        let url = `/analytics/me/period?period=${period}`;
        if (period === 'monthly' && selectedMonth) {
          url += `&month_year=${selectedMonth}`;
        }
        const res = await api<PeriodData>(url);
        setPeriodData(res);
      } catch (err) {
        console.error('Failed to fetch period data', err);
        setPeriodData(null);
      }
    }
    fetchPeriodData();
  }, [period, selectedMonth]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-semibold mb-6">داشبورد شخصی</h1>
          <div className="card text-center py-12 text-slate-500">
            <p>داده‌ای برای نمایش یافت نشد. لطفا ابتدا گزارش‌های روزانه را ثبت کنید.</p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold">داشبورد شخصی</h1>
            <p className="mt-1 text-sm text-slate-500">نمای کلی عملکرد، تمرکز و بهره‌وری شما</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Period selector */}
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              {([['daily', 'روزانه'], ['weekly', 'هفتگی'], ['monthly', 'ماهانه']] as [Period, string][]).map(([p, label]) => (
                <button
                  key={p}
                  className={`px-4 py-2 rounded-lg text-sm transition ${
                    period === p
                      ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Month selector (only for monthly) */}
            {period === 'monthly' && periodData?.available_months && periodData.available_months.length > 0 && (
              <select
                className="input w-44 text-sm"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {periodData.available_months.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {period === 'monthly' && (!periodData?.available_months || periodData.available_months.length === 0) && (
              <select
                className="input w-44 text-sm"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {generateFallbackMonthOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Period display label */}
        {periodData?.period_label && (
          <div className="rounded-xl bg-accent/5 border border-accent/20 px-4 py-2 text-sm text-accent dark:bg-accent/10">
            📅 {periodData.period_label}
          </div>
        )}

        {/* KPI Cards — data filtered by period */}
        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="میانگین ساعت کاری"
            value={`${periodData?.summary.average_daily_working_hours ?? data.personal.average_daily_working_hours} ساعت`}
            hint={`میانگین دپارتمان: ${periodData?.summary.average_daily_working_hours ?? data.department_average.average_daily_working_hours}`}
          />
          <KpiCard
            title="نرخ تمرکز"
            value={`${periodData?.summary.average_focus_rate ?? data.personal.average_focus_rate}٪`}
            hint={`میانگین دپارتمان: ${periodData?.summary.average_focus_rate ?? data.department_average.average_focus_rate}٪`}
          />
          <KpiCard
            title="امتیاز بهره‌وری"
            value={periodData?.summary.productivity_score ?? data.personal.productivity_score}
            hint={`میانگین دپارتمان: ${periodData?.summary.productivity_score ?? data.department_average.productivity_score}`}
          />
        </section>

        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PeriodTrend
            data={periodData?.breakdown?.map(b => ({
              label: b.label,
              hours: b.total_hours,
              focus: b.average_focus_rate,
              productivity: b.productivity_score,
            })) || []}
            period={period}
          />
          <TaskPie
            items={
              (periodData?.summary.task_distribution && periodData.summary.task_distribution.length > 0)
                ? periodData.summary.task_distribution
                : data.personal.task_distribution || []
            }
          />
        </section>

        {/* Comparison */}
        <section className="card">
          <Compare
            personalHours={periodData?.summary.average_daily_working_hours ?? data.personal.average_daily_working_hours}
            deptHours={periodData?.summary.average_daily_working_hours ?? data.department_average.average_daily_working_hours}
            personalFocus={periodData?.summary.average_focus_rate ?? data.personal.average_focus_rate}
            deptFocus={periodData?.summary.average_focus_rate ?? data.department_average.average_focus_rate}
          />
        </section>
      </div>
    </Shell>
  );
}

const JALALI_MONTHS = [
  '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

function generateFallbackMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const jal = format(now, 'yyyy/MM');
  const [cy, cm] = jal.split('/').map(Number);
  const options: { value: string; label: string }[] = [];
  for (const yearOffset of [0, -1]) {
    const year = cy + yearOffset;
    for (let month = 1; month <= 12; month++) {
      if (yearOffset === 0 && month > cm) continue;
      const value = `${year}/${String(month).padStart(2, '0')}`;
      const label = `${JALALI_MONTHS[month]} ${year}`;
      options.push({ value, label });
    }
  }
  return options.reverse();
}
