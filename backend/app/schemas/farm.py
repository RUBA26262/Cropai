from datetime import datetime
from pydantic import BaseModel


class FarmCreate(BaseModel):
    name: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    area_acres: float | None = None
    soil_type: str | None = None
    irrigation_type: str | None = None
    notes: str | None = None


class FarmUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    area_acres: float | None = None
    soil_type: str | None = None
    irrigation_type: str | None = None
    notes: str | None = None


class FarmOut(BaseModel):
    id: str
    user_id: str
    name: str
    location: str
    latitude: float | None
    longitude: float | None
    area_acres: float | None
    soil_type: str | None
    irrigation_type: str | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True
