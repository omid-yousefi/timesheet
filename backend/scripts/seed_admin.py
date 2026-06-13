"""Idempotently create the bootstrap admin account.

Credentials are read from application settings (which load from the
environment / .env), so secrets are never hard-coded in source control.

Run directly:
    python scripts/seed_admin.py
"""
import sys
from pathlib import Path

# Allow running this file directly: `python scripts/seed_admin.py`
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.department import Department
from app.models.user import User, RoleEnum
from app.core.security import hash_password


def seed_admin() -> None:
    with SessionLocal() as db:
        dept = db.query(Department).filter(Department.name == settings.admin_department).first()
        if not dept:
            dept = Department(name=settings.admin_department)
            db.add(dept)
            db.flush()

        user = db.query(User).filter(User.username == settings.admin_username).first()
        if user:
            print(f"Admin user already exists: {settings.admin_username}")
            return

        user = User(
            username=settings.admin_username,
            full_name=settings.admin_full_name,
            hashed_password=hash_password(settings.admin_password),
            role=RoleEnum.ADMIN,
            department_id=dept.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Admin created: username={settings.admin_username}")


if __name__ == '__main__':
    seed_admin()
