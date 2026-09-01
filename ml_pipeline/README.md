# CropAI model pipeline

This directory defines the data contract and release gates for six crop-specific EfficientNetV2-S classifiers. It deliberately contains no downloaded dataset or model weights.

## Required workflow

1. Review every dataset license and set `allowedForTraining` only after evidence is saved in the dataset manifest.
2. Build `records.csv` with capture-group IDs. Near-duplicates and images from one plant/session must stay in one split.
3. Keep the consented Maharashtra field-validation split isolated from training and hyperparameter selection.
4. Train each crop specialist, fit temperature scaling on validation data, evaluate unknown/out-of-distribution rejection, and export `classifier.onnx`.
5. Export an independently evaluated lesion segmenter where mask annotations exist. Without it, the product labels severity as questionnaire-based preliminary severity.
6. Generate `manifest.json` with metrics, versions and SHA-256 hashes.
7. Run `python validate_release.py artifacts/<crop>` before packaging. Cloud Run repeats the essential metric/checksum checks at load time.

The production service has no random or demo fallback. Missing or underperforming artifacts result in `VALIDATED_MODEL_UNAVAILABLE`.
