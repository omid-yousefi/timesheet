from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean
from app.db.base import Base, TimestampMixin

class Department(Base, TimestampMixin):
    __tablename__ = 'departments'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    users = relationship('User', back_populates='department')
    tasks = relationship('Task', back_populates='department')
