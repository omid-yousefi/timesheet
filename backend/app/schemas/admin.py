from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field
from app.models.user import RoleEnum


class DepartmentCreate(BaseModel):
    name: str


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str = Field(min_length=6)
    role: RoleEnum
    department_id: int


class UserUpdate(BaseModel):
    """Explicit, allow-listed fields for updating a user (prevents mass-assignment)."""
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)
    role: Optional[RoleEnum] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class TaskCreate(BaseModel):
    """Admin form payload: creates a Task (category) plus its first To-Do item.

    Field mapping matches the Excel import contract:
      - name     -> tasks.name            (Task Title)
      - quality  -> task_todos.title      (Quality / activity description)
      - priority -> task_todos.priority   (server-side KPI only)
      - weight   -> task_todos.weight     (server-side KPI only)
    """
    department_id: int
    name: str = Field(min_length=1, max_length=255)
    quality: str = Field(min_length=1, max_length=255)
    priority: int = Field(default=1, ge=0, le=5)
    weight: Decimal = Field(default=Decimal('1.0'), ge=0, max_digits=8, decimal_places=2)


class TaskUpdate(BaseModel):
    """Allow-listed fields for updating a task and its primary todo."""
    name: Optional[str] = None
    department_id: Optional[int] = None
    quality: Optional[str] = None
    priority: Optional[int] = None
    weight: Optional[Decimal] = None
    is_active: Optional[bool] = None
