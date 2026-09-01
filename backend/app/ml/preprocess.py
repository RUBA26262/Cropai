"""Basic image quality checks, run before any prediction call.

Heuristic checks only (blur via Laplacian variance, brightness via mean
pixel value) — good enough to reject obviously bad photos, not a substitute
for a trained quality-classifier.
"""
import cv2
import numpy as np
from PIL import Image
import io


def check_image_quality(image_bytes: bytes) -> tuple[bool, str | None]:
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return False, "Invalid image file. Please upload a JPG or PNG."

    img = np.array(pil_img)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    if blur_score < 30:
        return False, "Image appears blurry. Please hold the camera steady and refocus on the leaf."

    mean_brightness = gray.mean()
    if mean_brightness < 40:
        return False, "Image is too dark. Please take the photo in better lighting."
    if mean_brightness > 235:
        return False, "Image is overexposed. Please avoid direct glare or flash."

    w, h = pil_img.size
    if w < 200 or h < 200:
        return False, "Image resolution is too low. Please upload a clearer, higher-resolution photo."

    return True, None
