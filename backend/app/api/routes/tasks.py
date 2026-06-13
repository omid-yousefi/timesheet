from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.task import Task, TaskTodo
from app.schemas.task import TaskOut, TodoOut, TaskOutWithTodos

router = APIRouter(prefix='/tasks', tags=['tasks'])

@router.get('', response_model=list[TaskOutWithTodos])
def list_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List tasks with their todos for the logged-in user's department."""
    tasks = (
        db.query(Task)
        .filter_by(department_id=user.department_id, is_active=True)
        .order_by(Task.name)
        .all()
    )
    return tasks

@router.get('/{task_id}/todos', response_model=list[TodoOut])
def list_todos(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = db.get(Task, task_id)
    if not task or task.department_id != user.department_id:
        raise HTTPException(404, 'Task not found')
    return db.query(TaskTodo).filter_by(task_id=task_id, is_active=True).order_by(TaskTodo.title).all()
