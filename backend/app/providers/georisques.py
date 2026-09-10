"""Client for the public Géorisques API (BRGM) — https://www.georisques.gouv.fr/doc-api

No API key required. Every method returns ``None`` on any network/parsing
failure instead of raising: one upstream indicator being unavailable should
never take down the whole synthesis, it should just show up as
"donnée indisponible" for that theme.

Endpoint paths and parameter names below follow the documented v1 API; verify
against the live docs after deployment since this was built in a sandbox with
no outbound access to georisques.gouv.fr to smoke-test against.
"""

import httpx

from app.core.config import settings


def _latlon(lat: float, lon: float) -> str:
    return f"{lon},{lat}"


def _count(payload: dict | list | None) -> int | None:
    """Géorisques list endpoints wrap results in an envelope; be liberal in
    what we accept since the exact shape can vary between endpoints."""
    if payload is None:
        return None
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict):
        if isinstance(payload.get("totalElements"), int):
            return payload["totalElements"]
        data = payload.get("data")
        if isinstance(data, list):
            return len(data)
    return None


def _first_field(payload: dict | list | None, *candidate_keys: str) -> object | None:
    items = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(items, list) or not items:
        return None
    first = items[0]
    if not isinstance(first, dict):
        return None
    for key in candidate_keys:
        if key in first and first[key] is not None:
            return first[key]
    return None


class GeorisquesClient:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def _get(self, path: str, params: dict) -> dict | list | None:
        try:
            response = await self._client.get(
                f"{settings.georisques_base_url}{path}",
                params=params,
                timeout=settings.http_timeout_s,
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError):
            return None

    async def count_basias(self, lat: float, lon: float, rayon: int) -> int | None:
        """Anciens sites industriels et activités de service (BASIAS)."""
        payload = await self._get("basias", {"latlon": _latlon(lat, lon), "rayon": rayon})
        return _count(payload)

    async def count_ssp(self, lat: float, lon: float, rayon: int) -> int | None:
        """Sites et sols pollués, ou potentiellement pollués (ex-BASOL)."""
        payload = await self._get("ssp", {"latlon": _latlon(lat, lon), "rayon": rayon})
        return _count(payload)

    async def count_icpe(self, lat: float, lon: float, rayon: int) -> int | None:
        """Installations classées pour la protection de l'environnement."""
        payload = await self._get("installations_classees", {"latlon": _latlon(lat, lon), "rayon": rayon})
        return _count(payload)

    async def count_tim(self, lat: float, lon: float, rayon: int) -> int | None:
        """Canalisations de transport de matières dangereuses."""
        payload = await self._get("tim", {"latlon": _latlon(lat, lon), "rayon": rayon})
        return _count(payload)

    async def count_mvt(self, lat: float, lon: float, rayon: int) -> int | None:
        """Mouvements de terrain recensés."""
        payload = await self._get("mvt", {"latlon": _latlon(lat, lon), "rayon": rayon})
        return _count(payload)

    async def count_cavites(self, lat: float, lon: float, rayon: int) -> int | None:
        """Cavités souterraines recensées."""
        payload = await self._get("cavites", {"latlon": _latlon(lat, lon), "rayon": rayon})
        return _count(payload)

    async def in_azi(self, lat: float, lon: float, rayon: int) -> bool | None:
        """Atlas des zones inondables — y a-t-il une zone recensée à proximité ?"""
        payload = await self._get("azi", {"latlon": _latlon(lat, lon), "rayon": rayon})
        count = _count(payload)
        return None if count is None else count > 0

    async def catnat_inondation_count(self, code_insee: str) -> int | None:
        """Arrêtés de catastrophe naturelle liés aux inondations sur la commune."""
        payload = await self._get("gaspar/catnat", {"code_insee": code_insee})
        items = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(items, list):
            return None
        return sum(
            1
            for item in items
            if isinstance(item, dict) and "inond" in str(item.get("libelle_risque_jo", "")).lower()
        )

    async def zonage_sismique(self, code_insee: str) -> int | None:
        payload = await self._get("zonage_sismique", {"code_insee": code_insee})
        value = _first_field(payload, "zone_sismicite", "code_zone")
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    async def argiles_exposition(self, code_insee: str) -> str | None:
        payload = await self._get("argiles", {"code_insee": code_insee})
        value = _first_field(payload, "expo", "alea", "exposition")
        return str(value) if value is not None else None

    async def radon_classe(self, code_insee: str) -> int | None:
        payload = await self._get("radon", {"code_insee": code_insee})
        value = _first_field(payload, "classe_potentiel", "classe")
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
