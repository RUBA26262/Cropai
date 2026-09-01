from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from google.cloud import firestore, storage
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

from .model_runtime import ModelUnavailable, registry

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("cropai-inference")
db = firestore.Client()
storage_client = storage.Client()
bucket = storage_client.bucket(os.environ["STORAGE_BUCKET"])
app = FastAPI(title="CropAI private inference", docs_url=None, redoc_url=None, openapi_url=None)


class InferenceRequest(BaseModel):
    scanId: str = Field(pattern=r"^[A-Za-z0-9_-]{10,128}$")


class ImageQualityRejected(ValueError):
    def __init__(self, code: str, metrics: dict, guidance: str):
        super().__init__(code)
        self.code = code
        self.metrics = metrics
        self.guidance = guidance


RETAKE_GUIDANCE = {
    "INVALID_IMAGE_DIMENSIONS": "Move closer and retake the photo; the image must be at least 320 by 320 pixels.",
    "IMAGE_LIGHTING_REJECTED": "Retake in even daylight, avoiding deep shadow, flash glare, and harsh direct sunlight.",
    "IMAGE_BLUR_REJECTED": "Clean the lens, hold the phone steady, tap the affected area to focus, and retake the photo.",
}


def sanitize_image(raw: bytes) -> tuple[Image.Image, bytes, dict]:
    if not raw or len(raw) > 5 * 1024 * 1024:
        raise ValueError("INVALID_IMAGE_SIZE")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            source.verify()
        with Image.open(io.BytesIO(raw)) as source:
            source = ImageOps.exif_transpose(source)
            width, height = source.size
            if width < 320 or height < 320 or width * height > 25_000_000:
                raise ImageQualityRejected(
                    "INVALID_IMAGE_DIMENSIONS",
                    {"width": width, "height": height},
                    RETAKE_GUIDANCE["INVALID_IMAGE_DIMENSIONS"],
                )
            rgb = source.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("INVALID_IMAGE_FORMAT") from error

    grayscale = np.asarray(rgb.convert("L"), dtype=np.float32)
    brightness = float(grayscale.mean())
    horizontal = np.abs(np.diff(grayscale, axis=1)).mean()
    vertical = np.abs(np.diff(grayscale, axis=0)).mean()
    sharpness = float(horizontal + vertical)
    metrics = {
        "width": width,
        "height": height,
        "brightness": round(brightness, 2),
        "sharpness": round(sharpness, 2),
    }
    if brightness < 35 or brightness > 240:
        raise ImageQualityRejected("IMAGE_LIGHTING_REJECTED", metrics, RETAKE_GUIDANCE["IMAGE_LIGHTING_REJECTED"])
    if sharpness < 7:
        raise ImageQualityRejected("IMAGE_BLUR_REJECTED", metrics, RETAKE_GUIDANCE["IMAGE_BLUR_REJECTED"])

    output = io.BytesIO()
    rgb.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    rgb.save(output, format="JPEG", quality=88, optimize=True)
    return rgb, output.getvalue(), metrics


def severity_for(condition_id: str, lesion_ratio: float | None, symptoms: dict) -> str | None:
    if condition_id.endswith("healthy"):
        return "none"
    if lesion_ratio is not None:
        if lesion_ratio >= 0.25:
            return "high"
        if lesion_ratio >= 0.1:
            return "medium"
        return "low"
    affected = symptoms.get("affectedArea")
    pests = symptoms.get("visiblePests")
    if affected == "whole_plant" or pests == "many":
        return "high"
    if affected == "many_leaves" or pests == "few":
        return "medium"
    if affected == "few_leaves":
        return "low"
    return None


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok", "modelRootConfigured": bool(os.getenv("MODEL_ROOT"))}


@app.post("/v1/infer")
def infer(payload: InferenceRequest, request: Request) -> dict:
    # Cloud Run IAM validates the Google-signed OIDC token before this handler.
    if not request.headers.get("authorization") and not request.headers.get("x-serverless-authorization"):
        raise HTTPException(status_code=401, detail="AUTH_REQUIRED")
    scan_ref = db.collection("scans").document(payload.scanId)
    scan = scan_ref.get()
    if not scan.exists:
        raise HTTPException(status_code=404, detail="SCAN_NOT_FOUND")
    data = scan.to_dict() or {}
    if data.get("status") not in {"queued", "processing"}:
        return {"status": data.get("status", "ignored")}
    uid = data.get("ownerUid")
    crop_key = data.get("cropKey")
    if not uid or not crop_key:
        raise HTTPException(status_code=422, detail="SCAN_DATA_INVALID")
    scan_ref.update({"status": "processing", "updatedAt": firestore.SERVER_TIMESTAMP})

    quality: dict[str, dict] = {}
    sanitized_images: list[Image.Image] = []
    try:
        blobs = list(storage_client.list_blobs(bucket, prefix=f"quarantine/{uid}/{payload.scanId}/"))
        if len(blobs) < 2 or len(blobs) > 3:
            raise ValueError("REQUIRED_IMAGES_MISSING")
        for blob in blobs:
            raw = blob.download_as_bytes()
            slot = blob.name.rsplit("/", 1)[-1].split(".", 1)[0]
            if slot not in {"closeup", "plant", "context"}:
                raise ValueError("INVALID_IMAGE_SLOT")
            try:
                image, sanitized, metrics = sanitize_image(raw)
            except ImageQualityRejected as error:
                quality[slot] = {**error.metrics, "accepted": False, "failureCode": error.code}
                scan_ref.update({
                    "status": "rejected",
                    "failureCode": error.code,
                    "failedImageSlot": slot,
                    "retakeGuidance": error.guidance,
                    "quality": quality,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                })
                return {"status": "rejected", "code": error.code, "slot": slot, "retakeGuidance": error.guidance}
            metrics["accepted"] = True
            quality[slot] = metrics
            sanitized_images.append(image)
            target = bucket.blob(f"scans/{uid}/{payload.scanId}/{slot}.jpg")
            target.upload_from_string(sanitized, content_type="image/jpeg", if_generation_match=0)
            target.metadata = {"ownerUid": uid, "scanId": payload.scanId, "sanitized": "true"}
            target.patch()

        closeup_index = next(i for i, blob in enumerate(blobs) if "/closeup." in blob.name)
        prediction = registry.predict(crop_key, sanitized_images[closeup_index])
        uncertain = prediction.uncertain
        result = {
            "conditionId": None if uncertain else prediction.condition_id,
            "confidence": prediction.confidence,
            "alternatives": prediction.alternatives,
            "uncertain": uncertain,
            "evidence": {"type": "model_attention_pending", "lesionRatio": prediction.lesion_ratio},
            "severity": None if uncertain else severity_for(prediction.condition_id, prediction.lesion_ratio, data.get("symptoms", {})),
            "modelVersion": prediction.model_version,
            "labelMapVersion": prediction.label_map_version,
            "calibrationVersion": prediction.calibration_version,
        }
        scan_ref.update({"status": "needs_expert" if uncertain else "completed", "result": result, "quality": quality, "imageSlots": list(quality), "completedAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP})
        if uncertain or result["severity"] in {"medium", "high"}:
            db.collection("alerts").add({
                "recipientUid": uid,
                "type": "diagnosis_uncertain" if uncertain else "condition_detected",
                "severity": "warning" if uncertain else result["severity"],
                "sourceId": payload.scanId,
                "title": "Expert review recommended" if uncertain else "Crop condition detected",
                "message": "The scan could not be diagnosed reliably." if uncertain else "Review the diagnosis and integrated management guidance.",
                "read": False, "deliveryState": "pending", "createdAt": firestore.SERVER_TIMESTAMP,
            })
        return {"status": "completed", "uncertain": uncertain}
    except ModelUnavailable:
        logger.warning("Validated model unavailable", extra={"scanId": payload.scanId, "cropKey": crop_key})
        scan_ref.update({"status": "failed", "failureCode": "VALIDATED_MODEL_UNAVAILABLE", "updatedAt": firestore.SERVER_TIMESTAMP})
        return {"status": "failed", "code": "VALIDATED_MODEL_UNAVAILABLE"}
    except ValueError as error:
        code = str(error)
        guidance = RETAKE_GUIDANCE.get(code)
        scan_ref.update({"status": "rejected", "failureCode": code, "quality": quality, "retakeGuidance": guidance, "updatedAt": firestore.SERVER_TIMESTAMP})
        return {"status": "rejected", "code": code, "retakeGuidance": guidance}
    except Exception:
        logger.exception("Inference failed", extra={"scanId": payload.scanId})
        scan_ref.update({"status": "failed", "failureCode": "INFERENCE_FAILED", "updatedAt": firestore.SERVER_TIMESTAMP})
        raise HTTPException(status_code=500, detail="INFERENCE_FAILED")
    finally:
        for blob in list(storage_client.list_blobs(bucket, prefix=f"quarantine/{uid}/{payload.scanId}/")):
            try:
                blob.delete()
            except Exception:
                logger.warning("Quarantine cleanup failed", extra={"scanId": payload.scanId})
