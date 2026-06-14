'use client';
import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface TrendData {
  label: string;
  hours: number;
  focus: number;
  productivity: number;
}

/** Trend chart — works for daily, weekly, and monthly periods */
export function PeriodTrend({ data = [], period = 'daily' }: { data?: TrendData[]; period?: string }) {
  const [activeMetric, setActiveMetric] = useState<'hours' | 'focus' | 'productivity'>('hours');

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

  const metricConfig = {
    hours: { key: 'hours' as const, label: 'ساعت کاری', color: '#6366f1', unit: ' ساعت' },
    focus: { key: 'focus' as const, label: 'نرخ تمرکز', color: '#10b981', unit: '٪' },
    productivity: { key: 'productivity' as const, label: 'بهره‌وری', color: '#f59e0b', unit: '' },
  };

  const metric = metricConfig[activeMetric];
  const maxVal = Math.max(...data.map(d => d[metric.key]), 1);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">
          روند عملکرد ({period === 'daily' ? 'روزانه' : period === 'weekly' ? 'هفتگی' : 'ماهانه'})
        </h2>
        <div className="flex gap-1">
          {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map(key => (
            <button
              key={key}
              className={`px-2 py-1 rounded text-xs transition ${
                activeMetric === key
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
              onClick={() => setActiveMetric(key)}
            >
              {metricConfig[key].label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <div className="relative">
          <svg viewBox={`0 0 500 300`} className="w-full h-full">
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <text key={i} x="8" y={290 - pct * 270} className="text-[9px] fill-slate-400" textAnchor="start">
                {Math.round(pct * maxVal * 1.2)}
              </text>
            ))}
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <line key={i} x1="40" y1={290 - pct * 270} x2="490" y2={290 - pct * 270} stroke="rgba(148,163,184,0.1)" />
            ))}
            {/* Area fill */}
            <path
              d={`M${data.map((d, i) => `${40 + (i * 450 / Math.max(data.length - 1, 1))} ${290 - (d[metric.key] / (maxVal * 1.2)) * 270}`).join(' L')} L${40 + ((data.length - 1) * 450 / Math.max(data.length - 1, 1))} 290 L40 290 Z`}
              fill={`url(#grad-${activeMetric})`}
              opacity="0.3"
            />
            {/* Line */}
            <polyline
              fill="none"
              stroke={metric.color}
              strokeWidth="2"
              points={data.map((d, i) => `${40 + (i * 450 / Math.max(data.length - 1, 1))},${290 - (d[metric.key] / (maxVal * 1.2)) * 270}`).join(' ')}
            />
            {/* Dots */}
            {data.map((d, i) => (
              <circle
                key={i}
                cx={40 + (i * 450 / Math.max(data.length - 1, 1))}
                cy={290 - (d[metric.key] / (maxVal * 1.2)) * 270}
                r="3"
                fill={metric.color}
              />
            ))}
            {/* X-axis labels */}
            {data.map((d, i) => (
              <text
                key={i}
                x={40 + (i * 450 / Math.max(data.length - 1, 1))}
                y="298"
                className="text-[9px] fill-slate-500 dark:fill-slate-400"
                textAnchor="middle"
              >
                {d.label}
              </text>
            ))}
            <defs>
              <linearGradient id={`grad-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metric.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
        </div>
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

export function Compare({
  personalHours = 0,
  deptHours = 0,
  personalFocus = 0,
  deptFocus = 0,
}: {
  personalHours?: number;
  deptHours?: number;
  personalFocus?: number;
  deptFocus?: number;
}) {
  const data = [
    { name: 'ساعت', شما: personalHours, 'میانگین': deptHours },
    { name: 'تمرکز', شما: personalFocus, 'میانگین': deptFocus },
  ];

  return (
    <div>
      <h2 className="mb-3 font-medium">مقایسه شما با میانگین دپارتمان</h2>
      <ResponsiveContainer width="100%" height={200}>
        <div className="grid grid-cols-2 gap-6 h-full">
          {data.map(d => (
            <div key={d.name} className="flex flex-col items-center justify-center">
              <div className="text-sm text-slate-500 mb-2">{d.name === 'ساعت' ? 'ساعت کاری' : 'نرخ تمرکز'}</div>
              <div className="flex items-end gap-4 h-24">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 bg-accent rounded-t" style={{ height: `${Math.max(d.شما * 2, 4)}px` }} />
                  <span className="text-xs font-medium">شما</span>
                  <span className="text-xs text-slate-500">{d.شما}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 bg-slate-400 rounded-t" style={{ height: `${Math.max(d.میانگین * 2, 4)}px` }} />
                  <span className="text-xs font-medium">میانگین</span>
                  <span className="text-xs text-slate-500">{d.میانگین}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ResponsiveContainer>
    </div>
  );
}
