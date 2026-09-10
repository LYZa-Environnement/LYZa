import httpx
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.geocode import search_addresses
from app.schemas import AddressResult, SensitivityReport
from app.synthesis import build_sensitivity_report

router = APIRouter(prefix="/api")


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/geocode", response_model=list[AddressResult])
async def geocode(q: str = Query(..., min_length=3, max_length=200)) -> list[AddressResult]:
    async with httpx.AsyncClient() as client:
        return await search_addresses(client, q)


@router.get("/sensitivity", response_model=SensitivityReport)
async def sensitivity(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    label: str = Query(..., min_length=1, max_length=300),
    citycode: str = Query(""),
    postcode: str = Query(""),
    city: str = Query(""),
    rayon: int = Query(default=settings.default_radius_m, ge=50, le=settings.max_radius_m),
) -> SensitivityReport:
    if not citycode:
        raise HTTPException(status_code=422, detail="citycode is required to query commune-level indicators")

    address = AddressResult(label=label, citycode=citycode, postcode=postcode, city=city, lat=lat, lon=lon, score=1.0)
    async with httpx.AsyncClient() as client:
        return await build_sensitivity_report(client, address, rayon)
