#!/usr/bin/env python3
"""
Sample data generator for quality testing the Timesheet project.

Usage (after alembic upgrade head and inside the backend container or with proper PYTHONPATH):

    python scripts/seed_sample_data.py

This script will:
- Create 10 departments
- Create 10 tasks + 2 todos per task for each department (realistic Persian names)
- Create 100 users (10 per department, 1 MANAGER per dept, rest EMPLOYEE)
- For every user, create 3-5 realistic timesheet entries per day
  from Jalali 1405/01/01 until yesterday (Asia/Tehran)

WARNING: This will DELETE all existing timesheets, tasks, users (except the bootstrap admin), and departments!
         Only run on a fresh / development database.
"""

import sys
from pathlib import Path
from datetime import date, time, timedelta, datetime
from zoneinfo import ZoneInfo
import random
from decimal import Decimal

# Allow running directly
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.department import Department
from app.models.user import User, RoleEnum
from app.models.task import Task, TaskTodo
from app.models.timesheet import Timesheet
from app.core.security import hash_password

# ============================================================
# COMPLETELY SELF-CONTAINED Jalali (Shamsi) to Gregorian converter.
# This is an exact copy of the conversion logic from the project's
# app/services/kpi.py so the seeder has ZERO dependency on any
# function inside kpi.py (including private _jalali_to_gregorian).
#
# This fixes the exact ImportError you reported:
# "cannot import name '_jalali_to_gregorian' from 'app.services.kpi'"
# ============================================================
def _jalali_to_gregorian(jy: int, jm: int, jd: int) -> date:
    """Convert Jalali date to Gregorian date (standalone version for the seeder)."""
    if jm < 1 or jm > 12:
        raise ValueError('Jalali month must be between 1 and 12')
    max_day = 31 if jm <= 6 else 30
    if jd < 1 or jd > max_day:
        raise ValueError('Invalid Jalali day for month')

    jy -= 979
    jm -= 1
    jd -= 1

    j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
    g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    j_day_no = 365 * jy + jy // 33 * 8 + ((jy % 33) + 3) // 4
    for i in range(jm):
        j_day_no += j_days_in_month[i]
    j_day_no += jd

    g_day_no = j_day_no + 79
    gy = 1600 + 400 * (g_day_no // 146097)
    g_day_no %= 146097

    leap = True
    if g_day_no >= 36525:
        g_day_no -= 1
        gy += 100 * (g_day_no // 36524)
        g_day_no %= 36524
        if g_day_no >= 365:
            g_day_no += 1
        else:
            leap = False

    gy += 4 * (g_day_no // 1461)
    g_day_no %= 1461

    if g_day_no >= 366:
        leap = False
        g_day_no -= 1
        gy += g_day_no // 365
        g_day_no %= 365

    gm = 0
    while gm < 11:
        dim = g_days_in_month[gm] + (1 if gm == 1 and leap else 0)
        if g_day_no < dim:
            break
        g_day_no -= dim
        gm += 1

    return date(gy, gm + 1, g_day_no + 1)

# ========================== CONFIG ==========================
NUM_DEPARTMENTS = 10
USERS_PER_DEPARTMENT = 10          # Total = 100 users
TASKS_PER_DEPARTMENT = 10
TODOS_PER_TASK = 2

START_JALALI = (1405, 1, 1)        # 1405/01/01 Shamsi

# Realistic Persian names
DEPARTMENT_NAMES = [
    "توسعه نرم‌افزار",
    "پشتیبانی فنی",
    "مالی و حسابداری",
    "منابع انسانی",
    "فروش و بازاریابی",
    "تحقیق و توسعه",
    "عملیات و زیرساخت",
    "کیفیت و تست",
    "طراحی محصول",
    "مدیریت پروژه",
]

TASK_TEMPLATES = [
    "پیاده‌سازی فیچر جدید",
    "رفع باگ‌های گزارش‌شده",
    "بررسی و بازبینی کد",
    "جلسه هماهنگی تیم",
    "مستندسازی فنی",
    "تحقیق و تحلیل نیازمندی‌ها",
    "بهینه‌سازی عملکرد",
    "تست و کنترل کیفیت",
    "آموزش و انتقال دانش",
    "گزارش‌دهی و پیگیری",
]

TODO_TEMPLATES = [
    "بررسی نیازمندی‌ها و نوشتن تیکت",
    "طراحی اولیه و دیاگرام",
    "پیاده‌سازی بخش اصلی",
    "نوشتن تست‌های واحد",
    "رفع مشکلات گزارش‌شده",
    "بهبود مستندات",
    "هماهنگی با تیم‌های دیگر",
    "بررسی عملکرد و پروفایلینگ",
]

FIRST_NAMES = ["علی", "محمد", "رضا", "امیر", "حسین", "فاطمه", "زهرا", "سارا", "مریم", "نیما", "آرش", "پارسا", "مهدی", "سجاد", "یاسر"]
LAST_NAMES = ["احمدی", "رضایی", "محمدی", "حسینی", "کریمی", "موسوی", "جعفری", "صادقی", "رستمی", "قاسمی", "شریفی", "نصیری", "طاهری", "مرادی", "کاظمی"]

PASSWORD = "SamplePass123"   # All sample users have the same easy password

# Time blocks for realistic daily entries (non-overlapping possible)
POSSIBLE_TIME_BLOCKS = [
    (time(8, 0),  time(10, 30)),
    (time(10, 45), time(12, 30)),
    (time(13, 30), time(15, 0)),
    (time(15, 15), time(17, 30)),
    (time(17, 45), time(19, 0)),
    (time(9, 0),   time(11, 0)),
    (time(14, 0),  time(16, 30)),
]

NOTES_SAMPLES = [
    "پیشرفت خوب بود",
    "با تأخیر مواجه شدیم به خاطر جلسه",
    "نیاز به بررسی بیشتر دارد",
    "",
    "تست‌ها با موفقیت پاس شدند",
    "هماهنگی با تیم پشتیبانی انجام شد",
    None,
]

random.seed(42)  # Reproducible data


def get_yesterday() -> date:
    """Return yesterday's date in Asia/Tehran timezone."""
    now = datetime.now(ZoneInfo("Asia/Tehran"))
    return (now - timedelta(days=1)).date()


def generate_work_dates(start_jalali: tuple[int, int, int], end_gregorian: date) -> list[date]:
    """Generate all Gregorian dates from Jalali start until end (inclusive)."""
    start_g = _jalali_to_gregorian(*start_jalali)
    dates = []
    current = start_g
    while current <= end_gregorian:
        dates.append(current)
        current += timedelta(days=1)
    return dates


def create_departments(db: Session) -> list[Department]:
    print("Creating departments...")
    depts = []
    for name in DEPARTMENT_NAMES:
        dept = Department(name=name, is_active=True)
        db.add(dept)
        depts.append(dept)
    db.flush()
    print(f"  → {len(depts)} departments created")
    return depts


def create_tasks_and_todos(db: Session, departments: list[Department]) -> dict[int, list[dict]]:
    """
    Create tasks + todos for every department.
    Returns: {department_id: [{"task": Task, "todos": [TaskTodo, ...]}, ...]}
    """
    print("Creating tasks and todos...")
    dept_tasks: dict[int, list[dict]] = {}

    for dept in departments:
        dept_tasks[dept.id] = []
        for i in range(TASKS_PER_DEPARTMENT):
            task_name = f"{TASK_TEMPLATES[i % len(TASK_TEMPLATES)]} ({dept.name.split()[0]})"
            task = Task(
                department_id=dept.id,
                name=task_name,
                is_active=True,
            )
            db.add(task)
            db.flush()

            todos = []
            for j in range(TODOS_PER_TASK):
                todo_title = TODO_TEMPLATES[(i + j) % len(TODO_TEMPLATES)]
                weight = Decimal(random.choice([0.8, 1.0, 1.2, 1.5]))
                todo = TaskTodo(
                    task_id=task.id,
                    title=todo_title,
                    priority=random.randint(1, 3),
                    weight=weight,
                    is_active=True,
                )
                db.add(todo)
                todos.append(todo)
            db.flush()

            dept_tasks[dept.id].append({"task": task, "todos": todos})

    print(f"  → {TASKS_PER_DEPARTMENT * len(departments)} tasks + todos created")
    return dept_tasks


def create_users(db: Session, departments: list[Department]) -> list[User]:
    print("Creating users (100 total, ~10 per dept)...")
    users = []
    user_idx = 1

    for dept in departments:
        # 1 MANAGER per department
        mgr = User(
            username=f"mgr{dept.id:02d}",
            full_name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)} (مدیر)",
            hashed_password=hash_password(PASSWORD),
            role=RoleEnum.MANAGER,
            department_id=dept.id,
            is_active=True,
        )
        db.add(mgr)
        users.append(mgr)

        # 9 EMPLOYEES
        for _ in range(USERS_PER_DEPARTMENT - 1):
            full_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            username = f"emp{user_idx:03d}"
            user = User(
                username=username,
                full_name=full_name,
                hashed_password=hash_password(PASSWORD),
                role=RoleEnum.EMPLOYEE,
                department_id=dept.id,
                is_active=True,
            )
            db.add(user)
            users.append(user)
            user_idx += 1

    db.flush()
    print(f"  → {len(users)} users created (1 MANAGER + 9 EMPLOYEE per department)")
    print(f"     Default password for all sample users: {PASSWORD}")
    return users


def generate_timesheets_for_user(
    db: Session,
    user: User,
    dept_tasks: list[dict],
    work_dates: list[date],
) -> int:
    """Generate 3-5 timesheet entries per day for one user. Returns count of created rows."""
    count = 0
    for work_date in work_dates:
        num_entries = random.randint(3, 5)

        # Pick random distinct tasks for this day
        day_tasks = random.sample(dept_tasks, min(num_entries, len(dept_tasks)))

        used_intervals: list[tuple[time, time]] = []

        for task_info in day_tasks:
            task = task_info["task"]
            todo = random.choice(task_info["todos"])

            # Choose a time block that doesn't overlap
            attempts = 0
            chosen_block = None
            while attempts < 10:
                block = random.choice(POSSIBLE_TIME_BLOCKS)
                if not any(
                    max(block[0], existing[0]) < min(block[1], existing[1])
                    for existing in used_intervals
                ):
                    chosen_block = block
                    break
                attempts += 1

            if not chosen_block:
                continue  # skip if can't find non-overlapping slot

            start_t, end_t = chosen_block
            used_intervals.append((start_t, end_t))

            duration_minutes = (end_t.hour * 60 + end_t.minute) - (start_t.hour * 60 + start_t.minute)
            focused = random.randint(max(20, duration_minutes // 3), duration_minutes - 5)

            notes = random.choice(NOTES_SAMPLES)

            ts = Timesheet(
                user_id=user.id,
                department_id=user.department_id,
                task_id=task.id,
                todo_id=todo.id,
                work_date=work_date,
                start_time=start_t,
                end_time=end_t,
                focused_minutes=focused,
                notes=notes,
            )
            db.add(ts)
            count += 1

        # Occasional commit to keep memory low
        if count % 2000 == 0:
            db.commit()

    return count


def main():
    print("=" * 60)
    print("TIMESHEET SAMPLE DATA GENERATOR")
    print("=" * 60)

    end_date = get_yesterday()
    print(f"Generating data from Jalali {START_JALALI[0]}/{START_JALALI[1]:02d}/{START_JALALI[2]:02d} "
          f"until yesterday ({end_date})")

    work_dates = generate_work_dates(START_JALALI, end_date)
    print(f"Total work days to generate: {len(work_dates)}")

    with SessionLocal() as db:
        # Safety: clear existing sample data (keep only the bootstrap admin if it exists)
        # print("\nClearing previous sample data (departments, users, tasks, timesheets)...")

        # # Delete in correct order (respecting FKs)
        # db.query(Timesheet).delete()
        # db.query(TaskTodo).delete()
        # db.query(Task).delete()
        # # Keep the admin user but delete other users
        # db.query(User).filter(User.username != "admin").delete()
        # db.query(Department).delete()
        # db.commit()

        # Create structure
        departments = create_departments(db)
        dept_tasks_map = create_tasks_and_todos(db, departments)
        users = create_users(db, departments)

        print("\nGenerating timesheet entries (this may take 30-90 seconds)...")
        total_entries = 0

        for idx, user in enumerate(users, 1):
            dept_tasks = dept_tasks_map[user.department_id]
            entries = generate_timesheets_for_user(db, user, dept_tasks, work_dates)
            total_entries += entries

            if idx % 20 == 0:
                print(f"  Processed {idx}/{len(users)} users... (current total entries: {total_entries})")

        db.commit()

        # Final summary
        print("\n" + "=" * 60)
        print("SAMPLE DATA GENERATION COMPLETE")
        print("=" * 60)
        print(f"Departments:     {len(departments)}")
        print(f"Users:           {len(users)}")
        print(f"Tasks:           {TASKS_PER_DEPARTMENT * len(departments)}")
        print(f"Total timesheets:{total_entries}")
        print(f"Date range:      1405/01/01 → {end_date} (yesterday)")
        print(f"Avg entries/day/user: ~4")
        print()
        print("Sample login credentials:")
        print("  - Admin:     admin / (from your .env)")
        print(f"  - Manager:   mgr01 / {PASSWORD}")
        print(f"  - Employee:  emp001 / {PASSWORD}")
        print("  (All sample users share the same password)")
        print("=" * 60)


if __name__ == "__main__":
    main()
