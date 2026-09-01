import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from app.database.session import Base


class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    context_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
