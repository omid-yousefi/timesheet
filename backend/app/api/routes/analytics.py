from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.timesheet import Timesheet
from app.services.kpi import summarize

router = APIRouter(prefix='/analytics', tags=['analytics'])

@router.get('/me')
def my_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Timesheet).options(joinedload(Timesheet.task), joinedload(Timesheet.todo)).filter(Timesheet.user_id == user.id).all()
    dept_rows = db.query(Timesheet).options(joinedload(Timesheet.task), joinedload(Timesheet.todo)).filter(Timesheet.department_id == user.department_id).all()
    return {'personal': summarize(rows), 'department_average': summarize(dept_rows)}

@router.get('/department')
def department_analytics(db: Session = Depends(get_db), user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.MANAGER))):
    q = db.query(Timesheet).options(joinedload(Timesheet.task), joinedload(Timesheet.todo))
    if user.role == RoleEnum.MANAGER:
        q = q.filter(Timesheet.department_id == user.department_id)
    return summarize(q.all())
