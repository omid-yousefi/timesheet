import enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, ForeignKey, Enum
from app.db.base import Base, TimestampMixin

class RoleEnum(str, enum.Enum):
    ADMIN = 'ADMIN'
    MANAGER = 'MANAGER'
    EMPLOYEE = 'EMPLOYEE'

class User(Base, TimestampMixin):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), default=RoleEnum.EMPLOYEE, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey('departments.id'), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    department = relationship('Department', back_populates='users')
    timesheets = relationship('Timesheet', back_populates='user')
