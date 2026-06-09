import sys
from pathlib import Path

# Allow running this file directly on Windows/Linux:
# python scripts/seed_admin.py
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models.department import Department
from app.models.user import User, RoleEnum
from app.core.security import hash_password

USERNAME = "admin"
PASSWORD = "Admin@12345"
DEPARTMENT = "مدیریت"

with SessionLocal() as db:
    dept = db.query(Department).filter(Department.name == DEPARTMENT).first()
    if not dept:
        dept = Department(name=DEPARTMENT)
        db.add(dept)
        db.flush()

    user = db.query(User).filter(User.username == USERNAME).first()
    if not user:
        user = User(
            username=USERNAME,
            full_name="مدیر سیستم",
            hashed_password=hash_password(PASSWORD),
            role=RoleEnum.ADMIN,
            department_id=dept.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Admin created: username={USERNAME} password={PASSWORD}")
    else:
        print("Admin user already exists")
