import pandas as pd
from sqlalchemy.orm import Session
from app.models.task import Task, TaskTodo

REQUIRED_COLUMNS = {'Task', 'To Do', 'Priority', 'Weight'}

def preview_excel(file_path: str) -> dict:
    df = pd.read_excel(file_path).fillna('')
    missing = REQUIRED_COLUMNS - set(df.columns)
    return {
        'valid': not missing,
        'missing_columns': sorted(missing),
        'rows': df[list(REQUIRED_COLUMNS & set(df.columns))].head(20).to_dict('records'),
        'total_rows': len(df),
    }

def import_task_mapping(db: Session, department_id: int, file_path: str) -> dict:
    df = pd.read_excel(file_path).fillna('')
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f'Missing required columns: {sorted(missing)}')
    imported_tasks = imported_todos = 0
    for _, row in df.iterrows():
        task_name = str(row['Task']).strip()
        todo_title = str(row['To Do']).strip()
        if not task_name or not todo_title:
            continue
        task = db.query(Task).filter_by(department_id=department_id, name=task_name).first()
        if not task:
            task = Task(department_id=department_id, name=task_name)
            db.add(task); db.flush(); imported_tasks += 1
        todo = db.query(TaskTodo).filter_by(task_id=task.id, title=todo_title).first()
        if not todo:
            db.add(TaskTodo(task_id=task.id, title=todo_title, priority=int(row['Priority'] or 1), weight=float(row['Weight'] or 1)))
            imported_todos += 1
        else:
            todo.priority = int(row['Priority'] or 1); todo.weight = float(row['Weight'] or 1); todo.is_active = True
    return {'tasks_created': imported_tasks, 'todos_created': imported_todos}
