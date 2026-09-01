from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.farm import Farm
from app.models.crop import Crop
from app.models.farm_crop import FarmCrop
from app.schemas.farm_crop import FarmCropCreate, FarmCropOut

router = APIRouter(prefix="/api/farm-crops", tags=["farm-crops"])


@router.get("", response_model=list[FarmCropOut])
def list_farm_crops(farm_id: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(FarmCrop).join(Farm, FarmCrop.farm_id == Farm.id).filter(Farm.user_id == current_user.id)
    if farm_id:
        query = query.filter(FarmCrop.farm_id == farm_id)
    items = query.order_by(FarmCrop.created_at.desc()).all()
    results = []
    for fc in items:
        out = FarmCropOut.model_validate(fc)
        crop = db.query(Crop).filter(Crop.id == fc.crop_id).first()
        out.crop_name = crop.name if crop else None
        results.append(out)
    return results


@router.post("", response_model=FarmCropOut, status_code=status.HTTP_201_CREATED)
def create_farm_crop(payload: FarmCropCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(Farm.id == payload.farm_id).first()
    if not farm or farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this farm")
    crop = db.query(Crop).filter(Crop.id == payload.crop_id).first()
    if not crop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crop not found")

    farm_crop = FarmCrop(farm_id=payload.farm_id, crop_id=payload.crop_id, planting_date=payload.planting_date)
    db.add(farm_crop)
    db.commit()
    db.refresh(farm_crop)
    out = FarmCropOut.model_validate(farm_crop)
    out.crop_name = crop.name
    return out
