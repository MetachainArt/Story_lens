# @TASK P0-T0.2 - Seed data for initial users
# @SPEC docs/planning/04-database-design.md
"""Seed script to populate initial users."""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy import text
from app.db.database import AsyncSessionLocal
from app.core.security import get_password_hash


async def create_seed_data():
    """Create seed data: 1 teacher and 3 students."""
    async with AsyncSessionLocal() as session:
        # Hash the default password
        hashed_password = get_password_hash("password123")

        # Create teacher
        teacher_id = str(uuid.uuid4())
        teacher_sql = text("""
            INSERT INTO users (id, name, email, password_hash, role, teacher_id, is_active, created_at, updated_at)
            VALUES (:id, :name, :email, :password_hash, :role, :teacher_id, :is_active, :created_at, :updated_at)
            ON CONFLICT (email) DO NOTHING
        """)

        await session.execute(
            teacher_sql,
            {
                "id": teacher_id,
                "name": "선생님",
                "email": "teacher@storylens.com",
                "password_hash": hashed_password,
                "role": "teacher",
                "teacher_id": None,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        )

        # Create students
        students = [
            {"name": "학생1", "email": "student1@storylens.com"},
            {"name": "학생2", "email": "student2@storylens.com"},
            {"name": "학생3", "email": "student3@storylens.com"},
        ]

        for student in students:
            student_id = str(uuid.uuid4())
            await session.execute(
                teacher_sql,
                {
                    "id": student_id,
                    "name": student["name"],
                    "email": student["email"],
                    "password_hash": hashed_password,
                    "role": "student",
                    "teacher_id": teacher_id,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            )

        await session.commit()
        print("✅ Seed data created successfully!")
        print("   - Teacher: teacher@storylens.com (password: password123)")
        print("   - Students: student1@storylens.com, student2@storylens.com, student3@storylens.com (password: password123)")


if __name__ == "__main__":
    asyncio.run(create_seed_data())
