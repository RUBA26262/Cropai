import enum, uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum
from app.database.session import Base


class UserRole(str, enum.Enum):
    farmer = "farmer"
    expert = "expert"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.farmer)
    language = Column(String(8), nullable=False, default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
