'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

export function Trend({ data = [] }: { data?: any[] }) {
  const chartData = data.length ? data : [
    { d: 'شنبه', h: 7.2, f: 80, p: 76 },
    { d: 'یکشنبه', h: 8.1, f: 87, p: 89 },
    { d: 'دوشنبه', h: 7.8, f: 84, p: 85 },
    { d: 'سه‌شنبه', h: 8.3, f: 90, p: 94 },
  ];
  return (
    <div className="card h-80">
      <h3 className="mb-4 font-medium text-right">روند ساعات کاری و تمرکز</h3>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <XAxis dataKey="d" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="h" stroke="#0B3A75" name="ساعات" />
          <Line type="monotone" dataKey="f" stroke="#64748b" name="تمرکز" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskPie({ items = [] }: { items?: any[] }) {
  const rows = items.length ? items : [
    { name: 'اعتبار', hours: 12 },
    { name: 'پشتیبانی', hours: 7 },
    { name: 'گزارش', hours: 5 },
  ];
  return (
    <div className="card h-80">
      <h3 className="mb-4 font-medium text-right">توزیع زمان بر اساس وظیفه</h3>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={rows} dataKey="hours" nameKey="name" outerRadius={90}>
            {rows.map((_: any, i: number) => (
              <Cell key={i} fill={["#0B3A75", "#94a3b8", "#cbd5e1"][i % 3]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Compare({ 
  personalHours = 0, 
  deptHours = 0, 
  personalFocus = 0, 
  deptFocus = 0 
}: { 
  personalHours?: number; 
  deptHours?: number; 
  personalFocus?: number; 
  deptFocus?: number; 
}) {
  const chartData = [
    { k: 'ساعت', you: personalHours, dept: deptHours },
    { k: 'تمرکز', you: personalFocus, dept: deptFocus },
  ];
  return (
    <div className="card h-80">
      <h3 className="mb-4 font-medium text-right">مقایسه شما با میانگین دپارتمان</h3>
      <ResponsiveContainer>
        <BarChart data={chartData}>
          <XAxis dataKey="k" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="you" fill="#0B3A75" name="شما" />
          <Bar dataKey="dept" fill="#cbd5e1" name="دپارتمان" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
