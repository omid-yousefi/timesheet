from app.schemas.common import ORMModel
from app.models.user import RoleEnum

class UserOut(ORMModel):
    id: int
    username: str
    full_name: str
    role: RoleEnum
    department_id: int
    is_active: bool
