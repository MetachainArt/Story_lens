import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from passlib.context import CryptContext
import traceback

engine = create_async_engine('postgresql+asyncpg://postgres.medvsukasywhbqdwahmj:16%29!5208PJsa@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?ssl=disable')
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def reset_password():
    try:
        pw = pwd_context.hash("password123")
        async with engine.begin() as conn:
            # Check if user exists
            res = await conn.execute(text("SELECT * FROM users WHERE email='teacher@storylens.com'"))
            user = res.fetchone()
            if not user:
                print("User does not exist, creating new one...")
                from uuid import uuid4
                await conn.execute(text("""
                    INSERT INTO users (id, name, email, password_hash, role, is_active)
                    VALUES (:id, :name, :email, :pw, 'teacher', true)
                """), {"id": str(uuid4()), "name": "테스트 선생님", "email": "teacher@storylens.com", "pw": pw})
            else:
                print("User exists, updating password...")
                await conn.execute(text("UPDATE users SET password_hash=:pw WHERE email='teacher@storylens.com'"), {"pw": pw})
            print("Successfully updated/created teacher@storylens.com with password123")
    except Exception as e:
        print("Error details:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(reset_password())
