import tempfile, os
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import require_roles
from app.models.user import User, RoleEnum
from app.models.department import Department
from app.core.security import hash_password
from app.schemas.admin import DepartmentCreate, UserCreate
from app.services.excel_import import preview_excel, import_task_mapping
from app.services.audit import audit

router = APIRouter(prefix='/admin', tags=['admin'])

@router.get('/departments')
def list_departments(db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    return db.query(Department).filter_by(is_active=True).order_by(Department.name).all()

@router.post('/departments')
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    dept = Department(name=payload.name)
    db.add(dept); db.flush(); audit(db, admin.id, 'CREATE', 'department', str(dept.id)); db.commit(); return {'id': dept.id, 'name': dept.name}

@router.get('/users')
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    return db.query(User).all()

@router.post('/users')
def create_user(payload: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    user = User(username=payload.username, full_name=payload.full_name, role=payload.role, department_id=payload.department_id, hashed_password=hash_password(payload.password))
    db.add(user); db.flush(); audit(db, admin.id, 'CREATE', 'user', str(user.id)); db.commit(); return {'id': user.id}

@router.patch('/users/{user_id}')
def update_user(user_id: int, payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    for k, v in payload.items():
        if k == 'password':
            setattr(user, 'hashed_password', hash_password(v))
        elif hasattr(user, k):
            setattr(user, k, v)
    db.commit(); audit(db, admin.id, 'UPDATE', 'user', str(user.id)); return {'id': user.id}

@router.delete('/users/{user_id}')
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    db.delete(user); db.commit(); audit(db, admin.id, 'DELETE', 'user', str(user_id)); return {'id': user_id}

@router.post('/import-tasks/preview')
def preview_tasks(file: UploadFile = File(...), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    suffix = os.path.splitext(file.filename or 'mapping.xlsx')[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read()); path = tmp.name
    try:
        return preview_excel(path)
    finally:
        os.unlink(path)

@router.post('/import-tasks')
def import_tasks(department_id: int = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    if not db.get(Department, department_id):
        raise HTTPException(404, 'Department not found')
    suffix = os.path.splitext(file.filename or 'mapping.xlsx')[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read()); path = tmp.name
    try:
        result = import_task_mapping(db, department_id, path)
        audit(db, admin.id, 'IMPORT', 'tasks', str(department_id), result); db.commit(); return result
    finally:
        os.unlink(path)
