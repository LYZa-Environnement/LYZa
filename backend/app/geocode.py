import httpx

from app.core.config import settings
from app.schemas import AddressResult


async def search_addresses(client: httpx.AsyncClient, q: str, limit: int = 5) -> list[AddressResult]:
    """Autocomplete / geocode a French address via the IGN Géoplateforme (BAN) API.

    Public, no API key. Returns [] on empty query or upstream failure rather than
    raising, so a flaky geocoder never breaks the search-as-you-type UI.
    """
    q = q.strip()
    if not q:
        return []

    try:
        response = await client.get(
            f"{settings.ban_base_url}search",
            params={"q": q, "limit": limit, "autocomplete": 1},
            timeout=settings.http_timeout_s,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return []

    results: list[AddressResult] = []
    for feature in payload.get("features", []):
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        coords = geometry.get("coordinates")
        if not coords or len(coords) != 2:
            continue
        lon, lat = coords
        results.append(
            AddressResult(
                label=props.get("label", q),
                citycode=props.get("citycode", ""),
                postcode=props.get("postcode", ""),
                city=props.get("city", ""),
                lat=lat,
                lon=lon,
                score=props.get("score", 0.0),
            )
        )
    return results
