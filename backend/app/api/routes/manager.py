from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.api.deps import require_roles
from app.models.user import User, RoleEnum
from app.models.timesheet import Timesheet
from app.services.kpi import summarize

router = APIRouter(prefix='/manager', tags=['manager'])

@router.get('/team')
def team(db: Session = Depends(get_db), manager: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.MANAGER))):
    users_q = db.query(User).filter(User.is_active == True)
    if manager.role == RoleEnum.MANAGER:
        users_q = users_q.filter(User.department_id == manager.department_id)
    users = users_q.all()
    ranking = []
    for u in users:
        rows = db.query(Timesheet).options(joinedload(Timesheet.task), joinedload(Timesheet.todo)).filter_by(user_id=u.id).all()
        kpi = summarize(rows)
        ranking.append({'user_id': u.id, 'full_name': u.full_name, **kpi})
    ranking.sort(key=lambda x: x['productivity_score'], reverse=True)
    return {'total_employees': len(users), 'ranking': ranking}
