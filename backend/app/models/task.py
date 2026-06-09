from decimal import Decimal
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint, Numeric
from app.db.base import Base, TimestampMixin

class Task(Base, TimestampMixin):
    __tablename__ = 'tasks'
    __table_args__ = (UniqueConstraint('department_id', 'name', name='uq_department_task'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey('departments.id'), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    department = relationship('Department', back_populates='tasks')
    todos = relationship('TaskTodo', back_populates='task', cascade='all, delete-orphan')

class TaskTodo(Base, TimestampMixin):
    __tablename__ = 'task_todos'
    __table_args__ = (UniqueConstraint('task_id', 'title', name='uq_task_todo'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey('tasks.id'), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[int] = mapped_column(default=1, nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(8,2), default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    task = relationship('Task', back_populates='todos')
