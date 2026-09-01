import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, Date, DateTime
from app.database.session import Base


class FarmCrop(Base):
    __tablename__ = "farm_crops"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("farms.id"), nullable=False, index=True)
    crop_id = Column(String(36), ForeignKey("crops.id"), nullable=False, index=True)
    planting_date = Column(Date, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
