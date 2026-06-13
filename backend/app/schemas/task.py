from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.common import ORMModel


class TaskOut(ORMModel):
    """Minimal task info exposed to employees."""
    id: int
    name: str


class TodoOut(ORMModel):
    """Minimal to-do info exposed to employees (no priority/weight)."""
    id: int
    title: str


class TodoAdminOut(ORMModel):
    """Full to-do info for admins (includes KPI-only fields)."""
    id: int
    title: str
    priority: int
    weight: Decimal
    is_active: bool


class TaskAdminOut(ORMModel):
    """Rich task view for the admin panel, including its to-dos."""
    id: int
    name: str
    department_id: int
    is_active: bool
    todos: List[TodoAdminOut] = []
