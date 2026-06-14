from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.user import User, RoleEnum
from app.models.task import Task, TaskTodo
from app.models.timesheet import Timesheet
from app.schemas.timesheet import TimesheetCreate, TimesheetOutWithRelations
from app.services.audit import audit
from app.services.kpi import summarize

router = APIRouter(prefix='/manager', tags=['manager'])

MANAGER_ROLES = (RoleEnum.ADMIN, RoleEnum.MANAGER)


def _to_minutes(t) -> int:
    return t.hour * 60 + t.minute


def _ensure_can_manage(manager: User, target: User) -> None:
    """A manager may only act on active employees inside their own department.

    Admins are not restricted to a single department.
    """
    if not target.is_active:
        raise HTTPException(404, 'Employee not found')
    if manager.role == RoleEnum.MANAGER and target.department_id != manager.department_id:
        raise HTTPException(403, 'Employee is not in your department')


def _get_target_user(db: Session, manager: User, user_id: int) -> User:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, 'Employee not found')
    _ensure_can_manage(manager, target)
    return target


@router.get('/team')
def team(db: Session = Depends(get_db), manager: User = Depends(require_roles(*MANAGER_ROLES))):
    users_q = db.query(User).filter(User.is_active == True)  # noqa: E712
    if manager.role == RoleEnum.MANAGER:
        users_q = users_q.filter(User.department_id == manager.department_id)
    users = users_q.all()
    ranking = []
    for u in users:
        rows = (
            db.query(Timesheet)
            .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
            .filter_by(user_id=u.id)
            .all()
        )
        kpi = summarize(rows)
        ranking.append({'user_id': u.id, 'full_name': u.full_name, **kpi})
    ranking.sort(key=lambda x: x['productivity_score'], reverse=True)
    return {'total_employees': len(users), 'ranking': ranking}


@router.get('/employees')
def list_department_employees(
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(*MANAGER_ROLES)),
):
    """Employees the manager is allowed to view/edit, for the filter dropdown.

    Managers see only their own department; admins see everyone. The manager's
    own account and admin accounts are excluded from the editable list.
    """
    q = db.query(User).filter(User.is_active == True)  # noqa: E712
    if manager.role == RoleEnum.MANAGER:
        q = q.filter(User.department_id == manager.department_id)
    q = q.filter(User.role != RoleEnum.ADMIN)
    employees = q.order_by(User.full_name).all()
    return [
        {
            'id': u.id,
            'full_name': u.full_name,
            'username': u.username,
            'department_id': u.department_id,
        }
        for u in employees
    ]


@router.get('/employees/{user_id}/reports', response_model=list[TimesheetOutWithRelations])
def employee_reports_for_date(
    user_id: int,
    work_date: date = Query(..., description='Gregorian date (YYYY-MM-DD); the UI converts the Jalali date.'),
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(*MANAGER_ROLES)),
):
    """All of one employee's timesheet entries on a single day."""
    target = _get_target_user(db, manager, user_id)
    rows = (
        db.query(Timesheet)
        .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
        .filter(Timesheet.user_id == target.id, Timesheet.work_date == work_date)
        .order_by(Timesheet.start_time.asc())
        .all()
    )
    return rows


def _validate_task_todo(db: Session, target: User, task_id: int, todo_id: int) -> None:
    task = db.get(Task, task_id)
    todo = db.get(TaskTodo, todo_id)
    if not task or task.department_id != target.department_id or not todo or todo.task_id != task.id:
        raise HTTPException(400, 'Invalid task or to-do')


def _check_overlap(
    db: Session,
    target: User,
    work_date: date,
    start_min: int,
    end_min: int,
    exclude_id: int | None = None,
) -> None:
    existing = db.query(Timesheet).filter(
        Timesheet.user_id == target.id,
        Timesheet.work_date == work_date,
    ).all()
    for r in existing:
        if exclude_id is not None and r.id == exclude_id:
            continue
        if start_min < _to_minutes(r.end_time) and end_min > _to_minutes(r.start_time):
            raise HTTPException(409, 'Time interval overlaps an existing entry')


@router.post('/employees/{user_id}/reports', response_model=TimesheetOutWithRelations)
def create_employee_report(
    user_id: int,
    payload: TimesheetCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(*MANAGER_ROLES)),
):
    """Add a new timesheet entry on behalf of an employee (any date)."""
    target = _get_target_user(db, manager, user_id)
    _validate_task_todo(db, target, payload.task_id, payload.todo_id)
    start, end = _to_minutes(payload.start_time), _to_minutes(payload.end_time)
    _check_overlap(db, target, payload.work_date, start, end)

    row = Timesheet(user_id=target.id, department_id=target.department_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, manager.id, 'CREATE', 'timesheet', str(row.id), {'on_behalf_of': target.id})
    db.commit()
    db.refresh(row)
    return row


@router.put('/employees/{user_id}/reports/{report_id}', response_model=TimesheetOutWithRelations)
def update_employee_report(
    user_id: int,
    report_id: int,
    payload: TimesheetCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(*MANAGER_ROLES)),
):
    """Edit an existing timesheet entry that belongs to an employee."""
    target = _get_target_user(db, manager, user_id)
    row = db.get(Timesheet, report_id)
    if not row or row.user_id != target.id:
        raise HTTPException(404, 'Report not found')

    _validate_task_todo(db, target, payload.task_id, payload.todo_id)
    start, end = _to_minutes(payload.start_time), _to_minutes(payload.end_time)
    _check_overlap(db, target, payload.work_date, start, end, exclude_id=row.id)

    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    db.flush()
    audit(db, manager.id, 'UPDATE', 'timesheet', str(row.id), {'on_behalf_of': target.id})
    db.commit()
    db.refresh(row)
    return row


@router.delete('/employees/{user_id}/reports/{report_id}')
def delete_employee_report(
    user_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(*MANAGER_ROLES)),
):
    """Delete an employee's timesheet entry."""
    target = _get_target_user(db, manager, user_id)
    row = db.get(Timesheet, report_id)
    if not row or row.user_id != target.id:
        raise HTTPException(404, 'Report not found')
    db.delete(row)
    audit(db, manager.id, 'DELETE', 'timesheet', str(report_id), {'on_behalf_of': target.id})
    db.commit()
    return {'id': report_id}


@router.get('/employees/{user_id}/tasks')
def employee_tasks(
    user_id: int,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(*MANAGER_ROLES)),
):
    """Tasks (with todos) available for an employee's department, for edit forms."""
    target = _get_target_user(db, manager, user_id)
    tasks = (
        db.query(Task)
        .options(joinedload(Task.todos))
        .filter_by(department_id=target.department_id, is_active=True)
        .order_by(Task.name)
        .all()
    )
    return [
        {
            'id': t.id,
            'name': t.name,
            'department_id': t.department_id,
            'is_active': t.is_active,
            'todos': [
                {'id': td.id, 'title': td.title}
                for td in t.todos
                if td.is_active
            ],
        }
        for t in tasks
    ]
