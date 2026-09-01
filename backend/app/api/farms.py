from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.farm import Farm
from app.schemas.farm import FarmCreate, FarmUpdate, FarmOut

router = APIRouter(prefix="/api/farms", tags=["farms"])


@router.get("", response_model=list[FarmOut])
def list_farms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Farm).filter(Farm.user_id == current_user.id).order_by(Farm.created_at.desc()).all()


@router.post("", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(payload: FarmCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = Farm(user_id=current_user.id, **payload.model_dump())
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


def _get_owned_farm(farm_id: str, db: Session, current_user: User) -> Farm:
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this farm")
    return farm


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_owned_farm(farm_id, db, current_user)


@router.put("/{farm_id}", response_model=FarmOut)
def update_farm(farm_id: str, payload: FarmUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = _get_owned_farm(farm_id, db, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(farm, field, value)
    db.commit()
    db.refresh(farm)
    return farm


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(farm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = _get_owned_farm(farm_id, db, current_user)
    db.delete(farm)
    db.commit()
    return None
