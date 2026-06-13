'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { api, ApiError } from '@/lib/api';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  department_id: number;
  is_active: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface Todo {
  id: number;
  title: string;
  priority: number;
  weight: number;
  is_active: boolean;
}

interface AdminTask {
  id: number;
  name: string;
  department_id: number;
  is_active: boolean;
  todos: Todo[];
}

type Tab = 'users' | 'depts' | 'tasks' | 'import';
type Message = { type: 'success' | 'error'; text: string } | null;

const PRIORITY_OPTIONS = [
  { value: 1, label: 'عادی (۱)' },
  { value: 2, label: 'مهم (۲)' },
  { value: 3, label: 'فوری (۳)' },
];

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [message, setMessage] = useState<Message>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'EMPLOYEE',
    department_id: '',
  });
  const [newDept, setNewDept] = useState({ name: '' });
  const [newTask, setNewTask] = useState({
    department_id: '',
    name: '',
    quality: '',
    priority: 1,
    weight: 1,
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDeptId, setImportDeptId] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    fetchBaseData();
  }, []);

  async function fetchBaseData() {
    try {
      const [u, d] = await Promise.all([api<User[]>('/admin/users'), api<Department[]>('/admin/departments')]);
      setUsers(u);
      setDepts(d);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    }
  }

  async function fetchTasks() {
    try {
      setTasks(await api<AdminTask[]>('/admin/tasks'));
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  }

  function flash(msg: Message) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }

  function errMsg(e: unknown, fallback: string): string {
    return e instanceof ApiError ? e.message : e instanceof Error ? e.message : fallback;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...newUser, department_id: Number(newUser.department_id) }),
      });
      flash({ type: 'success', text: 'کاربر با موفقیت ایجاد شد' });
      setNewUser({ username: '', full_name: '', password: '', role: 'EMPLOYEE', department_id: '' });
      fetchBaseData();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در ایجاد کاربر') });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/admin/departments', { method: 'POST', body: JSON.stringify(newDept) });
      flash({ type: 'success', text: 'دپارتمان با موفقیت ایجاد شد' });
      setNewDept({ name: '' });
      fetchBaseData();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در ایجاد دپارتمان') });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/admin/tasks', {
        method: 'POST',
        body: JSON.stringify({
          department_id: Number(newTask.department_id),
          name: newTask.name.trim(),
          quality: newTask.quality.trim(),
          priority: Number(newTask.priority),
          weight: Number(newTask.weight),
        }),
      });
      flash({ type: 'success', text: 'وظیفه جدید با موفقیت ایجاد شد' });
      setNewTask({ department_id: newTask.department_id, name: '', quality: '', priority: 1, weight: 1 });
      fetchTasks();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در ایجاد وظیفه') });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      flash({ type: 'success', text: 'کاربر حذف شد' });
      fetchBaseData();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در حذف کاربر') });
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      setPreviewData(await api<any>('/admin/import-tasks/preview', { method: 'POST', body: formData }));
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در پیش‌نمایش فایل') });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile || !importDeptId) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('department_id', importDeptId);
    formData.append('file', importFile);
    try {
      await api('/admin/import-tasks', { method: 'POST', body: formData });
      flash({ type: 'success', text: 'داده‌ها با موفقیت وارد شدند' });
      setPreviewData(null);
      setImportFile(null);
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در وارد کردن داده‌ها') });
    } finally {
      setLoading(false);
    }
  };

  const deptName = (id: number) => depts.find((d) => d.id === id)?.name || 'نامشخص';

  const tabBtn = (tab: Tab, label: string) =>
    `px-4 py-2 rounded-lg text-sm transition ${activeTab === tab ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300'}`;

  return (
    <Shell>
      <div className="mx-auto max-w-6xl" dir="rtl">
        <div className="mb-8 text-right">
          <h1 className="mb-2 text-3xl font-bold">پنل مدیریت</h1>
          <p className="text-slate-500">مدیریت کاربران، دپارتمان‌ها و وظایف سیستم</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <button className={tabBtn('users', '')} onClick={() => setActiveTab('users')}>مدیریت کاربران</button>
          <button className={tabBtn('depts', '')} onClick={() => setActiveTab('depts')}>دپارتمان‌ها</button>
          <button className={tabBtn('tasks', '')} onClick={() => { setActiveTab('tasks'); fetchTasks(); }}>وظایف</button>
          <button className={tabBtn('import', '')} onClick={() => setActiveTab('import')}>وارد کردن وظایف (اکسل)</button>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg p-4 text-sm text-right ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* ---------------- Users ---------------- */}
        {activeTab === 'users' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card h-fit space-y-4 p-6">
              <h2 className="mb-4 text-lg font-semibold">ایجاد کاربر جدید</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs">نام کاربری</label>
                  <input className="input w-full" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">نام کامل</label>
                  <input className="input w-full" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">رمز عبور (حداقل ۶ کاراکتر)</label>
                  <input className="input w-full" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required minLength={6} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">نقش</label>
                  <select className="input w-full" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="EMPLOYEE">کارمند</option>
                    <option value="MANAGER">مدیر</option>
                    <option value="ADMIN">ادمین</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs">دپارتمان</label>
                  <select className="input w-full" value={newUser.department_id} onChange={(e) => setNewUser({ ...newUser, department_id: e.target.value })} required>
                    <option value="">انتخاب کنید...</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button className="btn w-full" disabled={loading}>{loading ? 'در حال ثبت...' : 'ایجاد کاربر'}</button>
              </form>
            </div>

            <div className="card overflow-x-auto p-6 lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold">لیست کاربران</h2>
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 font-medium">نام کاربری</th>
                    <th className="pb-2 font-medium">نام کامل</th>
                    <th className="pb-2 font-medium">نقش</th>
                    <th className="pb-2 font-medium">دپارتمان</th>
                    <th className="pb-2 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3">{u.username}</td>
                      <td className="py-3">{u.full_name}</td>
                      <td className="py-3">{u.role}</td>
                      <td className="py-3">{deptName(u.department_id)}</td>
                      <td className="py-3">
                        <button className="ml-3 text-red-600 hover:underline" onClick={() => handleDeleteUser(u.id)}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- Departments ---------------- */}
        {activeTab === 'depts' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card h-fit space-y-4 p-6">
              <h2 className="mb-4 text-lg font-semibold">ایجاد دپارتمان جدید</h2>
              <form onSubmit={handleCreateDept} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs">نام دپارتمان</label>
                  <input className="input w-full" value={newDept.name} onChange={(e) => setNewDept({ name: e.target.value })} required />
                </div>
                <button className="btn w-full" disabled={loading}>{loading ? 'در حال ثبت...' : 'ایجاد دپارتمان'}</button>
              </form>
            </div>
            <div className="card p-6 lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold">لیست دپارتمان‌ها</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {depts.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span>{d.name}</span>
                    <span className="text-xs text-slate-400">ID: {d.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Tasks ---------------- */}
        {activeTab === 'tasks' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card h-fit space-y-4 p-6">
              <h2 className="mb-4 text-lg font-semibold">ایجاد وظیفه جدید</h2>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs">دپارتمان</label>
                  <select className="input w-full" value={newTask.department_id} onChange={(e) => setNewTask({ ...newTask, department_id: e.target.value })} required>
                    <option value="">انتخاب کنید...</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs">عنوان وظیفه (Task Title)</label>
                  <input className="input w-full" value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">کیفیت / شرح فعالیت (Quality)</label>
                  <input className="input w-full" value={newTask.quality} onChange={(e) => setNewTask({ ...newTask, quality: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">اولویت (Priority)</label>
                  <select className="input w-full" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: Number(e.target.value) })}>
                    {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs">وزن (Weight)</label>
                  <input className="input w-full" type="number" step="0.01" min="0" value={newTask.weight} onChange={(e) => setNewTask({ ...newTask, weight: Number(e.target.value) })} required />
                </div>
                <button className="btn w-full" disabled={loading}>{loading ? 'در حال ثبت...' : 'ایجاد وظیفه'}</button>
              </form>
            </div>

            <div className="card p-6 lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold">لیست وظایف</h2>
              {tasks.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">هنوز وظیفه‌ای ثبت نشده است.</p>
              ) : (
                <div className="space-y-4">
                  {tasks.map((t) => (
                    <div key={t.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-slate-400">{deptName(t.department_id)}</span>
                      </div>
                      {t.todos.length > 0 && (
                        <table className="mt-3 w-full text-xs text-right">
                          <thead className="text-slate-400">
                            <tr>
                              <th className="pb-1 font-normal">شرح (Quality)</th>
                              <th className="pb-1 font-normal">اولویت</th>
                              <th className="pb-1 font-normal">وزن</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.todos.map((todo) => (
                              <tr key={todo.id} className="border-t border-slate-100">
                                <td className="py-2">{todo.title}</td>
                                <td className="py-2">{todo.priority}</td>
                                <td className="py-2">{todo.weight}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- Excel import ---------------- */}
        {activeTab === 'import' && (
          <div className="card space-y-6 p-6">
            <h2 className="mb-4 text-lg font-semibold">وارد کردن مپینگ وظایف از اکسل</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">انتخاب دپارتمان</label>
                  <select className="input w-full" value={importDeptId} onChange={(e) => setImportDeptId(e.target.value)} required>
                    <option value="">انتخاب کنید...</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">فایل اکسل (Sheet: Task_Mapping)</label>
                  <input type="file" className="input w-full" accept=".xlsx, .xls" onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)} required />
                </div>
                <button className="btn w-full" disabled={loading || !importFile} onClick={handlePreviewImport}>
                  {loading ? 'در حال پردازش...' : 'پیش‌نمایش داده‌ها'}
                </button>
              </div>

              <div className="space-y-4">
                {previewData ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                      فایل معتبر است. تعداد ردیف‌ها: {previewData.total_rows}
                    </div>
                    <div className="max-h-64 overflow-auto rounded-lg border">
                      <table className="w-full text-right text-xs">
                        <thead className="sticky top-0 bg-slate-100">
                          <tr>
                            <th className="p-2">وظیفه</th>
                            <th className="p-2">شرح (Quality)</th>
                            <th className="p-2">وزن</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.rows.map((row: any, i: number) => (
                            <tr key={i} className="border-t border-slate-200">
                              <td className="p-2">{row['Task Title']}</td>
                              <td className="p-2">{row['Quality']}</td>
                              <td className="p-2">{row['Weight']}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="btn w-full bg-green-600 text-white hover:bg-green-700" disabled={loading || !importDeptId} onClick={handleConfirmImport}>
                      تأیید و ثبت در دیتابیس
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed p-12 text-sm italic text-slate-400">
                    ابتدا فایل را برای پیش‌نمایش آپلود کنید
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
