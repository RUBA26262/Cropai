from pydantic import BaseModel


class CropOut(BaseModel):
    id: str
    name: str
    category: str | None

    class Config:
        from_attributes = True


class DiseaseOut(BaseModel):
    id: str
    crop_id: str
    name: str
    symptoms: str | None
    causes: str | None
    prevention: str | None
    management: str | None
    default_severity: str

    class Config:
        from_attributes = True
