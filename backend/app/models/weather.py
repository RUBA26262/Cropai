import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Float
from app.database.session import Base


class WeatherData(Base):
    __tablename__ = "weather_data"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("farms.id"), nullable=False, index=True)
    temperature_c = Column(Float, nullable=True)
    humidity_pct = Column(Float, nullable=True)
    rainfall_mm = Column(Float, nullable=True)
    wind_kmh = Column(Float, nullable=True)
    uv_index = Column(Float, nullable=True)
    condition = Column(String(64), nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
