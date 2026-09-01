# Validated model packages

Production images must mount one directory per crop key. Each directory contains:

- `classifier.onnx`
- optional `segmenter.onnx`
- `manifest.json`, generated only after evaluation passes every release gate

The service refuses to infer if artifacts are missing, checksums differ, held-out macro F1 is below 0.85, field macro F1 is below 0.75, or any class recall is below 0.75. No mock fallback exists.

Model binaries are intentionally not committed. Store approved immutable artifacts in a restricted GCS model bucket or Artifact Registry and mount/copy the approved version during deployment.
