from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title="LYZa — API carte de sensibilité environnementale",
    description="Géocodage et synthèse de sensibilité environnementale à partir de données publiques (BRGM/Géorisques, IGN).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(router)
