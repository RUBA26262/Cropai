from datetime import date, datetime
from pydantic import BaseModel


class FarmCropCreate(BaseModel):
    farm_id: str
    crop_id: str
    planting_date: date | None = None


class FarmCropOut(BaseModel):
    id: str
    farm_id: str
    crop_id: str
    crop_name: str | None = None
    planting_date: date | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
