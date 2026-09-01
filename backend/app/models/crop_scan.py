import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from app.database.session import Base


class CropScan(Base):
    __tablename__ = "crop_scans"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_crop_id = Column(String(36), ForeignKey("farm_crops.id"), nullable=False, index=True)
    image_path = Column(String(512), nullable=False)
    quality_ok = Column(Boolean, default=True)
    quality_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
