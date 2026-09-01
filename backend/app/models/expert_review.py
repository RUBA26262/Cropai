import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from app.database.session import Base


class ExpertReview(Base):
    __tablename__ = "expert_reviews"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prediction_id = Column(String(36), ForeignKey("predictions.id"), nullable=False, index=True)
    expert_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    verdict = Column(String(32), nullable=False)
    corrected_disease_id = Column(String(36), ForeignKey("diseases.id"), nullable=True)
    notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
