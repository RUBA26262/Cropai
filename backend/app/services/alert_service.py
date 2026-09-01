"""Generates alert rows for a user based on real events in the system.

Called from routers right after the triggering event (a scan, a risk check)
rather than on a background schedule — keeps Phase 2 simple and avoids
needing a task queue yet. A cron/beat job can call these same functions
later without changing their signatures.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.crop_scan import CropScan
from app.models.farm_crop import FarmCrop
from app.models.farm import Farm


def create_alert(db: Session, user_id: str, alert_type: str, title: str, message: str) -> Alert:
    alert = Alert(user_id=user_id, type=alert_type, title=title, message=message)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def alert_high_severity_result(db: Session, user_id: str, crop_name: str, disease_name: str, severity: str):
    if severity not in ("high", "medium"):
        return None
    return create_alert(
        db, user_id,
        alert_type="disease_detected",
        title="Disease Risk Detected" if severity == "high" else "Possible Disease Detected",
        message=f"{crop_name} — {disease_name} was detected with {severity} severity. Review the scan and consider management steps.",
    )


def alert_disease_risk_increase(db: Session, user_id: str, farm_name: str, level: str, reason: str):
    if level not in ("HIGH", "MEDIUM"):
        return None
    # Avoid spamming: skip if an unread risk alert for this farm was already created in the last 6 hours.
    recent_cutoff = datetime.utcnow() - timedelta(hours=6)
    existing = (
        db.query(Alert)
        .filter(Alert.user_id == user_id, Alert.type == "weather_risk", Alert.created_at > recent_cutoff)
        .filter(Alert.message.like(f"{farm_name}:%"))
        .first()
    )
    if existing:
        return None
    return create_alert(
        db, user_id,
        alert_type="weather_risk",
        title="Disease Risk Increased",
        message=f"{farm_name}: disease risk is {level} — {reason.lower()}.",
    )


def alert_monitoring_reminder(db: Session, user_id: str, farm_crop_id: str, crop_name: str, farm_name: str, days: int = 7) -> Alert | None:
    """Creates a reminder if this farm_crop hasn't been scanned in `days` days
    (or has never been scanned). Safe to call repeatedly — only fires once per
    window because it checks for an existing unread reminder first."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    last_scan = (
        db.query(CropScan)
        .filter(CropScan.farm_crop_id == farm_crop_id)
        .order_by(CropScan.created_at.desc())
        .first()
    )
    if last_scan and last_scan.created_at > cutoff:
        return None

    existing = (
        db.query(Alert)
        .filter(Alert.user_id == user_id, Alert.type == "monitoring_reminder", Alert.is_read == False)  # noqa: E712
        .filter(Alert.message.like(f"%{crop_name}%{farm_name}%"))
        .first()
    )
    if existing:
        return None

    return create_alert(
        db, user_id,
        alert_type="monitoring_reminder",
        title="Crop Monitoring Reminder",
        message=f"Your {crop_name} crop at {farm_name} has not been scanned for {days}+ days.",
    )
