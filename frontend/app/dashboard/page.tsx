"use client";

import { useState, useEffect } from "react";
import { Shell } from "@/components/Shell";
import { KpiCard } from "@/components/KpiCard";
import { PeriodTrend, TaskPie, Compare } from "@/components/Charts";
import { api } from "@/lib/api";
import { format } from "date-fns-jalali";

type Period = "daily" | "weekly" | "monthly";

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

interface ComparisonPoint {
  label: string;
  personal_productivity: number;
  department_productivity: number;
  personal_focus: number;
  department_focus: number;
  personal_hours: number;
  department_hours: number;
}

interface PeriodData {
  period: Period;
  period_label: string;

  // These may be missing if backend is not restarted / still returns old response,
  // so all usages below are protected with optional chaining.
  summary?: AnalyticsData;
  department_summary?: AnalyticsData;

  breakdown?: BreakdownEntry[];
  department_breakdown?: BreakdownEntry[];
  comparison_series?: ComparisonPoint[];

  date_range?: {
    start: string;
    end: string;
    start_jalali: string;
    end_jalali: string;
  };

  today_info?: {
    jalali: string;
    weekday: string;
    month_name: string;
    year?: number;
  };

  available_months?: { value: string; label: string }[];
}

interface MyAnalytics {
  personal: AnalyticsData;
  department_average: AnalyticsData;
}

export default function Dashboard() {
  const [data, setData] = useState<MyAnalytics | null>(null);
  const [periodData, setPeriodData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("daily");
  const [selectedMonth, setSelectedMonth] = useState("");

  // Set default month to current Jalali month
  useEffect(() => {
    const now = new Date();
    const jal = format(now, "yyyy/MM");
    setSelectedMonth(jal);
  }, []);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await api<MyAnalytics>("/analytics/me");
        setData(res);
      } catch (err) {
        console.error("Failed to fetch analytics", err);
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

        if (period === "monthly" && selectedMonth) {
          url += `&month_year=${encodeURIComponent(selectedMonth)}`;
        }

        const res = await api<PeriodData>(url);
        setPeriodData(res);
      } catch (err) {
        console.error("Failed to fetch period data", err);
        setPeriodData(null);
      }
    }

    fetchPeriodData();
  }, [period, selectedMonth]);

  useEffect(() => {
    if (period !== "monthly") return;
    if (!periodData?.available_months?.length) return;

    const selectedExists = periodData.available_months.some(
      (month) => month.value === selectedMonth,
    );

    if (!selectedExists) {
      setSelectedMonth(periodData.available_months[0].value);
    }
  }, [period, periodData?.available_months, selectedMonth]);

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
            <p>
              داده‌ای برای نمایش یافت نشد. لطفا ابتدا گزارش‌های روزانه را ثبت
              کنید.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const personalSummary = periodData?.summary ?? data.personal;
  const departmentSummary =
    periodData?.department_summary ?? data.department_average;

  // Merge personal breakdown with the department breakdown for the same day so
  // the trend chart can show both lines. `label` comes straight from the backend
  // (already correct Jalali), which is the fix for the previously shifted dates.
  const deptBreakdown = periodData?.department_breakdown ?? [];
  const trendData =
    periodData?.breakdown?.map((item, i) => {
      const dept = deptBreakdown[i];
      return {
        label: item.label,
        hours: item.total_hours,
        focus: item.average_focus_rate,
        productivity: item.productivity_score,
        deptHours: dept?.total_hours,
        deptFocus: dept?.average_focus_rate,
        deptProductivity: dept?.productivity_score,
      };
    }) ?? [];

  const taskDistribution =
    personalSummary.task_distribution?.length > 0
      ? personalSummary.task_distribution
      : data.personal.task_distribution || [];

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold">داشبورد شخصی</h1>
            <p className="mt-1 text-sm text-slate-500">
              نمای کلی عملکرد، تمرکز و بهره‌وری شما
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Period selector */}
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              {(
                [
                  ["daily", "روزانه"],
                  ["weekly", "هفتگی"],
                  ["monthly", "ماهانه"],
                ] as [Period, string][]
              ).map(([p, label]) => (
                <button
                  key={p}
                  className={`px-4 py-2 rounded-lg text-sm transition ${
                    period === p
                      ? "bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Month selector */}
            {period === "monthly" &&
              periodData?.available_months &&
              periodData.available_months.length > 0 && (
                <select
                  className="input w-44 text-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {periodData.available_months.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

            {period === "monthly" &&
              periodData?.available_months &&
              periodData.available_months.length === 0 && (
                <div className="text-sm text-slate-500">
                  ماهی با داده ثبت‌شده یافت نشد
                </div>
              )}
          </div>
        </div>

        {/* Period display label */}
        {periodData?.period_label && (
          <div className="rounded-xl bg-accent/5 border border-accent/20 px-4 py-2 text-sm text-accent dark:bg-accent/10">
            📅 {periodData.period_label}
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="میانگین ساعت کاری"
            value={`${personalSummary.average_daily_working_hours} ساعت`}
            hint={`میانگین دپارتمان: ${departmentSummary.average_daily_working_hours}`}
          />

          <KpiCard
            title="نرخ تمرکز"
            value={`${personalSummary.average_focus_rate}٪`}
            hint={`میانگین دپارتمان: ${departmentSummary.average_focus_rate}٪`}
          />

          <KpiCard
            title="امتیاز بهره‌وری"
            value={personalSummary.productivity_score}
            hint={`میانگین دپارتمان: ${departmentSummary.productivity_score}`}
          />
        </section>

        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PeriodTrend data={trendData} period={period} />

          <TaskPie items={taskDistribution} />
        </section>

        {/* Comparison */}
        <section className="card">
          <Compare
            series={periodData?.comparison_series ?? []}
            personalHours={personalSummary.average_daily_working_hours}
            deptHours={departmentSummary.average_daily_working_hours}
            personalFocus={personalSummary.average_focus_rate}
            deptFocus={departmentSummary.average_focus_rate}
          />
        </section>
      </div>
    </Shell>
  );
}
