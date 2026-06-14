from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.timesheet import Timesheet
from app.models.department import Department
from app.services.kpi import (
    summarize,
    summarize_by_period,
)
from app.services.jalali import (
    JALALI_MONTHS,
    WEEKDAYS_PERSIAN,
    jalali_month_label,
    jalali_month_range,
    to_jalali_parts,
    to_jalali_short,
)

router = APIRouter(prefix='/analytics', tags=['analytics'])


def _today() -> date:
    return datetime.now(ZoneInfo(settings.timezone)).date()


def _week_range_for(day: date) -> tuple[date, date]:
    """Saturday → Friday range containing the supplied date."""
    days_since_saturday = (day.weekday() + 2) % 7
    start = day - timedelta(days=days_since_saturday)
    return start, start + timedelta(days=6)


def _parse_month_year(month_year: str | None, fallback_day: date) -> tuple[int, int]:
    if not month_year:
        jy, jm, _ = to_jalali_parts(fallback_day)
        return jy, jm
    try:
        jy_str, jm_str = month_year.replace('-', '/').split('/')
        jy, jm = int(jy_str), int(jm_str)
    except ValueError:
        raise HTTPException(422, 'month_year must be in Jalali YYYY/MM format')
    if jm < 1 or jm > 12:
        raise HTTPException(422, 'Jalali month must be between 1 and 12')
    return jy, jm


def _range_for_period(period: str, month_year: str | None = None) -> tuple[date, date, int | None, int | None]:
    today = _today()
    if period == 'daily':
        return today, today, None, None
    if period == 'weekly':
        start, end = _week_range_for(today)
        return start, end, None, None
    jy, jm = _parse_month_year(month_year, today)
    start, end = jalali_month_range(jy, jm)
    return start, end, jy, jm


def _period_label(period: str, start: date, end: date, jy: int | None = None, jm: int | None = None) -> str:
    today = _today()
    weekday_name = WEEKDAYS_PERSIAN[(today.weekday() + 2) % 7]

    if period == 'daily':
        return f'امروز {weekday_name} {to_jalali_short(today)}'
    if period == 'weekly':
        return f'هفته جاری: {to_jalali_short(start)} تا {to_jalali_short(end)}'

    if jy is None or jm is None:
        jy, jm, _ = to_jalali_parts(start)
    return f'{jalali_month_label(jy, jm)}: {to_jalali_short(start)} تا {to_jalali_short(end)}'


def _available_months_for_department(department_id: int, db: Session) -> list[dict]:
    """Months that have timesheet data in this department, in Jalali format."""
    all_dates = (
        db.query(Timesheet.work_date)
        .filter(Timesheet.department_id == department_id)
        .distinct()
        .all()
    )
    months_set = set()
    for (d,) in all_dates:
        jy, jm, _ = to_jalali_parts(d)
        months_set.add((jy, jm))

    return [
        {'value': f'{jy}/{jm:02d}', 'label': jalali_month_label(jy, jm)}
        for jy, jm in sorted(months_set, reverse=True)
    ]


def _timesheets_query(db: Session):
    return db.query(Timesheet).options(joinedload(Timesheet.task), joinedload(Timesheet.todo))


def _average_user_summary(rows: list[Timesheet]) -> dict:
    """Average KPI values across users represented in the supplied rows."""
    rows_by_user: dict[int, list[Timesheet]] = {}
    for r in rows:
        rows_by_user.setdefault(r.user_id, []).append(r)
    if not rows_by_user:
        return summarize([])

    summaries = [summarize(user_rows) for user_rows in rows_by_user.values()]
    return {
        'average_daily_working_hours': round(sum(s['average_daily_working_hours'] for s in summaries) / len(summaries), 2),
        'average_focus_rate': round(sum(s['average_focus_rate'] for s in summaries) / len(summaries), 2),
        'productivity_score': round(sum(s['productivity_score'] for s in summaries) / len(summaries), 2),
        'task_distribution': summarize(rows)['task_distribution'],
    }


def _average_user_breakdown(rows: list[Timesheet], period: str, start: date, end: date) -> list[dict]:
    base = summarize_by_period(rows, period, start, end)
    for point in base:
        bucket_date = date.fromisoformat(point['date'])
        users: dict[int, list[Timesheet]] = {}
        for r in rows:
            if r.work_date == bucket_date:
                users.setdefault(r.user_id, []).append(r)
        if not users:
            point.update({'total_hours': 0, 'average_focus_rate': 0.0, 'productivity_score': 0.0})
            continue
        summaries = [summarize(user_rows) for user_rows in users.values()]
        point.update({
            'total_hours': round(sum(s['average_daily_working_hours'] for s in summaries) / len(summaries), 2),
            'average_focus_rate': round(sum(s['average_focus_rate'] for s in summaries) / len(summaries), 2),
            'productivity_score': round(sum(s['productivity_score'] for s in summaries) / len(summaries), 2),
        })
    return base


def _comparison_series(personal_breakdown: list[dict], department_breakdown: list[dict]) -> list[dict]:
    return [
        {
            'label': p['label'],
            'date': p.get('date'),
            'date_jalali': p.get('date_jalali'),
            'personal_productivity': p['productivity_score'],
            'department_productivity': d['productivity_score'],
            'personal_focus': p['average_focus_rate'],
            'department_focus': d['average_focus_rate'],
            'personal_hours': p['total_hours'],
            'department_hours': d['total_hours'],
        }
        for p, d in zip(personal_breakdown, department_breakdown)
    ]


@router.get('/me')
def my_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = _timesheets_query(db).filter(Timesheet.user_id == user.id).all()
    dept_rows = _timesheets_query(db).filter(Timesheet.department_id == user.department_id).all()
    return {
        'personal': summarize(rows),
        'department_average': _average_user_summary(dept_rows),
    }


@router.get('/me/period')
def my_analytics_by_period(
    period: str = Query(default='daily', regex='^(daily|weekly|monthly)$'),
    month_year: str | None = Query(default=None, description='Jalali month YYYY/MM, e.g. 1404/03'),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end, jy, jm = _range_for_period(period, month_year)

    rows = (
        _timesheets_query(db)
        .filter(
            Timesheet.user_id == user.id,
            Timesheet.work_date >= start,
            Timesheet.work_date <= end,
        )
        .all()
    )
    dept_rows = (
        _timesheets_query(db)
        .filter(
            Timesheet.department_id == user.department_id,
            Timesheet.work_date >= start,
            Timesheet.work_date <= end,
        )
        .all()
    )

    breakdown = summarize_by_period(rows, period, start, end)
    department_breakdown = _average_user_breakdown(dept_rows, period, start, end)

    today = _today()
    today_jy, today_jm, _ = to_jalali_parts(today)
    return {
        'period': period,
        'period_label': _period_label(period, start, end, jy, jm),
        'summary': summarize(rows),
        'department_summary': _average_user_summary(dept_rows),
        'breakdown': breakdown,
        'department_breakdown': department_breakdown,
        'comparison_series': _comparison_series(breakdown, department_breakdown),
        'date_range': {
            'start': start.isoformat(),
            'end': end.isoformat(),
            'start_jalali': to_jalali_short(start),
            'end_jalali': to_jalali_short(end),
        },
        'today_info': {
            'jalali': to_jalali_short(today),
            'weekday': WEEKDAYS_PERSIAN[(today.weekday() + 2) % 7],
            'month_name': JALALI_MONTHS[today_jm - 1],
            'year': today_jy,
        },
        'available_months': _available_months_for_department(user.department_id, db),
    }


@router.get('/department')
def department_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.MANAGER)),
):
    
    today = _today()
    start, end = _week_range_for(today)   # شنبه تا جمعه

    q = _timesheets_query(db).filter(
        Timesheet.work_date >= start,
        Timesheet.work_date <= end,
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
    start, end, jy, jm = _range_for_period(period, month_year)

    q = _timesheets_query(db).filter(
        Timesheet.work_date >= start,
        Timesheet.work_date <= end,
    )

    selected_department_id = user.department_id
    if user.role == RoleEnum.MANAGER:
        q = q.filter(Timesheet.department_id == user.department_id)
    elif department_id is not None:
        if not db.get(Department, department_id):
            raise HTTPException(404, 'Department not found')
        selected_department_id = department_id
        q = q.filter(Timesheet.department_id == department_id)

    rows = q.all()
    breakdown = summarize_by_period(rows, period, start, end)
    return {
        'period': period,
        'period_label': _period_label(period, start, end, jy, jm),
        'summary': summarize(rows),
        'breakdown': breakdown,
        'date_range': {
            'start': start.isoformat(),
            'end': end.isoformat(),
            'start_jalali': to_jalali_short(start),
            'end_jalali': to_jalali_short(end),
        },
        'available_months': _available_months_for_department(selected_department_id, db) if selected_department_id else [],
    }


@router.get('/department/employees')
def department_employee_breakdown(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=1000, ge=1, le=1000),
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
        rows = _timesheets_query(db).filter(Timesheet.user_id == u.id).all()
        kpi = summarize(rows)
        result.append({
            'user_id': u.id,
            'full_name': u.full_name,
            'username': u.username,
            'department_id': u.department_id,
            **kpi,
        })
    result.sort(key=lambda x: x['productivity_score'], reverse=True)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged = result[start_idx:end_idx]
    return {
        'total_employees': len(users),
        'total': len(result),
        'page': page,
        'page_size': page_size,
        'total_pages': max((len(result) + page_size - 1) // page_size, 1),
        'ranking': paged,
    }
