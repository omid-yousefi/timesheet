from datetime import date, time
from typing import Optional
from pydantic import BaseModel, Field, model_validator, field_serializer, computed_field
from app.schemas.common import ORMModel
from app.services.jalali import to_jalali_short, parse_jalali_str

def parse_work_date(v):
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        # Jalali: 1404/03/24
        if '/' in v:
            try:
                first_part = int(v.split('/')[0])
                if 1300 < first_part < 1700:  # Jalali year range
                    return parse_jalali_str(v)
            except Exception:
                pass
        # Fallback Gregorian
        return date.fromisoformat(v)
    return v


class TimesheetCreate(BaseModel):
    work_date: date
    task_id: int
    todo_id: int
    start_time: time
    end_time: time
    focused_minutes: int = Field(gt=0)
    notes: str | None = None

    @model_validator(mode='before')
    @classmethod
    def parse_jalali_date(cls, data):
        if isinstance(data, dict) and 'work_date' in data:
            data['work_date'] = parse_work_date(data['work_date'])
        return data

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

    @computed_field
    @property
    def work_date_jalali(self) -> str:
        return to_jalali_short(self.work_date)

    @field_serializer('work_date')
    def serialize_work_date(self, v: date, _info):
        # Output as Jalali string
        return to_jalali_short(v)


class TodoInfo(BaseModel):
    id: int
    title: str


class TaskInfo(BaseModel):
    id: int
    name: str


class TimesheetOutWithRelations(ORMModel):
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

    @computed_field
    @property
    def work_date_jalali(self) -> str:
        return to_jalali_short(self.work_date)

    @field_serializer('work_date')
    def serialize_work_date(self, v: date, _info):
        return to_jalali_short(v)
