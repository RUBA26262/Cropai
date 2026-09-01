import uuid
from sqlalchemy import Column, String, Text, ForeignKey
from app.database.session import Base


class Disease(Base):
    __tablename__ = "diseases"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    crop_id = Column(String(36), ForeignKey("crops.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    symptoms = Column(Text, nullable=True)
    causes = Column(Text, nullable=True)
    prevention = Column(Text, nullable=True)
    management = Column(Text, nullable=True)
    default_severity = Column(String(16), nullable=False, default="medium")
