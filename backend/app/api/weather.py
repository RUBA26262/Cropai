from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.farm import Farm
from app.services.weather_service import get_current_weather
from app.services.risk_engine import compute_risk
from app.services.alert_service import alert_disease_risk_increase

router = APIRouter(prefix="/api", tags=["weather"])


def _get_owned_farm(farm_id: str, db: Session, current_user: User) -> Farm:
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this farm")
    return farm


@router.get("/weather")
async def get_weather(farm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = _get_owned_farm(farm_id, db, current_user)
    if farm.latitude is None or farm.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This farm has no coordinates set. Add latitude/longitude to see live weather.",
        )
    try:
        weather = await get_current_weather(farm.latitude, farm.longitude)
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Weather service is temporarily unavailable.")
    return weather


@router.get("/risk")
async def get_risk(farm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = _get_owned_farm(farm_id, db, current_user)
    if farm.latitude is None or farm.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This farm has no coordinates set. Add latitude/longitude to compute disease risk.",
        )
    try:
        weather = await get_current_weather(farm.latitude, farm.longitude)
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Weather service is temporarily unavailable.")

    risk = compute_risk(
        temperature_c=weather["temperature_c"] or 25,
        humidity_pct=weather["humidity_pct"] or 50,
        rainfall_mm=weather["rainfall_mm"] or 0,
    )
    alert_disease_risk_increase(db, current_user.id, farm.name, risk["level"], risk["reason"])
    return risk
