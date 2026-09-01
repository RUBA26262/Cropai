import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Boolean
from app.database.session import Base


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String(36), ForeignKey("crop_scans.id"), nullable=False, index=True)
    disease_id = Column(String(36), ForeignKey("diseases.id"), nullable=True, index=True)
    confidence = Column(Float, nullable=False)
    severity = Column(String(16), nullable=False, default="unknown")
    is_mock = Column(Boolean, default=True)
    gradcam_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
