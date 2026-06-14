from datetime import date, timedelta
from collections import defaultdict
from app.models.timesheet import Timesheet


JALALI_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
]

WEEKDAYS_PERSIAN = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']


def minutes_between(t1, t2) -> int:
    return (t2.hour * 60 + t2.minute) - (t1.hour * 60 + t1.minute)


def _to_jalali_parts(d: date) -> tuple[int, int, int]:
    """Convert Gregorian date to Jalali (Shamsi) year/month/day.

    Kept dependency-free to avoid adding packages; algorithm is the standard
    arithmetic conversion used by jalaali implementations.
    """
    gy, gm, gd = d.year, d.month, d.day
    g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]

    gy -= 1600
    gm -= 1
    gd -= 1

    g_day_no = 365 * gy + (gy + 3) // 4 - (gy + 99) // 100 + (gy + 399) // 400
    for i in range(gm):
        g_day_no += g_days_in_month[i]
    if gm > 1 and ((gy + 1600) % 4 == 0 and ((gy + 1600) % 100 != 0 or (gy + 1600) % 400 == 0)):
        g_day_no += 1
    g_day_no += gd

    j_day_no = g_day_no - 79
    j_np = j_day_no // 12053
    j_day_no %= 12053

    jy = 979 + 33 * j_np + 4 * (j_day_no // 1461)
    j_day_no %= 1461

    if j_day_no >= 366:
        jy += (j_day_no - 1) // 365
        j_day_no = (j_day_no - 1) % 365

    jm = 0
    while jm < 11 and j_day_no >= j_days_in_month[jm]:
        j_day_no -= j_days_in_month[jm]
        jm += 1

    return jy, jm + 1, j_day_no + 1


def _to_jalali_short(d: date) -> str:
    jy, jm, jd = _to_jalali_parts(d)
    return f'{jy}/{jm:02d}/{jd:02d}'


def _jalali_is_leap(year: int) -> bool:
    """Return True if a Jalali year is leap using the 2820-year cycle."""
    return (((year - 474) % 2820) + 474 + 38) * 682 % 2816 < 682


def _jalali_month_days(year: int, month: int) -> int:
    if month < 1 or month > 12:
        raise ValueError('Jalali month must be between 1 and 12')
    start = _jalali_to_gregorian(year, month, 1)
    if month == 12:
        next_start = _jalali_to_gregorian(year + 1, 1, 1)
    else:
        next_start = _jalali_to_gregorian(year, month + 1, 1)
    return (next_start - start).days


def _jalali_to_gregorian(jy: int, jm: int, jd: int) -> date:
    """Convert Jalali date to Gregorian date."""
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


def jalali_month_range(jy: int, jm: int) -> tuple[date, date]:
    start_date = _jalali_to_gregorian(jy, jm, 1)
    end_date = _jalali_to_gregorian(jy, jm, _jalali_month_days(jy, jm))
    return start_date, end_date


def jalali_month_label(jy: int, jm: int) -> str:
    return f'{JALALI_MONTHS[jm - 1]} {jy}'


def productivity_score(rows: list[Timesheet]) -> float:
    """Σ(weight × focus_rate × total_hours).

    focus_rate is stored/derived as focused_minutes / total_minutes (0..1).
    Priority is intentionally not included, and the result is not normalized to
    0..100, matching the requested business formula.
    """
    total_score = 0.0
    for r in rows:
        total_minutes = max(minutes_between(r.start_time, r.end_time), 0)
        if total_minutes == 0:
            continue
        focus_rate = min(max((r.focused_minutes or 0) / total_minutes, 0), 1)
        weight = float(getattr(r.todo, 'weight', 1) or 1)
        total_score += weight * focus_rate * (total_minutes / 60)
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
    jalali = _to_jalali_short(d)
    if period == 'weekly':
        return f'{WEEKDAYS_PERSIAN[(d.weekday() + 2) % 7]} {jalali}'
    return jalali


def _iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def summarize_by_period(rows: list[Timesheet], period: str, start: date, end: date) -> list[dict]:
    """Break rows into Jalali-labelled time buckets for charting.

    Daily view returns one point, weekly returns Saturday→Friday daily points,
    and monthly returns one point for each day in the selected Jalali month.
    Empty dates are included with zero values so tab/filter changes are reflected
    consistently in charts.
    """
    rows_by_date: dict[date, list[Timesheet]] = defaultdict(list)
    for r in rows:
        rows_by_date[r.work_date].append(r)

    result = []
    for d in _iter_dates(start, end):
        bucket_rows = rows_by_date.get(d, [])
        s = summarize(bucket_rows)
        result.append({
            'label': _label_for_date(d, period),
            'date': d.isoformat(),
            'date_jalali': _to_jalali_short(d),
            'total_hours': round(sum(max(minutes_between(r.start_time, r.end_time), 0) for r in bucket_rows) / 60, 2),
            'average_focus_rate': s['average_focus_rate'],
            'productivity_score': s['productivity_score'],
        })

    return result
