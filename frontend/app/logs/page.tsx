'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { format } from 'date-fns-jalali';

interface Task {
  id: number;
  name: string;
}

interface Todo {
  id: number;
  title: string;
}

export default function LogsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    task_id: '',
    todo_id: '',
    start_time: '08:00',
    end_time: '16:00',
    focused_minutes: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await api<Task[]>('/tasks');
        setTasks(data);
      } catch (err: any) {
        console.error('Failed to fetch tasks', err);
      }
    }
    fetchTasks();
  }, []);

  useEffect(() => {
    async function fetchTodos() {
      if (!formData.task_id) {
        setTodos([]);
        return;
      }
      try {
        const data = await api<Todo[]>(`/tasks/${formData.task_id}/todos`);
        setTodos(data);
      } catch (err: any) {
        console.error('Failed to fetch todos', err);
      }
    }
    fetchTodos();
  }, [formData.task_id]);

  const calculateDuration = () => {
    const [startH, startM] = formData.start_time.split(':').map(Number);
    const [endH, endM] = formData.end_time.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const diff = endTotal - startTotal;
    return diff > 0 ? diff : 0;
  };

  const durationMinutes = calculateDuration();
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api('/timesheets', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          focused_minutes: Number(formData.focused_minutes),
        }),
      });
      setMessage({ type: 'success', text: 'ثبت با موفقیت انجام شد' });
      setFormData(prev => ({
        ...prev,
        todo_id: '',
        focused_minutes: '0',
        notes: '',
      }));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'خطایی در ثبت رخ داد' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-right">
          <h1 className="text-3xl font-bold mb-2">ثبت گزارش روزانه</h1>
          <p className="text-slate-500">لطفاً جزئیات فعالیت‌های خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-6 text-right" dir="rtl">
          {message && (
            <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium">تاریخ (شمسی)</label>
              <input 
                type="date" 
                className="input w-full" 
                value={formData.work_date} 
                onChange={e => setFormData({ ...formData, work_date: e.target.value })} 
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">عنوان وظیفه</label>
              <select 
                className="input w-full" 
                value={formData.task_id} 
                onChange={e => setFormData({ ...formData, task_id: e.target.value, todo_id: '' })} 
                required 
              >
                <option value="">انتخاب کنید...</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">شرح فعالیت (To-Do)</label>
              <select 
                className="input w-full" 
                value={formData.todo_id} 
                onChange={e => setFormData({ ...formData, todo_id: e.target.value })} 
                disabled={!formData.task_id}
                required 
              >
                <option value="">انتخاب کنید...</option>
                {todos.map(todo => <option key={todo.id} value={todo.id}>{todo.title}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">ساعت شروع</label>
                <input 
                  type="time" 
                  className="input w-full" 
                  value={formData.start_time} 
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">ساعت پایان</label>
                <input 
                  type="time" 
                  className="input w-full" 
                  value={formData.end_time} 
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">مدت زمان (محاسبه شده)</label>
              <div className="input bg-slate-100 w-full font-semibold">
                {durationHours} ساعت و {durationMins} دقیقه
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">امتیاز تمرکز (دقیقه)</label>
              <input 
                type="number" 
                className="input w-full" 
                value={formData.focused_minutes} 
                onChange={e => setFormData({ ...formData, focused_minutes: e.target.value })} 
                max={durationMinutes}
                required 
              />
              {Number(formData.focused_minutes) > durationMinutes && (
                <p className="text-xs text-red-500">امتیاز تمرکز نمی‌تواند بیشتر از مدت زمان باشد</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">یادداشت‌ها</label>
            <textarea 
              className="input w-full h-32" 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              placeholder="توضیحات تکمیلی..." 
            />
          </div>

          <button 
            type="submit" 
            className="btn w-full py-3 text-lg font-semibold" 
            disabled={loading || Number(formData.focused_minutes) > durationMinutes}
          >
            {loading ? 'در حال ثبت...' : 'ثبت گزارش'}
          </button>
        </form>
      </div>
    </Shell>
  );
}
