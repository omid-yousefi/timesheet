"use client";

import { useState, useEffect, useCallback } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { todayJalaliStr } from "@/lib/jalali";

// Persian (Jalali) calendar date picker
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface Employee {
  id: number;
  full_name: string;
  username: string;
  department_id: number;
}

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

interface Report {
  id: number;
  work_date: string; // Now Jalali "1404/03/24" from backend
  work_date_jalali?: string;
  task_id: number;
  todo_id: number;
  start_time: string;
  end_time: string;
  focused_minutes: number;
  notes: string | null;
  task?: { id: number; name: string };
  todo?: { id: number; title: string };
}

interface EditForm {
  task_id: string;
  start_time: string;
  end_time: string;
  focused_minutes: string;
  notes: string;
}

const EMPTY_FORM: EditForm = {
  task_id: "",
  start_time: "08:00",
  end_time: "16:00",
  focused_minutes: "",
  notes: "",
};

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

export default function ManagerReportsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  // Jalali date string "YYYY/MM/DD"
  const [jalaliDate, setJalaliDate] = useState<string>(() => todayJalaliStr());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Inline edit state (report id currently being edited, or "new")
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Backend now accepts Jalali directly, no conversion needed
  const queryDate = jalaliDate;

  // Load the manager's editable employees once.
  useEffect(() => {
    api<Employee[]>("/manager/employees")
      .then(setEmployees)
      .catch((err) => console.error("Failed to load employees", err));
  }, []);

  const loadReports = useCallback(async () => {
    if (!selectedEmployee || !queryDate) {
      setReports([]);
      return;
    }
    setLoading(true);
    setEditingId(null);
    try {
      const [tasksData, reportsData] = await Promise.all([
        api<Task[]>(`/manager/employees/${selectedEmployee}/tasks`),
        api<Report[]>(
          `/manager/employees/${selectedEmployee}/reports?work_date=${encodeURIComponent(queryDate)}`,
        ),
      ]);
      setTasks(tasksData);
      setReports(reportsData);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "خطا در دریافت گزارش‌ها",
      });
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, queryDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const getTaskName = (taskId: number) =>
    tasks.find((t) => t.id === taskId)?.name || `تسک #${taskId}`;

  const getTodoTitle = (r: Report) => {
    if (r.todo) return r.todo.title;
    for (const t of tasks) {
      const td = t.todos.find((x) => x.id === r.todo_id);
      if (td) return td.title;
    }
    return r.notes || "—";
  };

  const startEdit = (r: Report) => {
    setEditingId(r.id);
    setForm({
      task_id: String(r.task_id),
      start_time: r.start_time.slice(0, 5),
      end_time: r.end_time.slice(0, 5),
      focused_minutes: String(r.focused_minutes),
      notes: r.notes || "",
    });
    setMessage(null);
  };

  const startAdd = () => {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const selectedTask = tasks.find((t) => t.id === Number(form.task_id));
  const autoTodoId = selectedTask?.todos?.[0]?.id ?? null;
  const formDuration = durationMinutes(form.start_time, form.end_time);

  const submitForm = async () => {
    const focused = Number(form.focused_minutes);
    if (!form.task_id) {
      setMessage({ type: "error", text: "لطفاً یک وظیفه انتخاب کنید" });
      return;
    }
    if (!autoTodoId) {
      setMessage({ type: "error", text: "این وظیفه شرح فعالیتی ندارد" });
      return;
    }
    if (!focused || focused <= 0) {
      setMessage({ type: "error", text: "امتیاز تمرکز باید بزرگتر از صفر باشد" });
      return;
    }
    if (focused > formDuration) {
      setMessage({
        type: "error",
        text: "امتیاز تمرکز نمی‌تواند بیشتر از مدت زمان باشد",
      });
      return;
    }

    const body = JSON.stringify({
      work_date: jalaliDate, // Send Jalali directly
      task_id: Number(form.task_id),
      todo_id: autoTodoId,
      start_time: form.start_time,
      end_time: form.end_time,
      focused_minutes: focused,
      notes: form.notes.trim() || null,
    });

    setSaving(true);
    setMessage(null);
    try {
      if (editingId === "new") {
        await api(`/manager/employees/${selectedEmployee}/reports`, {
          method: "POST",
          body,
        });
        setMessage({ type: "success", text: "گزارش جدید ثبت شد" });
      } else {
        await api(
          `/manager/employees/${selectedEmployee}/reports/${editingId}`,
          { method: "PUT", body },
        );
        setMessage({ type: "success", text: "گزارش ویرایش شد" });
      }
      cancelEdit();
      await loadReports();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "خطا در ذخیره گزارش" });
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (id: number) => {
    if (!confirm("این گزارش حذف شود؟")) return;
    try {
      await api(`/manager/employees/${selectedEmployee}/reports/${id}`, {
        method: "DELETE",
      });
      setMessage({ type: "success", text: "گزارش حذف شد" });
      await loadReports();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "خطا در حذف گزارش" });
    }
  };

  // Reusable edit/add form row
  const FormCard = () => (
    <div className="card space-y-4 border-accent/40">
      <h3 className="font-medium">
        {editingId === "new" ? "افزودن گزارش جدید" : "ویرایش گزارش"}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1 text-right">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            عنوان وظیفه
          </label>
          <select
            className="input w-full"
            value={form.task_id}
            onChange={(e) => setForm({ ...form, task_id: e.target.value })}
          >
            <option value="">انتخاب کنید...</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 text-right">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            امتیاز تمرکز (دقیقه)
          </label>
          <input
            type="number"
            className="input w-full"
            value={form.focused_minutes}
            min={1}
            max={formDuration}
            onChange={(e) =>
              setForm({ ...form, focused_minutes: e.target.value })
            }
            placeholder={formDuration > 0 ? String(formDuration) : "0"}
          />
        </div>

        <div className="space-y-1 text-right">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            ساعت شروع (۲۴ ساعته)
          </label>
          <input
            type="time"
            step={60}
            className="input w-full"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </div>

        <div className="space-y-1 text-right">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            ساعت پایان (۲۴ ساعته)
          </label>
          <input
            type="time"
            step={60}
            className="input w-full"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </div>
      </div>

      {selectedTask && selectedTask.todos.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <span className="text-xs text-slate-500">شرح فعالیت (خودکار): </span>
          {selectedTask.todos[0].title}
        </div>
      )}

      <div className="space-y-1 text-right">
        <label className="text-xs text-slate-600 dark:text-slate-300">
          یادداشت‌ها
        </label>
        <textarea
          className="input w-full"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="توضیحات اضافی (اختیاری)..."
        />
      </div>

      <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-900">
        مدت زمان: {Math.floor(formDuration / 60)} ساعت و {formDuration % 60} دقیقه
      </div>

      <div className="flex gap-2">
        <button
          className="btn"
          onClick={submitForm}
          disabled={saving}
          type="button"
        >
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </button>
        <button
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={cancelEdit}
          type="button"
        >
          انصراف
        </button>
      </div>
    </div>
  );

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">ویرایش گزارش‌های کارکنان</h1>
          <p className="mt-1 text-sm text-slate-500">
            گزارش روزانه کارکنان دپارتمان خود را مشاهده و ویرایش کنید
          </p>
        </div>

        {/* Filters */}
        <div className="card grid gap-4 md:grid-cols-2">
          <div className="space-y-1 text-right">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              کارمند
            </label>
            <select
              className="input w-full"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">انتخاب کارمند...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.username})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-right">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              تاریخ (شمسی)
            </label>
            <DatePicker
              value={jalaliDate}
              onChange={(date: any) => {
                if (date && !Array.isArray(date)) {
                  const y = date.year;
                  const m = String(date.month.number ?? date.month).padStart(
                    2,
                    "0",
                  );
                  const d = String(date.day).padStart(2, "0");
                  setJalaliDate(`${y}/${m}/${d}`);
                }
              }}
              calendar={persian}
              locale={persian_fa}
              format="YYYY/MM/DD"
              inputClass="input w-full"
              calendarPosition="bottom-right"
            />
          </div>
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

        {/* Reports for the selected employee + date */}
        {!selectedEmployee ? (
          <div className="card py-12 text-center text-slate-500">
            برای مشاهده گزارش‌ها، یک کارمند را انتخاب کنید
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="rounded-xl bg-accent/5 border border-accent/20 px-4 py-2 text-sm text-accent">
                📅 گزارش‌های تاریخ {jalaliDate}
              </div>
              {editingId === null && (
                <button className="btn" type="button" onClick={startAdd}>
                  + افزودن گزارش
                </button>
              )}
            </div>

            {editingId === "new" && <FormCard />}

            <div className="card overflow-x-auto">
              {reports.length === 0 && editingId === null ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  برای این روز گزارشی ثبت نشده است
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 text-right">وظیفه</th>
                      <th className="p-3 text-right">شرح فعالیت</th>
                      <th className="p-3 text-right">شروع</th>
                      <th className="p-3 text-right">پایان</th>
                      <th className="p-3 text-right">تمرکز</th>
                      <th className="p-3 text-right">یادداشت</th>
                      <th className="p-3 text-right">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950"
                      >
                        <td className="p-3 whitespace-nowrap">
                          {getTaskName(r.task_id)}
                        </td>
                        <td className="p-3 whitespace-pre-line max-w-xs">
                          {getTodoTitle(r)}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {r.start_time.slice(0, 5)}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {r.end_time.slice(0, 5)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.focused_minutes} دقیقه
                        </td>
                        <td className="p-3 max-w-xs text-xs whitespace-pre-line">
                          {r.notes || "—"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              className="text-accent hover:underline text-xs"
                              onClick={() => startEdit(r)}
                              type="button"
                            >
                              ویرایش
                            </button>
                            <button
                              className="text-red-500 hover:underline text-xs"
                              onClick={() => deleteReport(r.id)}
                              type="button"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {typeof editingId === "number" && <FormCard />}
          </div>
        )}
      </div>
    </Shell>
  );
}
