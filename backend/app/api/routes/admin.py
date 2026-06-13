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
from app.schemas.admin import DepartmentCreate, TaskCreate, TaskUpdate, UserCreate, UserUpdate
from app.schemas.task import TaskAdminOut
from app.services.excel_import import preview_excel, import_task_mapping
from app.services.audit import audit

router = APIRouter(prefix='/admin', tags=['admin'])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_department_or_404(db: Session, department_id: int) -> Department:
    dept = db.get(Department, department_id)
    if not dept:
        raise HTTPException(404, 'Department not found')
    return dept


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, 'Task not found')
    return task


def _get_todo_or_404(db: Session, todo_id: int) -> TaskTodo:
    todo = db.get(TaskTodo, todo_id)
    if not todo:
        raise HTTPException(404, 'To-Do not found')
    return todo


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------
@router.get('/departments')
def list_departments(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    return db.query(Department).filter_by(is_active=True).order_by(Department.name).all()


@router.post('/departments')
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    dept = Department(name=payload.name)
    db.add(dept)
    db.flush()
    audit(db, admin.id, 'CREATE', 'department', str(dept.id))
    db.commit()
    return {'id': dept.id, 'name': dept.name}


@router.patch('/departments/{department_id}')
def update_department(
    department_id: int,
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    dept = _get_department_or_404(db, department_id)
    dept.name = payload.name
    audit(db, admin.id, 'UPDATE', 'department', str(dept.id))
    db.commit()
    return {'id': dept.id, 'name': dept.name}


@router.delete('/departments/{department_id}')
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    dept = _get_department_or_404(db, department_id)
    dept.is_active = False
    audit(db, admin.id, 'DELETE', 'department', str(dept.id))
    db.commit()
    return {'id': department_id}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@router.get('/users')
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    return db.query(User).all()


@router.post('/users')
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
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
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    # Prevent modifying the primary admin account's role or deactivating them
    if user.role == RoleEnum.ADMIN and user.id == admin.id:
        raise HTTPException(403, 'You cannot modify the primary admin account')

    data = payload.model_dump(exclude_unset=True)
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
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    # Admin users can NEVER be deleted
    if user.role == RoleEnum.ADMIN:
        raise HTTPException(403, 'Admin users cannot be deleted')
    db.delete(user)
    db.commit()
    audit(db, admin.id, 'DELETE', 'user', str(user_id))
    return {'id': user_id}


# ---------------------------------------------------------------------------
# Tasks (per department) — full CRUD
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
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    _get_department_or_404(db, payload.department_id)

    task = db.query(Task).filter_by(
        department_id=payload.department_id,
        name=payload.name,
    ).first()
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
        {
            'task': task.name,
            'quality': payload.quality,
            'priority': payload.priority,
            'weight': float(payload.weight),
        },
    )
    db.commit()
    db.refresh(task)
    return task


@router.put('/tasks/{task_id}', response_model=TaskAdminOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    task = _get_task_or_404(db, task_id)

    data = payload.model_dump(exclude_unset=True)
    if 'department_id' in data:
        _get_department_or_404(db, data['department_id'])

    if 'name' in data:
        existing = (
            db.query(Task)
            .filter(Task.department_id == data.get('department_id', task.department_id), Task.name == data['name'])
            .filter(Task.id != task_id)
            .first()
        )
        if existing:
            raise HTTPException(409, 'A task with this name already exists in the department')
        task.name = data['name']

    if 'department_id' in data:
        task.department_id = data['department_id']
    if 'is_active' in data:
        task.is_active = data['is_active']

    # Update associated todo if provided
    if 'quality' in data or 'priority' in data or 'weight' in data:
        todo = db.query(TaskTodo).filter_by(task_id=task.id).first()
        if todo:
            if 'quality' in data:
                todo.title = data['quality']
            if 'priority' in data:
                todo.priority = data['priority']
            if 'weight' in data:
                todo.weight = data['weight']
        else:
            db.add(
                TaskTodo(
                    task_id=task.id,
                    title=data.get('quality', ''),
                    priority=data.get('priority', 1),
                    weight=data.get('weight', 1),
                )
            )

    db.commit()
    db.refresh(task)
    audit(db, admin.id, 'UPDATE', 'task', str(task.id), data)
    return task


@router.delete('/tasks/{task_id}')
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    task = _get_task_or_404(db, task_id)
    task.is_active = False
    for todo in task.todos:
        todo.is_active = False
    db.commit()
    audit(db, admin.id, 'DELETE', 'task', str(task_id))
    return {'id': task_id}


# ---------------------------------------------------------------------------
# Task Todos — edit & delete
# ---------------------------------------------------------------------------
@router.put('/todos/{todo_id}')
def update_todo(
    todo_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    todo = _get_todo_or_404(db, todo_id)
    if 'title' in payload:
        todo.title = payload['title']
    if 'priority' in payload:
        todo.priority = payload['priority']
    if 'weight' in payload:
        todo.weight = payload['weight']
    if 'is_active' in payload:
        todo.is_active = payload['is_active']
    db.commit()
    audit(db, admin.id, 'UPDATE', 'todo', str(todo_id))
    return {'id': todo.id}


@router.delete('/todos/{todo_id}')
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    todo = _get_todo_or_404(db, todo_id)
    todo.is_active = False
    db.commit()
    audit(db, admin.id, 'DELETE', 'todo', str(todo_id))
    return {'id': todo_id}


# ---------------------------------------------------------------------------
# Excel import
# ---------------------------------------------------------------------------
@router.post('/import-tasks/preview')
def preview_tasks(
    file: UploadFile = File(...),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
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
