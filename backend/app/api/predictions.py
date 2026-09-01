import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.farm import Farm
from app.models.farm_crop import FarmCrop
from app.models.crop import Crop
from app.models.crop_scan import CropScan
from app.models.prediction import Prediction
from app.models.disease import Disease
from app.models.alert import Alert
from app.schemas.prediction import PredictionOut
from app.ml.preprocess import check_image_quality
from app.ml import model as ml_model
from app.services.alert_service import alert_high_severity_result, alert_monitoring_reminder

router = APIRouter(prefix="/api", tags=["predictions"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LOW_CONFIDENCE_THRESHOLD = 65.0


@router.post("/predictions", response_model=PredictionOut, status_code=status.HTTP_201_CREATED)
async def create_prediction(
    farm_crop_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    farm_crop = db.query(FarmCrop).filter(FarmCrop.id == farm_crop_id).first()
    if not farm_crop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crop planting record not found")
    farm = db.query(Farm).filter(Farm.id == farm_crop.farm_id).first()
    if not farm or farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this farm")

    image_bytes = await file.read()
    ok, quality_message = check_image_quality(image_bytes)

    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    scan = CropScan(
        farm_crop_id=farm_crop_id,
        image_path=filename,
        quality_ok=ok,
        quality_notes=quality_message,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    if not ok:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=quality_message)

    crop = db.query(Crop).filter(Crop.id == farm_crop.crop_id).first()
    result = ml_model.predict(crop.name if crop else "Unknown", image_bytes)
    severity = ml_model.severity_from_confidence(result.disease_name, result.confidence)

    disease = None
    if result.disease_name != "Healthy":
        disease = db.query(Disease).filter(
            Disease.crop_id == farm_crop.crop_id, Disease.name == result.disease_name
        ).first()

    prediction = Prediction(
        scan_id=scan.id,
        disease_id=disease.id if disease else None,
        confidence=result.confidence,
        severity=severity,
        is_mock=result.is_mock,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    if disease:
        alert_high_severity_result(db, current_user.id, crop.name if crop else "Crop", disease.name, severity)

    out = PredictionOut.model_validate(prediction)
    out.disease_name = result.disease_name
    return out


@router.get("/predictions", response_model=list[PredictionOut])
def list_predictions(farm_crop_id: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        db.query(Prediction)
        .join(CropScan, Prediction.scan_id == CropScan.id)
        .join(FarmCrop, CropScan.farm_crop_id == FarmCrop.id)
        .join(Farm, FarmCrop.farm_id == Farm.id)
        .filter(Farm.user_id == current_user.id)
    )
    if farm_crop_id:
        query = query.filter(FarmCrop.id == farm_crop_id)
    predictions = query.order_by(Prediction.created_at.desc()).all()

    results = []
    for p in predictions:
        out = PredictionOut.model_validate(p)
        if p.disease_id:
            disease = db.query(Disease).filter(Disease.id == p.disease_id).first()
            out.disease_name = disease.name if disease else None
        else:
            out.disease_name = "Healthy"
        results.append(out)
    return results


@router.get("/predictions/{prediction_id}", response_model=PredictionOut)
def get_prediction(prediction_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    out = PredictionOut.model_validate(prediction)
    if prediction.disease_id:
        disease = db.query(Disease).filter(Disease.id == prediction.disease_id).first()
        out.disease_name = disease.name if disease else None
    else:
        out.disease_name = "Healthy"
    return out


@router.post("/predictions/check-reminders")
def check_monitoring_reminders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Call this when the farmer opens their dashboard. Creates a reminder
    alert for any planted crop that hasn't been scanned in 7+ days."""
    farm_crops = (
        db.query(FarmCrop)
        .join(Farm, FarmCrop.farm_id == Farm.id)
        .filter(Farm.user_id == current_user.id, FarmCrop.status == "active")
        .all()
    )
    created = 0
    for fc in farm_crops:
        farm = db.query(Farm).filter(Farm.id == fc.farm_id).first()
        crop = db.query(Crop).filter(Crop.id == fc.crop_id).first()
        if not farm or not crop:
            continue
        result = alert_monitoring_reminder(db, current_user.id, fc.id, crop.name, farm.name)
        if result:
            created += 1
    return {"reminders_created": created}
