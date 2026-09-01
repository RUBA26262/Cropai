from datetime import datetime
from pydantic import BaseModel


class PredictionOut(BaseModel):
    id: str
    scan_id: str
    disease_id: str | None
    disease_name: str | None = None
    confidence: float
    severity: str
    is_mock: bool
    created_at: datetime

    class Config:
        from_attributes = True
