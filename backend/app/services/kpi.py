from datetime import date, timedelta
from collections import defaultdict
from app.models.timesheet import Timesheet
from app.services.jalali import (
    to_jalali_parts,
    to_jalali_short,
    jalali_month_days,
    jalali_month_range,
    jalali_month_label,
    jalali_weekday,
    JALALI_MONTHS,
    WEEKDAYS_PERSIAN,
)

# Re-export for backwards compatibility
__all__ = [
    'to_jalali_parts', 'to_jalali_short', 'jalali_month_days',
    'jalali_month_range', 'jalali_month_label',
    'JALALI_MONTHS', 'WEEKDAYS_PERSIAN',
    'productivity_score', 'summarize', 'summarize_by_period'
]


def minutes_between(t1, t2) -> int:
    return (t2.hour * 60 + t2.minute) - (t1.hour * 60 + t1.minute)


def productivity_score(rows: list[Timesheet]) -> float:
    """Σ(weight × focus_rate × total_hours)/(Σ(4 × 1 × total_hours)) """
    K1 = 0.0
    total_minutes = 0.0
    for r in rows:
        task_minutes = max(minutes_between(r.start_time, r.end_time), 0)
        if task_minutes == 0:
            continue
        focus_rate = min(max((r.focused_minutes or 0) / task_minutes, 0), 1)
        weight = float(getattr(r.todo, 'weight', 1) or 1)
        K1 += weight * focus_rate * task_minutes 
        total_minutes += task_minutes
    if total_minutes == 0:
        return 0
    total_score = 100 * K1 / (4*1*total_minutes)
    return round(total_score, 2) 


def summarize(rows: list[Timesheet]) -> dict:
    days = {r.work_date for r in rows}
    total_minutes = sum(max(minutes_between(r.start_time, r.end_time), 0) for r in rows)
    focused = sum(min(max(r.focused_minutes or 0, 0), max(minutes_between(r.start_time, r.end_time), 0)) for r in rows)
    task_minutes = defaultdict(int)
    for r in rows:
        task_minutes[r.task.name] += max(minutes_between(r.start_time, r.end_time), 0)
    return {
        'average_daily_working_hours': round(total_minutes / 60 / max(len(days), 1), 2),
        'average_focus_rate': round((focused / max(total_minutes, 1)) * 100, 2),
        'productivity_score': productivity_score(rows),
        'task_distribution': [{'name': k, 'hours': round(v / 60, 2)} for k, v in task_minutes.items()],
    }


def _label_for_date(d: date, period: str) -> str:
    jalali = to_jalali_short(d)
    if period == 'weekly':
        return f'{jalali_weekday(d)} {jalali}'
    return jalali


def _iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def summarize_by_period(rows: list[Timesheet], period: str, start: date, end: date) -> list[dict]:
    """Break rows into Jalali-labelled time buckets for charting."""
    rows_by_date: dict[date, list[Timesheet]] = defaultdict(list)
    for r in rows:
        rows_by_date[r.work_date].append(r)

    result = []
    for d in _iter_dates(start, end):
        bucket_rows = rows_by_date.get(d, [])
        s = summarize(bucket_rows)
        result.append({
            'label': _label_for_date(d, period),
            'date': d.isoformat(),  # Gregorian ISO, for internal use
            'date_jalali': to_jalali_short(d),
            'total_hours': round(sum(max(minutes_between(r.start_time, r.end_time), 0) for r in bucket_rows) / 60, 2),
            'average_focus_rate': s['average_focus_rate'],
            'productivity_score': s['productivity_score'],
        })

    return result
