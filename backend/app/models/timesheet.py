from datetime import date, time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Date, Time, ForeignKey, Text
from app.db.base import Base, TimestampMixin

class Timesheet(Base, TimestampMixin):
    __tablename__ = 'timesheets'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey('departments.id'), index=True, nullable=False)
    task_id: Mapped[int] = mapped_column(ForeignKey('tasks.id'), nullable=False)
    todo_id: Mapped[int] = mapped_column(ForeignKey('task_todos.id'), nullable=False)
    work_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    focused_minutes: Mapped[int] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    user = relationship('User', back_populates='timesheets')
    task = relationship('Task')
    todo = relationship('TaskTodo')
