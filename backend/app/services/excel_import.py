import pandas as pd
from sqlalchemy.orm import Session
from app.models.task import Task, TaskTodo

REQUIRED_COLUMNS = {'Task Title', 'Priority', 'Quality', 'Weight'}

def preview_excel(file_path: str) -> dict:
    # We specifically want to preview Task_Mapping sheet
    df = pd.read_excel(file_path, sheet_name='Task_Mapping').fillna('')
    missing = REQUIRED_COLUMNS - set(df.columns)
    return {
        'valid': not missing,
        'missing_columns': sorted(missing),
        'rows': df[list(REQUIRED_COLUMNS & set(df.columns))].head(20).to_dict('records'),
        'total_rows': len(df),
    }

def import_task_mapping(db: Session, department_id: int, file_path: str) -> dict:
    # Read the Task_Mapping sheet specifically
    df = pd.read_excel(file_path, sheet_name='Task_Mapping').fillna('')
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f'Missing required columns in Task_Mapping sheet: {sorted(missing)}')
    
    imported_tasks = imported_todos = 0
    for _, row in df.iterrows():
        task_name = str(row['Task Title']).strip()
        todo_title = str(row['Quality']).strip()
        
        if not task_name or not todo_title:
            continue
            
        task = db.query(Task).filter_by(department_id=department_id, name=task_name).first()
        if not task:
            task = Task(department_id=department_id, name=task_name)
            db.add(task)
            db.flush()
            imported_tasks += 1
            
        todo = db.query(TaskTodo).filter_by(task_id=task.id, title=todo_title).first()
        if not todo:
            # Handle Priority: it might be a string like "فوری (Urgent)", we might want to extract a number or keep it simple.
            # The model expects an int for priority.
            priority_val = 1
            try:
                # Try to see if it's numeric, otherwise default to 1 or map it.
                priority_val = int(row['Priority'])
            except:
                # Map common Persian priority terms if needed, otherwise just 1
                p_str = str(row['Priority'])
                if 'فوری' in p_str: priority_val = 3
                elif 'ضروری' in p_str: priority_val = 2
                elif 'مهم' in p_str: priority_val = 1
                else: priority_val = 0

            db.add(TaskTodo(
                task_id=task.id, 
                title=todo_title, 
                priority=priority_val, 
                weight=float(row['Weight'] or 1)
            ))
            imported_todos += 1
        else:
            priority_val = 1
            try:
                priority_val = int(row['Priority'])
            except:
                p_str = str(row['Priority'])
                if 'فوری' in p_str: priority_val = 3
                elif 'ضروری' in p_str: priority_val = 2
                elif 'مهم' in p_str: priority_val = 1
                else: priority_val = 0
                
            todo.priority = priority_val
            todo.weight = float(row['Weight'] or 1)
            todo.is_active = True
            
    return {'tasks_created': imported_tasks, 'todos_created': imported_todos}
