# app/services/jalali.py
# Centralized, library-backed Jalali (Shamsi) conversion
# Uses jdatetime - accurate and maintained
# pip install jdatetime

from datetime import date
import jdatetime

JALALI_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
]

WEEKDAYS_PERSIAN = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']


def gregorian_to_jalali(d: date) -> tuple[int, int, int]:
    """Gregorian date -> (jy, jm, jd)"""
    jd = jdatetime.date.fromgregorian(date=d)
    return jd.year, jd.month, jd.day


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> date:
    """Jalali date -> Gregorian date"""
    return jdatetime.date(jy, jm, jd).togregorian()


def to_jalali_parts(d: date) -> tuple[int, int, int]:
    return gregorian_to_jalali(d)


def to_jalali_short(d: date) -> str:
    jy, jm, jd = gregorian_to_jalali(d)
    return f'{jy}/{jm:02d}/{jd:02d}'


def parse_jalali_str(s: str) -> date:
    """ '1404/03/24' or '1404-03-24' -> Gregorian date """
    s = s.replace('-', '/').strip()
    parts = s.split('/')
    if len(parts) != 3:
        raise ValueError(f'Invalid Jalali date: {s}')
    jy, jm, jd = map(int, parts)
    return jalali_to_gregorian(jy, jm, jd)


def jalali_month_days(year: int, month: int) -> int:
    """Days in a Jalali month - jdatetime handles leap years correctly"""
    if month < 1 or month > 12:
        raise ValueError('Jalali month must be between 1 and 12')
    # jdatetime knows month length
    # Simple way: first day of next month - first day of this month
    start = jdatetime.date(year, month, 1)
    if month == 12:
        next_start = jdatetime.date(year + 1, 1, 1)
    else:
        next_start = jdatetime.date(year, month + 1, 1)
    return (next_start - start).days


def jalali_month_range(jy: int, jm: int) -> tuple[date, date]:
    start_date = jalali_to_gregorian(jy, jm, 1)
    end_date = jalali_to_gregorian(jy, jm, jalali_month_days(jy, jm))
    return start_date, end_date


def jalali_month_label(jy: int, jm: int) -> str:
    return f'{JALALI_MONTHS[jm - 1]} {jy}'


def jalali_weekday(d: date) -> str:
    # Python Monday=0 ... Sunday=6
    # Persian Saturday = start
    # So mapping: Sat->0, Sun->1, Mon->2, ...
    return WEEKDAYS_PERSIAN[(d.weekday() + 2) % 7]
