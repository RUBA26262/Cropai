from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


class ModelUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class Prediction:
    condition_id: str
    confidence: float
    alternatives: list[dict]
    uncertain: bool
    model_version: str
    label_map_version: str
    calibration_version: str
    lesion_ratio: float | None


class ModelRegistry:
    """Loads only model packages whose manifest documents passing release gates."""

    def __init__(self, root: str):
        self.root = Path(root)
        self._cache: dict[str, tuple[dict, ort.InferenceSession, ort.InferenceSession | None]] = {}

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _load(self, crop_key: str):
        if crop_key in self._cache:
            return self._cache[crop_key]
        package = self.root / crop_key
        manifest_path = package / "manifest.json"
        classifier_path = package / "classifier.onnx"
        if not manifest_path.is_file() or not classifier_path.is_file():
            raise ModelUnavailable(f"No validated model package for {crop_key}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        metrics = manifest.get("metrics", {})
        if metrics.get("heldout_macro_f1", 0) < 0.85 or metrics.get("field_macro_f1", 0) < 0.75:
            raise ModelUnavailable("Model package does not satisfy release gates")
        if min(metrics.get("per_class_recall", {}).values(), default=0) < 0.75:
            raise ModelUnavailable("Model package fails per-class recall gate")
        if self._sha256(classifier_path) != manifest.get("classifier_sha256"):
            raise ModelUnavailable("Classifier checksum mismatch")
        classifier = ort.InferenceSession(str(classifier_path), providers=["CPUExecutionProvider"])
        segmenter_path = package / "segmenter.onnx"
        segmenter = None
        if segmenter_path.is_file():
            if self._sha256(segmenter_path) != manifest.get("segmenter_sha256"):
                raise ModelUnavailable("Segmenter checksum mismatch")
            segmenter = ort.InferenceSession(str(segmenter_path), providers=["CPUExecutionProvider"])
        self._cache[crop_key] = (manifest, classifier, segmenter)
        return self._cache[crop_key]

    @staticmethod
    def _tensor(image: Image.Image, size: int) -> np.ndarray:
        resized = image.resize((size, size), Image.Resampling.LANCZOS)
        array = np.asarray(resized, dtype=np.float32) / 255.0
        array = (array - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
        return np.transpose(array, (2, 0, 1))[None, ...].astype(np.float32)

    @staticmethod
    def _softmax(logits: np.ndarray) -> np.ndarray:
        shifted = logits - np.max(logits)
        exponent = np.exp(shifted)
        return exponent / np.sum(exponent)

    def predict(self, crop_key: str, image: Image.Image) -> Prediction:
        manifest, classifier, segmenter = self._load(crop_key)
        tensor = self._tensor(image, int(manifest.get("input_size", 384)))
        logits = classifier.run(None, {classifier.get_inputs()[0].name: tensor})[0][0]
        temperature = max(float(manifest.get("temperature", 1.0)), 0.01)
        probabilities = self._softmax(logits / temperature)
        labels: list[str] = manifest["labels"]
        ranking = np.argsort(probabilities)[::-1][:3]
        alternatives = [{"conditionId": labels[int(i)], "confidence": round(float(probabilities[i]), 4)} for i in ranking]
        confidence = float(probabilities[ranking[0]])
        threshold = float(manifest.get("confidence_threshold", 0.7))
        uncertain = confidence < threshold or labels[int(ranking[0])] == "unknown"

        lesion_ratio = None
        if segmenter is not None:
            mask_logits = segmenter.run(None, {segmenter.get_inputs()[0].name: tensor})[0]
            mask = 1.0 / (1.0 + np.exp(-mask_logits))
            lesion_ratio = round(float(np.mean(mask >= 0.5)), 4)

        return Prediction(
            condition_id=labels[int(ranking[0])], confidence=round(confidence, 4),
            alternatives=alternatives, uncertain=uncertain,
            model_version=str(manifest["model_version"]),
            label_map_version=str(manifest["label_map_version"]),
            calibration_version=str(manifest["calibration_version"]), lesion_ratio=lesion_ratio,
        )


registry = ModelRegistry(os.getenv("MODEL_ROOT", "/models"))
