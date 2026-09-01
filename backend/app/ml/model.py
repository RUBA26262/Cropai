"""ML inference service — single pluggable interface.

IMPORTANT: This currently runs in MOCK mode (ML_MODE=mock in .env). Every
prediction is flagged is_mock=True and MUST be rendered with a "Demo
Prediction" badge in the UI — never presented as a real diagnosis.

To plug in a trained model later:
  1. Load your trained weights in `_load_model()`.
  2. Replace the body of `predict()` with real preprocessing + inference.
  3. Set ML_MODE=real in .env.
Nothing outside this file needs to change — routers call `predict()` only.
"""
import os
import random
from dataclasses import dataclass

ML_MODE = os.getenv("ML_MODE", "mock")

_MOCK_DISEASE_POOL = {
    "Tomato": ["Early Blight", "Late Blight", "Bacterial Spot", "Healthy"],
    "Rice": ["Bacterial Leaf Blight", "Brown Spot", "Healthy"],
    "Maize": ["Northern Corn Leaf Blight", "Common Rust", "Healthy"],
    "Potato": ["Early Blight", "Late Blight", "Healthy"],
    "Apple": ["Apple Scab", "Cedar Apple Rust", "Healthy"],
    "Grape": ["Black Rot", "Leaf Blight (Isariopsis)", "Healthy"],
    "Pepper": ["Bacterial Spot", "Healthy"],
    "Cucumber": ["Downy Mildew", "Powdery Mildew", "Healthy"],
    "Mango": ["Anthracnose", "Healthy"],
    "Beans": ["Angular Leaf Spot", "Rust", "Healthy"],
}


@dataclass
class PredictionResult:
    disease_name: str
    confidence: float
    is_mock: bool


def _load_model():
    return None


_model = _load_model() if ML_MODE == "real" else None


def predict(crop_name: str, image_bytes: bytes) -> PredictionResult:
    if ML_MODE == "real" and _model is not None:
        raise NotImplementedError("Real model inference not yet implemented.")

    pool = _MOCK_DISEASE_POOL.get(crop_name, ["Unknown Condition", "Healthy"])
    disease_name = random.choice(pool)
    confidence = round(random.uniform(55.0, 97.0), 1)
    return PredictionResult(disease_name=disease_name, confidence=confidence, is_mock=True)


def severity_from_confidence(disease_name: str, confidence: float) -> str:
    if disease_name == "Healthy":
        return "none"
    if confidence >= 85:
        return "high"
    if confidence >= 65:
        return "medium"
    return "low"
