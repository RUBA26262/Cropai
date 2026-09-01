import uuid
from sqlalchemy import Column, String
from app.database.session import Base


class Crop(Base):
    __tablename__ = "crops"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    category = Column(String(100), nullable=True)
