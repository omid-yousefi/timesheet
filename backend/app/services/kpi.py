from datetime import date
from collections import defaultdict
from app.models.timesheet import Timesheet


def minutes_between(t1, t2):
    return (t2.hour * 60 + t2.minute) - (t1.hour * 60 + t1.minute)


def _to_jalali_short(d: date) -> str:
    """Return a Jalali date label (e.g. '1405/03/23') using pure arithmetic."""
    gy = d.year
    gm = d.month
    gd = d.day

    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    jy = 0
    if gy > 1600:
        jy = 979
        gy -= 1600
    else:
        jy = 0
        gy -= 621

    gy2 = 1 if gm > 2 else 0
    days = (
        365 * gy
        + (int((gy + 3) / 4) - int((gy + 99) / 100) + int((gy + 399) / 400))
        - 80
        + gd
        + g_d_m[gm - 1]
        + gy2
    )
    jy += 33 * int(days / 12053)
    days %= 12053
    jy += 4 * int(days / 1461)
    days %= 1461

    if days > 365:
        jy += int((days - 1) / 365)
        days = (days - 1) % 365

    if days < 186:
        jm = 1 + int(days / 31)
        jd = 1 + (days % 31)
    else:
        jm = 7 + int((days - 186) / 30)
        jd = 1 + ((days - 186) % 30)

    return f'{jy}/{jm:02d}/{jd:02d}'


def productivity_score(rows: list[Timesheet]) -> float:
    if not rows:
        return 0.0
    weighted = 0.0
    max_weighted = 0.0
    for r in rows:
        total = minutes_between(r.start_time, r.end_time)
        focus_rate = r.focused_minutes / max(total, 1)
        priority = getattr(r.todo, 'priority', 1) or 1
        weight = float(getattr(r.todo, 'weight', 1) or 1)
        weighted += weight * priority * focus_rate * (total / 60)
        max_weighted += weight * priority * (total / 60)
    return round(min(100, (weighted / max(max_weighted, 1)) * 100), 2)


def summarize(rows: list[Timesheet]) -> dict:
    days = {r.work_date for r in rows}
    total_minutes = sum(minutes_between(r.start_time, r.end_time) for r in rows)
    focused = sum(r.focused_minutes for r in rows)
    task_minutes = defaultdict(int)
    for r in rows:
        task_minutes[r.task.name] += minutes_between(r.start_time, r.end_time)
    return {
        'average_daily_working_hours': round(total_minutes / 60 / max(len(days), 1), 2),
        'average_focus_rate': round((focused / max(total_minutes, 1)) * 100, 2),
        'productivity_score': productivity_score(rows),
        'task_distribution': [{'name': k, 'hours': round(v / 60, 2)} for k, v in task_minutes.items()],
    }


JALALI_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
]

WEEKDAYS_PERSIAN = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']


def summarize_by_period(rows: list[Timesheet], period: str, start: date, end: date) -> list[dict]:
    """Break rows into daily/weekly/monthly buckets with Jalali labels.

    - daily: one bucket per day (today only)
    - weekly: one bucket per day (Sat→Fri), showing daily breakdown within the week
    - monthly: one bucket per day, showing daily breakdown within the month
    """
    buckets: dict[str, list[Timesheet]] = defaultdict(list)
    label_dates: dict[str, date] = {}

    for r in rows:
        jlabel = _to_jalali_short(r.work_date)
        if period == 'daily':
            key = jlabel
        elif period == 'weekly':
            key = WEEKDAYS_PERSIAN[(r.work_date.weekday() + 1) % 7]
        else:  # monthly
            key = jlabel  # daily granularity within month view
        buckets[key].append(r)
        if key not in label_dates or r.work_date < label_dates[key]:
            label_dates[key] = r.work_date

    sorted_keys = sorted(label_dates, key=lambda k: label_dates[k])

    result = []
    for key in sorted_keys:
        bucket_rows = buckets.get(key, [])
        s = summarize(bucket_rows)
        result.append({
            'label': key,
            'total_hours': round(sum(minutes_between(r.start_time, r.end_time) for r in bucket_rows) / 60, 2),
            'average_focus_rate': s['average_focus_rate'],
            'productivity_score': s['productivity_score'],
        })

    return result
