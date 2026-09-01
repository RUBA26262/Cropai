"""Real weather via Open-Meteo (no API key required)."""
import httpx


async def get_current_weather(latitude: float, longitude: float) -> dict:
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,uv_index"
        "&timezone=auto"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    current = data.get("current", {})
    return {
        "temperature_c": current.get("temperature_2m"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "rainfall_mm": current.get("precipitation"),
        "wind_kmh": current.get("wind_speed_10m"),
        "uv_index": current.get("uv_index"),
        "condition": "Live from Open-Meteo",
    }
