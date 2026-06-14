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

const TASK_PAGE_SIZE = 10;

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [message, setMessage] = useState<Message>(null);

  // Department filter for tasks
  const [taskDeptFilter, setTaskDeptFilter] = useState<string>('');
  const [taskPage, setTaskPage] = useState(1);

  // User form
  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'EMPLOYEE',
    department_id: '',
  });

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    full_name: '',
    password: '',
    role: 'EMPLOYEE',
    department_id: '',
    is_active: true,
  });

  // Department form
  const [newDept, setNewDept] = useState({ name: '' });

  // Task form
  const [newTask, setNewTask] = useState({
    department_id: '',
    name: '',
    quality: '',
    priority: 1,
    weight: 1,
  });

  // Edit task state
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    name: '',
    department_id: '',
    quality: '',
    priority: 1,
    weight: 1,
    is_active: true,
  });

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDeptId, setImportDeptId] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    fetchBaseData();
  }, []);

  async function fetchBaseData() {
    try {
      const [u, d] = await Promise.all([
        api<User[]>('/admin/users'),
        api<Department[]>('/admin/departments'),
      ]);
      setUsers(u);
      setDepts(d);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    }
  }

  async function fetchTasks() {
    try {
      const params = taskDeptFilter ? `?department_id=${taskDeptFilter}` : '';
      const data = await api<AdminTask[]>(`/admin/tasks${params}`);
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  }

  async function fetchTasksFiltered(deptId: string) {
    try {
      const params = deptId ? `?department_id=${deptId}` : '';
      const data = await api<AdminTask[]>(`/admin/tasks${params}`);
      setTasks(data);
      setTaskPage(1);
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

  // ─── User CRUD ───
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

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      full_name: user.full_name,
      password: '',
      role: user.role,
      department_id: String(user.department_id),
      is_active: user.is_active,
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const payload: any = {
        full_name: editUserForm.full_name,
        role: editUserForm.role,
        department_id: Number(editUserForm.department_id),
        is_active: editUserForm.is_active,
      };
      if (editUserForm.password) {
        payload.password = editUserForm.password;
      }
      await api(`/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      flash({ type: 'success', text: 'کاربر با موفقیت ویرایش شد' });
      setEditingUser(null);
      fetchBaseData();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در ویرایش کاربر') });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    const user = users.find(u => u.id === id);
    if (user?.role === 'ADMIN') {
      flash({ type: 'error', text: 'حذف کاربر ادمین امکان‌پذیر نیست' });
      return;
    }
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      flash({ type: 'success', text: 'کاربر حذف شد' });
      fetchBaseData();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در حذف کاربر') });
    }
  };

  // ─── Department CRUD ───
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

  // ─── Task CRUD ───
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

  const handleEditTask = (task: AdminTask) => {
    setEditingTask(task);
    const firstTodo = task.todos[0];
    setEditTaskForm({
      name: task.name,
      department_id: String(task.department_id),
      quality: firstTodo?.title || '',
      priority: firstTodo?.priority || 1,
      weight: firstTodo?.weight || 1,
      is_active: task.is_active,
    });
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setLoading(true);
    try {
      await api(`/admin/tasks/${editingTask.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editTaskForm.name.trim(),
          department_id: Number(editTaskForm.department_id),
          quality: editTaskForm.quality.trim(),
          priority: Number(editTaskForm.priority),
          weight: Number(editTaskForm.weight),
          is_active: editTaskForm.is_active,
        }),
      });
      flash({ type: 'success', text: 'وظیفه با موفقیت ویرایش شد' });
      setEditingTask(null);
      fetchTasks();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در ویرایش وظیفه') });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm('آیا از حذف این وظیفه مطمئن هستید؟')) return;
    try {
      await api(`/admin/tasks/${id}`, { method: 'DELETE' });
      flash({ type: 'success', text: 'وظیفه حذف شد' });
      fetchTasks();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در حذف وظیفه') });
    }
  };

  // ─── Excel Import ───
  const handlePreviewImport = async () => {
    if (!importFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      setPreviewData(await api('/admin/import-tasks/preview', { method: 'POST', body: formData }));
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
      fetchTasks();
    } catch (err: any) {
      flash({ type: 'error', text: errMsg(err, 'خطا در وارد کردن داده‌ها') });
    } finally {
      setLoading(false);
    }
  };

  // ─── Helpers ───
  const deptName = (id: number) => depts.find((d) => d.id === id)?.name || 'نامشخص';
  const roleLabel = (role: string) => {
    const labels: Record<string, string> = { ADMIN: 'ادمین', MANAGER: 'مدیر', EMPLOYEE: 'کارمند' };
    return labels[role] || role;
  };

  const tabBtn = (tab: Tab, label: string) =>
    `px-4 py-2 rounded-lg text-sm transition ${
      activeTab === tab
        ? 'bg-accent text-white'
        : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300'
    }`;

  const taskTotalPages = Math.max(1, Math.ceil(tasks.length / TASK_PAGE_SIZE));
  const safeTaskPage = Math.min(taskPage, taskTotalPages);
  const paginatedTasks = tasks.slice((safeTaskPage - 1) * TASK_PAGE_SIZE, safeTaskPage * TASK_PAGE_SIZE);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">پنل مدیریت</h1>
          <p className="mt-1 text-sm text-slate-500">مدیریت کاربران، دپارتمان‌ها و وظایف سیستم</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button className={tabBtn('users', 'users')} onClick={() => setActiveTab('users')}>
            مدیریت کاربران
          </button>
          <button className={tabBtn('depts', 'depts')} onClick={() => setActiveTab('depts')}>
            دپارتمان‌ها
          </button>
          <button
            className={tabBtn('tasks', 'tasks')}
            onClick={() => {
              setActiveTab('tasks');
              fetchTasks();
            }}
          >
            وظایف
          </button>
          <button className={tabBtn('import', 'import')} onClick={() => setActiveTab('import')}>
            وارد کردن وظایف (اکسل)
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ════════════════ Users Tab ════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Create User */}
            <div className="card">
              <h2 className="mb-4 text-lg font-medium">ایجاد کاربر جدید</h2>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">نام کاربری</label>
                  <input
                    className="input w-full"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">نام کامل</label>
                  <input
                    className="input w-full"
                    value={newUser.full_name}
                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">رمز عبور (حداقل ۶ کاراکتر)</label>
                  <input
                    type="password"
                    className="input w-full"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">نقش</label>
                  <select
                    className="input w-full"
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="EMPLOYEE">کارمند</option>
                    <option value="MANAGER">مدیر</option>
                    <option value="ADMIN">ادمین</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600 dark:text-slate-300">دپارتمان</label>
                  <select
                    className="input w-full"
                    value={newUser.department_id}
                    onChange={e => setNewUser({ ...newUser, department_id: e.target.value })}
                    required
                  >
                    <option value="">انتخاب کنید...</option>
                    {depts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button className="btn w-full" type="submit" disabled={loading}>
                    {loading ? 'در حال ثبت...' : 'ایجاد کاربر'}
                  </button>
                </div>
              </form>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
              <div className="card border-accent">
                <h2 className="mb-4 text-lg font-medium">ویرایش کاربر: {editingUser.full_name}</h2>
                <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">نام کامل</label>
                    <input
                      className="input w-full"
                      value={editUserForm.full_name}
                      onChange={e => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">رمز عبور (خالی = بدون تغییر)</label>
                    <input
                      type="password"
                      className="input w-full"
                      value={editUserForm.password}
                      onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })}
                      minLength={6}
                      placeholder="خالی بگذارید اگر نمی‌خواهید تغییر کند"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">نقش</label>
                    <select
                      className="input w-full"
                      value={editUserForm.role}
                      onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    >
                      <option value="EMPLOYEE">کارمند</option>
                      <option value="MANAGER">مدیر</option>
                      <option value="ADMIN">ادمین</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">دپارتمان</label>
                    <select
                      className="input w-full"
                      value={editUserForm.department_id}
                      onChange={e => setEditUserForm({ ...editUserForm, department_id: e.target.value })}
                      required
                    >
                      <option value="">انتخاب کنید...</option>
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editUserForm.is_active}
                      onChange={e => setEditUserForm({ ...editUserForm, is_active: e.target.checked })}
                    />
                    <span className="text-sm">فعال</span>
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button className="btn flex-1" type="submit" disabled={loading}>
                      {loading ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => setEditingUser(null)}
                    >
                      انصراف
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* User List */}
            <div className="card overflow-x-auto">
              <h2 className="mb-4 text-lg font-medium">لیست کاربران</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 text-right">نام کاربری</th>
                    <th className="p-3 text-right">نام کامل</th>
                    <th className="p-3 text-right">نقش</th>
                    <th className="p-3 text-right">دپارتمان</th>
                    <th className="p-3 text-right">وضعیت</th>
                    <th className="p-3 text-right">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950">
                      <td className="p-3">{u.username}</td>
                      <td className="p-3">{u.full_name}</td>
                      <td className="p-3">{roleLabel(u.role)}</td>
                      <td className="p-3">{deptName(u.department_id)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                          {u.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="p-3 flex gap-2">
                        <button
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                          onClick={() => handleEditUser(u)}
                        >
                          ویرایش
                        </button>
                        {u.role !== 'ADMIN' && (
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            حذف
                          </button>
                        )}
                        {u.role === 'ADMIN' && (
                          <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed">
                            حذف غیرمجاز
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════ Departments Tab ════════════════ */}
        {activeTab === 'depts' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="mb-4 text-lg font-medium">ایجاد دپارتمان جدید</h2>
              <form onSubmit={handleCreateDept} className="flex gap-3">
                <input
                  className="input flex-1"
                  placeholder="نام دپارتمان"
                  value={newDept.name}
                  onChange={e => setNewDept({ name: e.target.value })}
                  required
                />
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'در حال ثبت...' : 'ایجاد دپارتمان'}
                </button>
              </form>
            </div>

            <div className="card">
              <h2 className="mb-4 text-lg font-medium">لیست دپارتمان‌ها</h2>
              <div className="grid gap-3">
                {depts.map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div>
                      <span className="font-medium">{d.name}</span>
                      <span className="mr-2 text-xs text-slate-400">ID: {d.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ Tasks Tab (with department filter) ════════════════ */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* Create Task */}
            <div className="card">
              <h2 className="mb-4 text-lg font-medium">ایجاد وظیفه جدید</h2>
              <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">دپارتمان</label>
                  <select
                    className="input w-full"
                    value={newTask.department_id}
                    onChange={e => setNewTask({ ...newTask, department_id: e.target.value })}
                    required
                  >
                    <option value="">انتخاب کنید...</option>
                    {depts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">عنوان وظیفه (Task Title)</label>
                  <input
                    className="input w-full"
                    value={newTask.name}
                    onChange={e => setNewTask({ ...newTask, name: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600 dark:text-slate-300">کیفیت / شرح فعالیت (Quality)</label>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={newTask.quality}
                    onChange={e => setNewTask({ ...newTask, quality: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">اولویت (Priority)</label>
                  <select
                    className="input w-full"
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: Number(e.target.value) })}
                  >
                    {PRIORITY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300">وزن (Weight)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={newTask.weight}
                    onChange={e => setNewTask({ ...newTask, weight: Number(e.target.value) })}
                    required
                    min={0}
                    step={0.1}
                  />
                </div>
                <div className="md:col-span-2">
                  <button className="btn w-full" type="submit" disabled={loading}>
                    {loading ? 'در حال ثبت...' : 'ایجاد وظیفه'}
                  </button>
                </div>
              </form>
            </div>

            {/* Edit Task Modal */}
            {editingTask && (
              <div className="card border-accent">
                <h2 className="mb-4 text-lg font-medium">ویرایش وظیفه: {editingTask.name}</h2>
                <form onSubmit={handleUpdateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">دپارتمان</label>
                    <select
                      className="input w-full"
                      value={editTaskForm.department_id}
                      onChange={e => setEditTaskForm({ ...editTaskForm, department_id: e.target.value })}
                      required
                    >
                      <option value="">انتخاب کنید...</option>
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">عنوان وظیفه</label>
                    <input
                      className="input w-full"
                      value={editTaskForm.name}
                      onChange={e => setEditTaskForm({ ...editTaskForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-600 dark:text-slate-300">کیفیت / شرح فعالیت</label>
                    <textarea
                      className="input w-full"
                      rows={2}
                      value={editTaskForm.quality}
                      onChange={e => setEditTaskForm({ ...editTaskForm, quality: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">اولویت</label>
                    <select
                      className="input w-full"
                      value={editTaskForm.priority}
                      onChange={e => setEditTaskForm({ ...editTaskForm, priority: Number(e.target.value) })}
                    >
                      {PRIORITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">وزن</label>
                    <input
                      type="number"
                      className="input w-full"
                      value={editTaskForm.weight}
                      onChange={e => setEditTaskForm({ ...editTaskForm, weight: Number(e.target.value) })}
                      required
                      min={0}
                      step={0.1}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editTaskForm.is_active}
                      onChange={e => setEditTaskForm({ ...editTaskForm, is_active: e.target.checked })}
                    />
                    <span className="text-sm">فعال</span>
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button className="btn flex-1" type="submit" disabled={loading}>
                      {loading ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => setEditingTask(null)}
                    >
                      انصراف
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Task list with department filter */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">لیست وظایف</h2>
                <select
                  className="input w-48"
                  value={taskDeptFilter}
                  onChange={e => {
                    const deptId = e.target.value;
                    setTaskDeptFilter(deptId);
                    // Use deptId directly instead of relying on stale state
                    fetchTasksFiltered(deptId);
                  }}
                >
                  <option value="">همه دپارتمان‌ها</option>
                  {depts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  هنوز وظیفه‌ای ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedTasks.map(t => (
                    <div key={t.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{t.name}</span>
                          <span className="mr-2 text-xs text-slate-400">{deptName(t.department_id)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                            onClick={() => handleEditTask(t)}
                          >
                            ویرایش
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                            onClick={() => handleDeleteTask(t.id)}
                          >
                            حذف
                          </button>
                        </div>
                      </div>

                      {t.todos.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <h3 className="text-xs font-medium text-slate-500">شرح فعالیت‌ها:</h3>
                          {t.todos.map(todo => (
                            <div key={todo.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900 whitespace-pre-line leading-relaxed">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{todo.title}</span>
                                <div className="flex gap-3 text-xs">
                                  <span className="text-slate-500">اولویت: {todo.priority}</span>
                                  <span className="text-slate-500">وزن: {todo.weight}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tasks.length > TASK_PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-sm text-slate-500">
                    صفحه {safeTaskPage} از {taskTotalPages} — {tasks.length} وظیفه
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-3 py-1 rounded-lg text-sm border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      disabled={safeTaskPage === 1}
                      onClick={() => setTaskPage(p => Math.max(1, p - 1))}
                    >
                      قبلی
                    </button>
                    {Array.from({ length: taskTotalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`px-3 py-1 rounded-lg text-sm transition ${
                          page === safeTaskPage
                            ? 'bg-accent text-white'
                            : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => setTaskPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      className="px-3 py-1 rounded-lg text-sm border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      disabled={safeTaskPage === taskTotalPages}
                      onClick={() => setTaskPage(p => Math.min(taskTotalPages, p + 1))}
                    >
                      بعدی
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ Excel Import Tab ════════════════ */}
        {activeTab === 'import' && (
          <div className="card space-y-5">
            <h2 className="text-lg font-medium">وارد کردن مپینگ وظایف از اکسل</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300">انتخاب دپارتمان</label>
                <select
                  className="input w-full"
                  value={importDeptId}
                  onChange={e => setImportDeptId(e.target.value)}
                  required
                >
                  <option value="">انتخاب کنید...</option>
                  {depts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300">فایل اکسل (Sheet: Task_Mapping)</label>
                <input
                  type="file"
                  className="input w-full"
                  accept=".xlsx,.xls"
                  onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)}
                  required
                />
              </div>
            </div>

            <button className="btn w-full" onClick={handlePreviewImport} disabled={loading}>
              {loading ? 'در حال پردازش...' : 'پیش‌نمایش داده‌ها'}
            </button>

            {previewData && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  فایل معتبر است. تعداد ردیف‌ها: {previewData.total_rows}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3 text-right">وظیفه</th>
                        <th className="p-3 text-right">شرح (Quality)</th>
                        <th className="p-3 text-right">وزن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-900">
                          <td className="p-3">{row['Task Title']}</td>
                          <td className="p-3 whitespace-pre-line">{row['Quality']}</td>
                          <td className="p-3">{row['Weight']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn w-full" onClick={handleConfirmImport} disabled={loading}>
                  تأیید و ثبت در دیتابیس
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
