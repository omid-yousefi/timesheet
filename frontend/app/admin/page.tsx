'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

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

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'depts' | 'import'>('users');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'EMPLOYEE',
    department_id: '',
  });

  const [newDept, setNewDept] = useState({ name: '' });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDeptId, setImportDeptId] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [u, d] = await Promise.all([api<User[]>('/admin/users'), api<Department[]>('/admin/departments')]);
      setUsers(u);
      setDepts(d);
    } catch (err: any) {
      console.error('Failed to fetch admin data', err);
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...newUser, department_id: Number(newUser.department_id) }),
      });
      setMessage({ type: 'success', text: 'کاربر با موفقیت ایجاد شد' });
      setNewUser({ username: '', full_name: '', password: '', role: 'EMPLOYEE', department_id: '' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'خطا در ایجاد کاربر' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/admin/departments', {
        method: 'POST',
        body: JSON.stringify(newDept),
      });
      setMessage({ type: 'success', text: 'دپارتمان با موفقیت ایجاد شد' });
      setNewDept({ name: '' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'خطا در ایجاد دپارتمان' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'کاربر حذف شد' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'خطا در حذف کاربر' });
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const data = await api<any>('/admin/import-tasks/preview', {
        method: 'POST',
        body: formData,
      });
      setPreviewData(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'خطا در پیش‌نمایش فایل' });
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
      await api('/admin/import-tasks', {
        method: 'POST',
        body: formData,
      });
      setMessage({ type: 'success', text: 'داده‌ها با موفقیت وارد شدند' });
      setPreviewData(null);
      setImportFile(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'خطا در وارد کردن داده‌ها' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="max-w-6xl mx-auto" dir="rtl">
        <div className="mb-8 text-right">
          <h1 className="text-3xl font-bold mb-2">پنل مدیریت</h1>
          <p className="text-slate-500">مدیریت کاربران، دپارتمان‌ها و داده‌های سیستم</p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
          <button 
            className={`px-4 py-2 rounded-lg text-sm transition ${activeTab === 'users' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('users')}
          >
            مدیریت کاربران
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-sm transition ${activeTab === 'depts' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('depts')}
          >
            دپارتمان‌ها
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-sm transition ${activeTab === 'import' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('import')}
          >
            وارد کردن وظایف
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm text-right ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-6 h-fit space-y-4">
              <h2 className="text-lg font-semibold mb-4">ایجاد کاربر جدید</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs">نام کاربری</label>
                  <input 
                    className="input w-full" 
                    value={newUser.username} 
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">نام کامل</label>
                  <input 
                    className="input w-full" 
                    value={newUser.full_name} 
                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">رمز عبور</label>
                  <input 
                    className="input w-full" 
                    type="password"
                    value={newUser.password} 
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">نقش</label>
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
                <div className="space-y-1">
                  <label className="text-xs">دپارتمان</label>
                  <select 
                    className="input w-full" 
                    value={newUser.department_id} 
                    onChange={e => setNewUser({ ...newUser, department_id: e.target.value })} 
                    required 
                  >
                    <option value="">انتخاب کنید...</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button className="btn w-full" disabled={loading}>
                  {loading ? 'در حال ثبت...' : 'ایجاد کاربر'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 card p-6 overflow-x-auto">
              <h2 className="text-lg font-semibold mb-4">لیست کاربران</h2>
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
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3">{u.username}</td>
                      <td className="py-3">{u.full_name}</td>
                      <td className="py-3">{u.role}</td>
                      <td className="py-3">{depts.find(d => d.id === u.department_id)?.name || 'نامشخص'}</td>
                      <td className="py-3">
                        <button 
                          className="text-red-600 hover:underline ml-3" 
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'depts' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-6 h-fit space-y-4">
              <h2 className="text-lg font-semibold mb-4">ایجاد دپارتمان جدید</h2>
              <form onSubmit={handleCreateDept} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs">نام دپارتمان</label>
                  <input 
                    className="input w-full" 
                    value={newDept.name} 
                    onChange={e => setNewDept({ name: e.target.value })} 
                    required 
                  />
                </div>
                <button className="btn w-full" disabled={loading}>
                  {loading ? 'در حال ثبت...' : 'ایجاد دپارتمان'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-semibold mb-4">لیست دپارتمان‌ها</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {depts.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <span>{d.name}</span>
                    <span className="text-xs text-slate-400">ID: {d.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="card p-6 space-y-6">
            <h2 className="text-lg font-semibold mb-4">وارد کردن مپینگ وظایف از اکسل</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">انتخاب دپارتمان</label>
                  <select 
                    className="input w-full" 
                    value={importDeptId} 
                    onChange={e => setImportDeptId(e.target.value)} 
                    required 
                  >
                    <option value="">انتخاب کنید...</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">فایل اکسل (Sheet: Task_Mapping)</label>
                  <input 
                    type="file" 
                    className="input w-full" 
                    accept=".xlsx, .xls"
                    onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)} 
                    required 
                  />
                </div>
                <button 
                  className="btn w-full" 
                  disabled={loading || !importFile} 
                  onClick={handlePreviewImport}
                >
                  {loading ? 'در حال پردازش...' : 'پیش‌نمایش داده‌ها'}
                </button>
              </div>

              <div className="space-y-4">
                {previewData ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                      فایل معتبر است. تعداد ردیف‌ها: {previewData.total_rows}
                    </div>
                    <div className="max-h-64 overflow-auto border rounded-lg">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100 sticky top-0">
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
                    <button 
                      className="btn w-full bg-green-600 hover:bg-green-700 text-white" 
                      disabled={loading || !importDeptId} 
                      onClick={handleConfirmImport}
                    >
                      تأیید و ثبت در دیتابیس
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic text-sm border-2 border-dashed rounded-lg p-12">
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
