"""Rule-based weather -> disease risk scoring.

Explicitly a heuristic decision-support tool, not a scientifically validated
disease forecast model — the API response and UI copy must say so.
"""


def compute_risk(temperature_c: float, humidity_pct: float, rainfall_mm: float) -> dict:
    score = 0
    reasons = []

    if humidity_pct >= 80:
        score += 40
        reasons.append("high humidity")
    elif humidity_pct >= 60:
        score += 20
        reasons.append("moderate humidity")

    if rainfall_mm >= 10:
        score += 30
        reasons.append("recent/expected rainfall")
    elif rainfall_mm >= 2:
        score += 15
        reasons.append("light rainfall")

    if 20 <= temperature_c <= 30:
        score += 20
        reasons.append("temperature favorable for fungal growth")

    score = min(score, 100)

    if score >= 65:
        level = "HIGH"
    elif score >= 35:
        level = "MEDIUM"
    else:
        level = "LOW"

    reason_text = " + ".join(reasons) if reasons else "conditions are currently unfavorable for disease spread"

    return {
        "score": score,
        "level": level,
        "reason": reason_text.capitalize(),
        "disclaimer": "This is an AI-assisted estimate based on current weather patterns, not a scientifically validated forecast.",
    }
