import os
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.user import User, RoleEnum
from app.models.department import Department
from app.models.task import Task, TaskTodo
from app.core.security import hash_password
from app.schemas.admin import DepartmentCreate, TaskCreate, UserCreate, UserUpdate
from app.schemas.task import TaskAdminOut
from app.services.excel_import import preview_excel, import_task_mapping
from app.services.audit import audit

router = APIRouter(prefix='/admin', tags=['admin'])


def _get_department_or_404(db: Session, department_id: int) -> Department:
    dept = db.get(Department, department_id)
    if not dept:
        raise HTTPException(404, 'Department not found')
    return dept


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------
@router.get('/departments')
def list_departments(db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    return db.query(Department).filter_by(is_active=True).order_by(Department.name).all()


@router.post('/departments')
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    dept = Department(name=payload.name)
    db.add(dept)
    db.flush()
    audit(db, admin.id, 'CREATE', 'department', str(dept.id))
    db.commit()
    return {'id': dept.id, 'name': dept.name}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@router.get('/users')
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    return db.query(User).all()


@router.post('/users')
def create_user(payload: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    if not db.get(Department, payload.department_id):
        raise HTTPException(404, 'Department not found')
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(409, 'Username already exists')
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        role=payload.role,
        department_id=payload.department_id,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    audit(db, admin.id, 'CREATE', 'user', str(user.id))
    db.commit()
    return {'id': user.id}


@router.patch('/users/{user_id}')
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    data = payload.model_dump(exclude_unset=True)
    # Apply an explicit allow-list instead of accepting an arbitrary dict.
    if 'password' in data:
        user.hashed_password = hash_password(data.pop('password'))
    if 'department_id' in data and not db.get(Department, data['department_id']):
        raise HTTPException(404, 'Department not found')
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    audit(db, admin.id, 'UPDATE', 'user', str(user.id))
    return {'id': user.id}


@router.delete('/users/{user_id}')
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    db.delete(user)
    db.commit()
    audit(db, admin.id, 'DELETE', 'user', str(user_id))
    return {'id': user_id}


# ---------------------------------------------------------------------------
# Tasks (per department) — Admin UI: Task Title, Priority, Quality, Weight
# ---------------------------------------------------------------------------
@router.get('/tasks', response_model=list[TaskAdminOut])
def list_tasks_admin(
    department_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    q = db.query(Task)
    if department_id is not None:
        _get_department_or_404(db, department_id)
        q = q.filter(Task.department_id == department_id)
    return q.order_by(Task.department_id, Task.name).all()


@router.post('/tasks', response_model=TaskAdminOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    _get_department_or_404(db, payload.department_id)

    # Reuse the task (category) if it already exists for this department.
    task = db.query(Task).filter_by(department_id=payload.department_id, name=payload.name).first()
    created_task = task is None
    if not task:
        task = Task(department_id=payload.department_id, name=payload.name)
        db.add(task)
        db.flush()

    todo = TaskTodo(
        task_id=task.id,
        title=payload.quality,
        priority=payload.priority,
        weight=payload.weight,
    )
    db.add(todo)
    db.flush()
    audit(
        db,
        admin.id,
        'CREATE',
        'task',
        str(task.id),
        {'task': task.name, 'quality': payload.quality, 'priority': payload.priority, 'weight': float(payload.weight)},
    )
    db.commit()
    db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# Excel import
# ---------------------------------------------------------------------------
@router.post('/import-tasks/preview')
def preview_tasks(file: UploadFile = File(...), admin: User = Depends(require_roles(RoleEnum.ADMIN))):
    suffix = os.path.splitext(file.filename or 'mapping.xlsx')[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        path = tmp.name
    try:
        return preview_excel(path)
    finally:
        os.unlink(path)


@router.post('/import-tasks')
def import_tasks(
    department_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    _get_department_or_404(db, department_id)
    suffix = os.path.splitext(file.filename or 'mapping.xlsx')[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        path = tmp.name
    try:
        result = import_task_mapping(db, department_id, path)
        audit(db, admin.id, 'IMPORT', 'tasks', str(department_id), result)
        db.commit()
        return result
    finally:
        os.unlink(path)
