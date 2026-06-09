from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = 'audit_logs'

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(80))

    # نام metadata در SQLAlchemy رزرو شده است.
    # نام ستون در دیتابیس metadata است، اما در Python از details استفاده می‌کنیم.
    details: Mapped[dict] = mapped_column('metadata', JSONB, default=dict, nullable=False)