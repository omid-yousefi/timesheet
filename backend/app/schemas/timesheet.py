from datetime import date, time
from typing import Optional
from pydantic import BaseModel, Field, model_validator
from app.schemas.common import ORMModel


class TimesheetCreate(BaseModel):
    work_date: date
    task_id: int
    todo_id: int
    start_time: time
    end_time: time
    focused_minutes: int = Field(gt=0)
    notes: str | None = None

    @model_validator(mode='after')
    def validate_times(self):
        start = self.start_time.hour * 60 + self.start_time.minute
        end = self.end_time.hour * 60 + self.end_time.minute
        if end <= start:
            raise ValueError('End time must be after start time')
        if self.focused_minutes > end - start:
            raise ValueError('Focused duration cannot exceed total duration')
        return self


class TimesheetOut(ORMModel):
    id: int
    work_date: date
    task_id: int
    todo_id: int
    start_time: time
    end_time: time
    focused_minutes: int
    notes: str | None


class TodoInfo(BaseModel):
    id: int
    title: str


class TaskInfo(BaseModel):
    id: int
    name: str


class TimesheetOutWithRelations(ORMModel):
    """Timesheet entry with task and todo details for history view."""
    id: int
    work_date: date
    task_id: int
    todo_id: int
    start_time: time
    end_time: time
    focused_minutes: int
    notes: str | None
    task: Optional[TaskInfo] = None
    todo: Optional[TodoInfo] = None
