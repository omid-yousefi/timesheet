'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { KpiCard } from '@/components/KpiCard';
import { Compare } from '@/components/Charts';
import { api } from '@/lib/api';

interface EmployeeRanking {
  user_id: number;
  full_name: string;
  username: string;
  department_id: number;
  productivity_score: number;
  average_daily_working_hours: number;
  average_focus_rate: number;
}

interface TeamData {
  total_employees: number;
  ranking: EmployeeRanking[];
}

const PAGE_SIZE = 10;

export default function Manager() {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchTeamData() {
      try {
        const data = await api<TeamData>('/analytics/department/employees');
        setTeamData(data);
      } catch (err) {
        console.error('Failed to fetch team data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTeamData();
  }, []);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
        </div>
      </Shell>
    );
  }

  if (!teamData || teamData.ranking.length === 0) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-semibold">داشبورد مدیر</h1>
          <div className="card text-center py-12 text-slate-500">
            <p>داده‌ای برای نمایش وجود ندارد.</p>
          </div>
        </div>
      </Shell>
    );
  }

  const avgHours = teamData.ranking.length
    ? (teamData.ranking.reduce((s, r) => s + r.average_daily_working_hours, 0) / teamData.ranking.length).toFixed(1)
    : '0';
  const avgFocus = teamData.ranking.length
    ? Math.round(teamData.ranking.reduce((s, r) => s + r.average_focus_rate, 0) / teamData.ranking.length)
    : 0;
  const avgProductivity = teamData.ranking.length
    ? Math.round(teamData.ranking.reduce((s, r) => s + r.productivity_score, 0) / teamData.ranking.length)
    : 0;

  // Pagination
  const totalPages = Math.ceil(teamData.ranking.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRanking = teamData.ranking.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">داشبورد مدیر</h1>
          <p className="mt-1 text-sm text-slate-500">نمای کلی عملکرد تیم</p>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <KpiCard title="تعداد اعضا" value={teamData.total_employees} />
          <KpiCard title="میانگین ساعت" value={`${avgHours}`} />
          <KpiCard title="تمرکز تیم" value={`${avgFocus}٪`} />
          <KpiCard title="بهره‌وری" value={avgProductivity} />
        </section>

        <section className="card">
          <Compare
            personalHours={Number(avgHours)}
            deptHours={Number(avgHours)}
            personalFocus={Number(avgFocus)}
            deptFocus={Number(avgFocus)}
          />
        </section>

        {/* Employee ranking table with pagination */}
        <div className="card overflow-x-auto">
          <h2 className="mb-4 text-lg font-medium">رتبه‌بندی تیم</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 text-right">رتبه</th>
                <th className="p-3 text-right">نام</th>
                <th className="p-3 text-right">نام کاربری</th>
                <th className="p-3 text-right">ساعت کاری</th>
                <th className="p-3 text-right">نرخ تمرکز</th>
                <th className="p-3 text-right">امتیاز بهره‌وری</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRanking.map((emp, i) => {
                const globalRank = startIndex + i + 1;
                return (
                  <tr
                    key={emp.user_id}
                    className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950"
                  >
                    <td className="p-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        globalRank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                        globalRank === 2 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                        globalRank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                        'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {globalRank}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{emp.full_name}</td>
                    <td className="p-3 text-slate-500">{emp.username}</td>
                    <td className="p-3">{emp.average_daily_working_hours} ساعت</td>
                    <td className="p-3">{emp.average_focus_rate}٪</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.productivity_score >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                        emp.productivity_score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      }`}>
                        {emp.productivity_score}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-500">
                صفحه {currentPage} از {totalPages} — {teamData.ranking.length} نفر
              </span>
              <div className="flex gap-1">
                <button
                  className="px-3 py-1 rounded-lg text-sm border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  قبلی
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      page === currentPage
                        ? 'bg-accent text-white'
                        : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="px-3 py-1 rounded-lg text-sm border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  بعدی
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
