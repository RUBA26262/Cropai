from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.crop import Crop
from app.models.disease import Disease
from app.schemas.crop import CropOut, DiseaseOut

router = APIRouter(prefix="/api", tags=["crops"])


@router.get("/crops", response_model=list[CropOut])
def list_crops(db: Session = Depends(get_db)):
    return db.query(Crop).order_by(Crop.name).all()


@router.get("/diseases", response_model=list[DiseaseOut])
def list_diseases(crop_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Disease)
    if crop_id:
        query = query.filter(Disease.crop_id == crop_id)
    return query.all()


@router.get("/diseases/{disease_id}", response_model=DiseaseOut)
def get_disease(disease_id: str, db: Session = Depends(get_db)):
    disease = db.query(Disease).filter(Disease.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")
    return disease
