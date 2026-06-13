from datetime import date, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.timesheet import Timesheet
from app.models.department import Department
from app.services.kpi import summarize, summarize_by_period, _to_jalali_short


def _get_today_jalali() -> tuple[int, int, int]:
    """Return (year, month, day) for today in Jalali."""
    today = date.today()
    label = _to_jalali_short(today)
    parts = label.split('/')
    return int(parts[0]), int(parts[1]), int(parts[2])


def _week_range_for_today() -> tuple[date, date]:
    """Saturday → Friday range containing today."""
    today = date.today()
    # Python weekday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    # Saturday=5, so days since Saturday:
    days_since_saturday = (today.weekday() + 1) % 7
    start = today - timedelta(days=days_since_saturday)
    end = start + timedelta(days=6)
    return start, end


def _jalali_is_leap(year: int) -> bool:
    """Check if a Jalali year is a leap year."""
    breaks = [1, 5, 9, 13, 17, 22, 26, 30]
    cycle_pos = (year - 474) % 2820
    return cycle_pos in breaks


def _jalali_month_days(year: int, month: int) -> int:
    """Number of days in a given Jalali month."""
    if month <= 6:
        return 31
    elif month <= 11:
        return 30
    else:
        return 30 if _jalali_is_leap(year) else 29


def _jalali_to_gregorian(jy: int, jm: int, jd: int) -> date:
    """Convert Jalali date to Gregorian date using reference point."""
    # Reference: 1400/01/01 = 2021-03-21
    ref_jy, ref_jm, ref_jd = 1400, 1, 1
    ref_greg = date(2021, 3, 21)

    target_days = 0
    if jy > ref_jy:
        for y in range(ref_jy, jy):
            target_days += 366 if _jalali_is_leap(y) else 365
    elif jy < ref_jy:
        for y in range(jy, ref_jy):
            target_days -= 366 if _jalali_is_leap(y) else 365

    for m in range(1, jm):
        target_days += _jalali_month_days(jy, m)

    target_days += jd - ref_jd

    return ref_greg + timedelta(days=target_days)


def _month_range(jy: int, jm: int) -> tuple[date, date]:
    """Return Gregorian start/end dates for a given Jalali month."""
    start_date = _jalali_to_gregorian(jy, jm, 1)
    days_in_month = _jalali_month_days(jy, jm)
    end_date = _jalali_to_gregorian(jy, jm, days_in_month)
    return start_date, end_date


def _get_available_months_for_user(user_id: int, department_id: int, db: Session) -> list[dict]:
    """Return list of Jalali months that have data for this user."""
    rows = (
        db.query(func.distinct(func.strftime('%Y-%m', Timesheet.work_date)))
        .filter(Timesheet.user_id == user_id)
        .all()
    )
    # For SQLite use substr; for PostgreSQL use to_char
    # We'll just query all distinct work_dates and convert
    all_dates = (
        db.query(Timesheet.work_date)
        .filter(Timesheet.user_id == user_id)
        .distinct()
        .all()
    )
    months_set = set()
    for (d,) in all_dates:
        jl = _to_jalali_short(d)
        months_set.add(jl[:7])  # YYYY/MM

    JALALI_MONTH_NAMES = [
        '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ]
    result = []
    for ym in sorted(months_set, reverse=True):
        y, m = map(int, ym.split('/'))
        label = f'{JALALI_MONTH_NAMES[m]} {y}'
        result.append({'value': ym, 'label': label})
    return result


WEEKDAYS_PERSIAN = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
JALALI_MONTH_NAMES = [
    '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
]

router = APIRouter(prefix='/analytics', tags=['analytics'])


@router.get('/me')
def my_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Timesheet)
        .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
        .filter(Timesheet.user_id == user.id)
        .all()
    )
    dept_rows = (
        db.query(Timesheet)
        .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
        .filter(Timesheet.department_id == user.department_id)
        .all()
    )
    return {
        'personal': summarize(rows),
        'department_average': summarize(dept_rows),
    }


@router.get('/me/period')
def my_analytics_by_period(
    period: str = Query(default='daily', regex='^(daily|weekly|monthly)$'),
    month_year: str | None = Query(default=None, description='Jalali month YYYY/MM, e.g. 1405/04'),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()

    if period == 'daily':
        start = end = today
    elif period == 'weekly':
        start, end = _week_range_for_today()
    else:  # monthly
        if month_year:
            jy, jm = map(int, month_year.split('/'))
        else:
            jy, jm, _ = _get_today_jalali()
        start, end = _month_range(jy, jm)

    rows = (
        db.query(Timesheet)
        .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
        .filter(
            Timesheet.user_id == user.id,
            Timesheet.work_date >= start,
            Timesheet.work_date <= end,
        )
        .all()
    )

    breakdown = summarize_by_period(rows, period, start, end)

    # Jalali display info
    jy_today, jm_today, jd_today = _get_today_jalali()
    weekday_name = WEEKDAYS_PERSIAN[(today.weekday() + 1) % 7]
    month_name = JALALI_MONTH_NAMES[jm_today]

    period_label = ''
    if period == 'daily':
        period_label = f'امروز {weekday_name} {jy_today}/{jm_today:02d}/{jd_today:02d}'
    elif period == 'weekly':
        jl_start = _to_jalali_short(start)
        jl_end = _to_jalali_short(end)
        period_label = f'هفته جاری: {jl_start} تا {jl_end} ({weekday_name})'
    else:
        period_label = f'{month_name} {jy_today}'

    available_months = _get_available_months_for_user(user.id, user.department_id, db)

    return {
        'period': period,
        'period_label': period_label,
        'summary': summarize(rows),
        'breakdown': breakdown,
        'date_range': {
            'start': start.isoformat(),
            'end': end.isoformat(),
            'start_jalali': _to_jalali_short(start),
            'end_jalali': _to_jalali_short(end),
        },
        'today_info': {
            'jalali': f'{jy_today}/{jm_today:02d}/{jd_today:02d}',
            'weekday': weekday_name,
            'month_name': month_name,
        },
        'available_months': available_months,
    }


@router.get('/department')
def department_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.MANAGER)),
):
    q = db.query(Timesheet).options(
        joinedload(Timesheet.task),
        joinedload(Timesheet.todo),
    )
    if user.role == RoleEnum.MANAGER:
        q = q.filter(Timesheet.department_id == user.department_id)
    return summarize(q.all())


@router.get('/department/period')
def department_analytics_by_period(
    period: str = Query(default='daily', regex='^(daily|weekly|monthly)$'),
    month_year: str | None = Query(default=None),
    department_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.MANAGER)),
):
    today = date.today()

    if period == 'daily':
        start = end = today
    elif period == 'weekly':
        start, end = _week_range_for_today()
    else:
        if month_year:
            jy, jm = map(int, month_year.split('/'))
        else:
            jy, jm, _ = _get_today_jalali()
        start, end = _month_range(jy, jm)

    q = db.query(Timesheet).options(
        joinedload(Timesheet.task),
        joinedload(Timesheet.todo),
    ).filter(
        Timesheet.work_date >= start,
        Timesheet.work_date <= end,
    )

    if user.role == RoleEnum.MANAGER:
        q = q.filter(Timesheet.department_id == user.department_id)
    elif department_id is not None:
        if not db.get(Department, department_id):
            raise HTTPException(404, 'Department not found')
        q = q.filter(Timesheet.department_id == department_id)

    rows = q.all()
    breakdown = summarize_by_period(rows, period, start, end)
    return {
        'period': period,
        'summary': summarize(rows),
        'breakdown': breakdown,
    }


@router.get('/department/employees')
def department_employee_breakdown(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.MANAGER)),
):
    from app.models.user import User as UserModel

    users_q = db.query(UserModel).filter(UserModel.is_active == True)
    if user.role == RoleEnum.MANAGER:
        users_q = users_q.filter(UserModel.department_id == user.department_id)
    users = users_q.all()

    result = []
    for u in users:
        rows = (
            db.query(Timesheet)
            .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
            .filter(Timesheet.user_id == u.id)
            .all()
        )
        kpi = summarize(rows)
        result.append({
            'user_id': u.id,
            'full_name': u.full_name,
            'username': u.username,
            'department_id': u.department_id,
            **kpi,
        })
    result.sort(key=lambda x: x['productivity_score'], reverse=True)
    return {'total_employees': len(users), 'ranking': result}
