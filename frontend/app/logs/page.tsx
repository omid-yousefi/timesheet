"use client";
import { useState, useEffect, useMemo } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { format } from "date-fns-jalali";

// Persian date picker imports
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";

interface Todo {
  id: number;
  title: string;
}

interface Task {
  id: number;
  name: string;
  department_id: number;
  is_active: boolean;
  todos: Todo[];
}

interface HistoryEntry {
  id: number;
  work_date: string;
  task_id: number;
  todo_id: number;
  start_time: string;
  end_time: string;
  focused_minutes: number;
  notes: string;
  task?: { name: string };
  todo?: { title: string };
}

const HISTORY_PAGE_SIZE = 15;

/** Convert Jalali (YYYY/MM/DD) → Gregorian (YYYY-MM-DD) for backend */
function jalaliToGregorian(jalaliStr: string): string {
  const [y, m, d] = jalaliStr.split("/").map(Number);
  const dateObj = new DateObject({
    year: y,
    month: m,
    day: d,
    calendar: persian,
  });
  dateObj.convert(gregorian);
  return `${dateObj.year}-${String(dateObj.month.number).padStart(2, "0")}-${String(dateObj.day).padStart(2, "0")}`;
}

export default function LogsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);

  // Today's Jalali date for the picker default
  const todayJalali = format(new Date(), "yyyy/MM/dd");
  const [jalaliParts] = useState(() => {
    const [y, m, d] = todayJalali.split("/").map(Number);
    return { y, m, d };
  });

  // No todo_id in form — auto-derived from selected task
  const [formData, setFormData] = useState({
    work_date: todayJalali,
    task_id: "",
    start_time: "08:00",
    end_time: "16:00",
    focused_minutes: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksData, historyData] = await Promise.all([
          api<Task[]>("/tasks"),
          api<HistoryEntry[]>("/timesheets/history"),
        ]);
        setTasks(tasksData);
        setHistory(historyData);
      } catch (err: any) {
        console.error("Failed to fetch data", err);
      }
    }
    fetchData();
  }, []);

  const calculateDuration = () => {
    const [startH, startM] = formData.start_time.split(":").map(Number);
    const [endH, endM] = formData.end_time.split(":").map(Number);
    const diff = endH * 60 + endM - (startH * 60 + startM);
    return diff > 0 ? diff : 0;
  };

  const durationMinutes = calculateDuration();
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;

  // Auto-selected task & its todos
  const selectedTask = tasks.find((t) => t.id === Number(formData.task_id));
  const taskTodos = selectedTask?.todos || [];
  const autoTodoId = taskTodos.length > 0 ? taskTodos[0].id : null;

  const handleTaskChange = (taskId: string) => {
    setFormData((prev) => ({ ...prev, task_id: taskId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const focused = Number(formData.focused_minutes);
    if (!formData.focused_minutes || focused <= 0) {
      setMessage({
        type: "error",
        text: "امتیاز تمرکز باید بزرگتر از صفر باشد",
      });
      return;
    }
    if (focused > durationMinutes) {
      setMessage({
        type: "error",
        text: "امتیاز تمرکز نمی‌تواند بیشتر از مدت زمان باشد",
      });
      return;
    }
    if (!formData.task_id) {
      setMessage({ type: "error", text: "لطفاً یک وظیفه انتخاب کنید" });
      return;
    }
    if (!autoTodoId) {
      setMessage({ type: "error", text: "این وظیفه هنوز شرح فعالیتی ندارد" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await api("/timesheets", {
        method: "POST",
        body: JSON.stringify({
          work_date: jalaliToGregorian(formData.work_date),
          task_id: Number(formData.task_id),
          todo_id: autoTodoId,
          start_time: formData.start_time,
          end_time: formData.end_time,
          focused_minutes: focused,
          notes: formData.notes.trim() || null,
        }),
      });
      setMessage({ type: "success", text: "ثبت با موفقیت انجام شد" });
      setFormData((prev) => ({
        ...prev,
        task_id: "",
        focused_minutes: "",
        notes: "",
      }));
      const data = await api<HistoryEntry[]>("/timesheets/history");
      setHistory(data);
      setHistoryPage(1);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "خطایی در ثبت رخ داد" });
    } finally {
      setLoading(false);
    }
  };

  // Paginated history
  const historyTotalPages = Math.max(
    1,
    Math.ceil(history.length / HISTORY_PAGE_SIZE),
  );
  const paginatedHistory = useMemo(
    () =>
      history.slice(
        (historyPage - 1) * HISTORY_PAGE_SIZE,
        historyPage * HISTORY_PAGE_SIZE,
      ),
    [history, historyPage],
  );

  const toJalaliDisplay = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy/MM/dd");
    } catch {
      return dateStr;
    }
  };

  const getTaskName = (taskId: number) =>
    tasks.find((t) => t.id === taskId)?.name || `تسک #${taskId}`;

  const getTodoTitle = (entry: HistoryEntry) => {
    if (entry.todo) return entry.todo.title;
    for (const task of tasks) {
      const todo = task.todos.find((t) => t.id === entry.todo_id);
      if (todo) return todo.title;
    }
    return entry.notes || "—";
  };

  // Pagination component
  const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (p: number) => void;
  }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <span className="text-sm text-slate-500">
          صفحه {currentPage} از {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            className="px-3 py-1 rounded-lg text-sm border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            قبلی
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                page === currentPage
                  ? "bg-accent text-white"
                  : "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
          <button
            className="px-3 py-1 rounded-lg text-sm border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            بعدی
          </button>
        </div>
      </div>
    );
  };

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">ثبت گزارش روزانه</h1>
          <p className="mt-1 text-sm text-slate-500">
            لطفاً جزئیات فعالیت‌های خود را وارد کنید
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-5">
          {/* ── Persian Calendar Date Picker ── */}
          <div className="space-y-1 text-right">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              تاریخ (شمسی)
            </label>
            <DatePicker
              value={
                new DateObject({
                  year: jalaliParts.y,
                  month: jalaliParts.m,
                  day: jalaliParts.d,
                  calendar: persian,
                  locale: persian_fa,
                })
              }
              onChange={(date: any) => {
                if (date && !Array.isArray(date)) {
                  const y = date.year;
                  const m = String(date.month.number ?? date.month).padStart(
                    2,
                    "0",
                  );
                  const d = String(date.day).padStart(2, "0");
                  setFormData((prev) => ({
                    ...prev,
                    work_date: `${y}/${m}/${d}`,
                  }));
                }
              }}
              calendar={persian}
              locale={persian_fa}
              format="YYYY/MM/DD"
              inputClass="input w-full"
              calendarPosition="bottom-right"
            />
          </div>

          {/* ── Task selector ── */}
          <div className="space-y-1 text-right">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              عنوان وظیفه
            </label>
            <select
              className="input w-full"
              value={formData.task_id}
              onChange={(e) => handleTaskChange(e.target.value)}
              required
            >
              <option value="">انتخاب کنید...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* ── Auto-displayed activity description (NOT an input) ── */}
          {formData.task_id && (
            <div className="space-y-2 text-right">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                شرح فعالیت (خودکار)
              </label>
              {taskTodos.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900 whitespace-pre-line leading-relaxed">
                  {taskTodos.map((todo, i) => (
                    <div
                      key={todo.id}
                      className={
                        i > 0
                          ? "mt-2 pt-2 border-t border-slate-200 dark:border-slate-700"
                          : ""
                      }
                    >
                      <span className="text-slate-700 dark:text-slate-300">
                        {todo.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  این وظیفه هنوز شرح فعالیتی ندارد
                </div>
              )}
            </div>
          )}

          {/* ── Start & End Time — strict 24-hour format ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 text-right">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                ساعت شروع (۲۴ ساعته)
              </label>
              <input
                type="time"
                className="input w-full"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                required
                step={60}
              />
            </div>
            <div className="space-y-1 text-right">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                ساعت پایان (۲۴ ساعته)
              </label>
              <input
                type="time"
                className="input w-full"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                required
                step={60}
              />
            </div>
          </div>

          {/* ── Calculated duration ── */}
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
            <span className="text-slate-500 dark:text-slate-400">
              مدت زمان (محاسبه شده):
            </span>{" "}
            <span className="font-medium">
              {durationHours} ساعت و {durationMins} دقیقه
            </span>
          </div>

          {/* ── Focus score ── */}
          <div className="space-y-1 text-right">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              امتیاز تمرکز (دقیقه)
            </label>
            <input
              type="number"
              className="input w-full"
              value={formData.focused_minutes}
              onChange={(e) =>
                setFormData({ ...formData, focused_minutes: e.target.value })
              }
              max={durationMinutes}
              min={1}
              placeholder={durationMinutes > 0 ? String(durationMinutes) : "0"}
              required
            />
            {formData.focused_minutes &&
              Number(formData.focused_minutes) > durationMinutes && (
                <p className="text-xs text-red-600">
                  امتیاز تمرکز نمی‌تواند بیشتر از مدت زمان باشد
                </p>
              )}
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1 text-right">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              یادداشت‌ها
            </label>
            <textarea
              className="input w-full"
              rows={3}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="توضیحات اضافی (اختیاری)..."
            />
          </div>

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? "در حال ثبت..." : "ثبت گزارش"}
          </button>
        </form>

        {/* ── History Table with Pagination ── */}
        {history.length > 0 && (
          <div className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-medium">تاریخچه گزارش‌ها</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 text-right">تاریخ</th>
                  <th className="p-3 text-right">وظیفه</th>
                  <th className="p-3 text-right">شرح فعالیت</th>
                  <th className="p-3 text-right">شروع</th>
                  <th className="p-3 text-right">پایان</th>
                  <th className="p-3 text-right">تمرکز</th>
                  <th className="p-3 text-right">یادداشت</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950"
                  >
                    <td className="p-3 whitespace-nowrap">
                      {toJalaliDisplay(entry.work_date)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getTaskName(entry.task_id)}
                    </td>
                    <td className="p-3 whitespace-pre-line leading-relaxed max-w-xs">
                      {getTodoTitle(entry)}
                    </td>
                    <td className="p-3 whitespace-nowrap font-mono text-xs">
                      {entry.start_time}
                    </td>
                    <td className="p-3 whitespace-nowrap font-mono text-xs">
                      {entry.end_time}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {entry.focused_minutes} دقیقه
                    </td>
                    <td className="p-3 whitespace-pre-line max-w-xs text-xs">
                      {entry.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={historyPage}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
            />
          </div>
        )}
      </div>
    </Shell>
  );
}
