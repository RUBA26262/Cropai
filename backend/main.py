import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.database.session import Base, engine
import app.models  # noqa: F401 — ensures all models are registered before create_all
from app.api import auth, farms, farm_crops, crops, predictions, weather, alerts

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI-Driven Crop Disease Prediction and Management System",
    description="API for crop disease detection, farm management, weather-based risk, and alerts.",
    version="0.1.0",
)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(farm_crops.router)
app.include_router(crops.router)
app.include_router(predictions.router)
app.include_router(weather.router)
app.include_router(alerts.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "crop-disease-api"}
