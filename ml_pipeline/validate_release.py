"""Fail a model release unless provenance, checksums, and metric gates pass."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate(package: Path) -> list[str]:
    errors: list[str] = []
    manifest_file = package / "manifest.json"
    classifier = package / "classifier.onnx"
    if not manifest_file.is_file() or not classifier.is_file():
        return ["manifest.json and classifier.onnx are required"]
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    required = {"model_version", "label_map_version", "calibration_version", "labels", "metrics", "classifier_sha256", "dataset_manifest_sha256"}
    missing = required - manifest.keys()
    if missing:
        errors.append(f"Missing manifest fields: {sorted(missing)}")
    metrics = manifest.get("metrics", {})
    if metrics.get("heldout_macro_f1", 0) < 0.85:
        errors.append("heldout_macro_f1 must be >= 0.85")
    if metrics.get("field_macro_f1", 0) < 0.75:
        errors.append("field_macro_f1 must be >= 0.75")
    recalls = metrics.get("per_class_recall", {})
    if not recalls or min(recalls.values()) < 0.75:
        errors.append("every class recall must be >= 0.75")
    if manifest.get("classifier_sha256") != sha256(classifier):
        errors.append("classifier checksum mismatch")
    dataset_manifest = package / "dataset_manifest.json"
    if not dataset_manifest.is_file() or manifest.get("dataset_manifest_sha256") != sha256(dataset_manifest):
        errors.append("dataset manifest missing or checksum mismatch")
    else:
        provenance = json.loads(dataset_manifest.read_text(encoding="utf-8"))
        if any(not source.get("allowedForTraining") or not source.get("licenseEvidence") for source in provenance.get("sources", [])):
            errors.append("every dataset source needs verified license evidence and training approval")
    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    args = parser.parse_args()
    failures = validate(args.package)
    if failures:
        print("RELEASE BLOCKED", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        raise SystemExit(1)
    print("Release gates passed")
