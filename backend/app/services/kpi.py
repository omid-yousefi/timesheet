from collections import defaultdict
from datetime import date
from sqlalchemy.orm import Session
from app.models.timesheet import Timesheet
from app.models.task import TaskTodo


def minutes_between(t1, t2):
    return (t2.hour*60 + t2.minute) - (t1.hour*60 + t1.minute)


def productivity_score(rows: list[Timesheet]) -> float:
    if not rows:
        return 0.0
    weighted = 0.0
    max_weighted = 0.0
    for r in rows:
        total = minutes_between(r.start_time, r.end_time)
        focus_rate = r.focused_minutes / max(total, 1)
        priority = getattr(r.todo, 'priority', 1) or 1
        weight = float(getattr(r.todo, 'weight', 1) or 1)
        weighted += weight * priority * focus_rate * (total / 60)
        max_weighted += weight * priority * (total / 60)
    return round(min(100, (weighted / max(max_weighted, 1)) * 100), 2)


def summarize(rows: list[Timesheet]) -> dict:
    days = {r.work_date for r in rows}
    total_minutes = sum(minutes_between(r.start_time, r.end_time) for r in rows)
    focused = sum(r.focused_minutes for r in rows)
    task_minutes = defaultdict(int)
    for r in rows:
        task_minutes[r.task.name] += minutes_between(r.start_time, r.end_time)
    return {
        'average_daily_working_hours': round(total_minutes / 60 / max(len(days), 1), 2),
        'average_focus_rate': round((focused / max(total_minutes, 1)) * 100, 2),
        'productivity_score': productivity_score(rows),
        'task_distribution': [{'name': k, 'hours': round(v/60,2)} for k, v in task_minutes.items()],
    }
