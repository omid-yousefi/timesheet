from pydantic import BaseModel
from app.models.user import RoleEnum

class DepartmentCreate(BaseModel):
    name: str

class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: RoleEnum
    department_id: int
