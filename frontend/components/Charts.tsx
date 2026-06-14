'use client';
import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface TrendData {
  /** Pre-formatted Jalali label produced by the backend (timezone-safe). */
  label: string;
  hours: number;
  focus: number;
  productivity: number;
  /** Department averages for the same day (optional). */
  deptHours?: number;
  deptFocus?: number;
  deptProductivity?: number;
}

const TREND_METRICS = {
  hours: { personalKey: 'hours', deptKey: 'deptHours', label: 'ساعت کاری', unit: ' ساعت' },
  focus: { personalKey: 'focus', deptKey: 'deptFocus', label: 'نرخ تمرکز', unit: '٪' },
  productivity: { personalKey: 'productivity', deptKey: 'deptProductivity', label: 'بهره‌وری', unit: '' },
} as const;

/**
 * Interactive trend chart (recharts) — hover shows the exact value for every
 * point. Plots the user's metric AND the department average for the same metric
 * on a single line chart. Works for daily, weekly and monthly periods.
 *
 * The X-axis labels are the backend-provided Jalali strings, so dates are never
 * shifted by browser-timezone parsing.
 */
export function PeriodTrend({ data = [], period = 'daily' }: { data?: TrendData[]; period?: string }) {
  const [activeMetric, setActiveMetric] = useState<keyof typeof TREND_METRICS>('hours');

  const periodTitle = period === 'daily' ? 'روزانه' : period === 'weekly' ? 'هفتگی' : 'ماهانه';

  if (data.length === 0) {
    const periodText = period === 'daily' ? 'امروز' : period === 'weekly' ? 'این هفته' : 'این ماه';
    return (
      <div className="card">
        <h2 className="mb-3 font-medium">روند عملکرد ({periodText})</h2>
        <div className="flex items-center justify-center h-48 text-sm text-slate-400">
          داده‌ای برای نمایش وجود ندارد
        </div>
      </div>
    );
  }

  const metric = TREND_METRICS[activeMetric];
  const personalName = `شما (${metric.label})`;
  const deptName = `میانگین دپارتمان`;

  const hasDept = data.some(d => d[metric.deptKey] !== undefined && d[metric.deptKey] !== null);

  const chartData = data.map(d => ({
    label: d.label,
    [personalName]: d[metric.personalKey] ?? 0,
    ...(hasDept ? { [deptName]: d[metric.deptKey] ?? 0 } : {}),
  }));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-medium">روند عملکرد ({periodTitle})</h2>
        <div className="flex gap-1">
          {(Object.keys(TREND_METRICS) as Array<keyof typeof TREND_METRICS>).map(key => (
            <button
              key={key}
              className={`px-2 py-1 rounded text-xs transition ${
                activeMetric === key
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
              onClick={() => setActiveMetric(key)}
            >
              {TREND_METRICS[key].label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 34 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            angle={-25}
            textAnchor="end"
            height={58}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11 }} width={42} />
          <Tooltip
            formatter={(value: number, name: string) => [`${value}${metric.unit}`, name]}
            labelStyle={{ direction: 'rtl' }}
            contentStyle={{ borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: 12, direction: 'rtl' }}
          />
          <Legend verticalAlign="top" height={28} />
          <Line
            type="monotone"
            dataKey={personalName}
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
          {hasDept && (
            <Line
              type="monotone"
              dataKey={deptName}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Pie chart for task distribution — handles long labels via legend + tooltip */
export function TaskPie({ items = [] }: { items?: { name: string; hours: number }[] }) {
  if (items.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-3 font-medium">توزیع زمان بر اساس وظیفه</h2>
        <div className="flex items-center justify-center h-48 text-sm text-slate-400">
          داده‌ای برای نمایش وجود ندارد
        </div>
      </div>
    );
  }

  const chartData = items.map((item, i) => ({
    name: item.name,
    value: item.hours,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="card">
      <h2 className="mb-3 font-medium">توزیع زمان بر اساس وظیفه</h2>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={80}
            formatter={(value: string) => (
              <span className="text-xs" title={value}>
                {value.length > 18 ? value.substring(0, 18) + '…' : value}
              </span>
            )}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`${value} ساعت`, name]}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              fontSize: 12,
              maxWidth: 200,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ComparePoint {
  label: string;
  personal_productivity?: number;
  department_productivity?: number;
  personal_focus?: number;
  department_focus?: number;
  personal_hours?: number;
  department_hours?: number;
}

export function Compare({
  series = [],
  personalHours = 0,
  deptHours = 0,
  personalFocus = 0,
  deptFocus = 0,
}: {
  series?: ComparePoint[];
  personalHours?: number;
  deptHours?: number;
  personalFocus?: number;
  deptFocus?: number;
}) {
  const chartData = series.map(p => ({
    label: p.label,
    شما: p.personal_productivity ?? 0,
    'میانگین دپارتمان': p.department_productivity ?? 0,
  }));

  if (chartData.length > 0) {
    return (
      <div>
        <h2 className="mb-3 font-medium">مقایسه عملکرد شما با میانگین دپارتمان</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 34 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={58} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={42} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              labelStyle={{ direction: 'rtl' }}
              contentStyle={{ borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: 12 }}
            />
            <Legend verticalAlign="top" height={28} />
            <Line type="monotone" dataKey="شما" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="میانگین دپارتمان" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const data = [
    { name: 'ساعت', شما: personalHours, 'میانگین': deptHours },
    { name: 'تمرکز', شما: personalFocus, 'میانگین': deptFocus },
  ];

  return (
    <div>
      <h2 className="mb-3 font-medium">مقایسه شما با میانگین دپارتمان</h2>
      <div className="grid grid-cols-2 gap-6 h-48">
        {data.map(d => (
          <div key={d.name} className="flex flex-col items-center justify-center">
            <div className="text-sm text-slate-500 mb-2">{d.name === 'ساعت' ? 'ساعت کاری' : 'نرخ تمرکز'}</div>
            <div className="flex items-end gap-4 h-24">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 bg-accent rounded-t" style={{ height: `${Math.max(Number(d.شما) * 2, 4)}px` }} />
                <span className="text-xs font-medium">شما</span>
                <span className="text-xs text-slate-500">{d.شما}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 bg-slate-400 rounded-t" style={{ height: `${Math.max(Number(d.میانگین) * 2, 4)}px` }} />
                <span className="text-xs font-medium">میانگین</span>
                <span className="text-xs text-slate-500">{d.میانگین}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
