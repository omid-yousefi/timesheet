from datetime import datetime, time
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.task import Task, TaskTodo
from app.models.timesheet import Timesheet
from app.schemas.timesheet import TimesheetCreate, TimesheetOutWithRelations
from app.services.audit import audit

router = APIRouter(prefix='/timesheets', tags=['timesheets'])

def ensure_same_day_editable(payload: TimesheetCreate, user: User):
    if user.role == RoleEnum.ADMIN:
        return
    now = datetime.now(ZoneInfo(settings.timezone))
    if payload.work_date != now.date() or now.time() > time(23, 59):
        raise HTTPException(403, 'Submission deadline passed; records are read-only')

def to_minutes(t):
    return t.hour * 60 + t.minute

@router.post('', response_model=TimesheetOutWithRelations)
def create_timesheet(payload: TimesheetCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_same_day_editable(payload, user)
    task = db.get(Task, payload.task_id)
    todo = db.get(TaskTodo, payload.todo_id)
    if not task or task.department_id != user.department_id or not todo or todo.task_id != task.id:
        raise HTTPException(400, 'Invalid task or to-do')
    start, end = to_minutes(payload.start_time), to_minutes(payload.end_time)
    overlaps = db.query(Timesheet).filter(Timesheet.user_id == user.id, Timesheet.work_date == payload.work_date).all()
    for r in overlaps:
        if start < to_minutes(r.end_time) and end > to_minutes(r.start_time):
            raise HTTPException(409, 'Time interval overlaps an existing entry')
    row = Timesheet(user_id=user.id, department_id=user.department_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, user.id, 'CREATE', 'timesheet', str(row.id))
    db.commit()
    db.refresh(row)
    return row

@router.get('/history')
def history(
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        db.query(Timesheet)
        .options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
        .filter_by(user_id=user.id)
        .order_by(Timesheet.work_date.desc(), Timesheet.start_time.desc())
    )
    if not paginated:
        return q.limit(200).all()

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': max((total + page_size - 1) // page_size, 1),
    }
