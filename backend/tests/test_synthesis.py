import httpx
import pytest
import respx

from app.schemas import AddressResult
from app.synthesis import build_sensitivity_report

GEORISQUES = "https://georisques.gouv.fr/api/v1/"

ADDRESS = AddressResult(
    label="1 rue de la Paix, 75002 Paris",
    citycode="75102",
    postcode="75002",
    city="Paris",
    lat=48.8697,
    lon=2.3305,
    score=0.98,
)


def _envelope(n: int) -> dict:
    return {"data": [{"id": i} for i in range(n)], "totalElements": n}


@pytest.mark.asyncio
@respx.mock
async def test_synthesis_all_clear():
    respx.get(f"{GEORISQUES}basias").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}ssp").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}installations_classees").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}tim").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}mvt").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}cavites").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}azi").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}gaspar/catnat").mock(return_value=httpx.Response(200, json={"data": []}))
    respx.get(f"{GEORISQUES}zonage_sismique").mock(
        return_value=httpx.Response(200, json={"data": [{"zone_sismicite": 1}]})
    )
    respx.get(f"{GEORISQUES}argiles").mock(return_value=httpx.Response(200, json={"data": [{"expo": "Faible"}]}))
    respx.get(f"{GEORISQUES}radon").mock(return_value=httpx.Response(200, json={"data": [{"classe_potentiel": 1}]}))

    async with httpx.AsyncClient() as client:
        report = await build_sensitivity_report(client, ADDRESS, rayon_metres=500)

    assert report.niveau_global == "faible"
    assert {t.key for t in report.themes} == {"sols", "eau", "risques_naturels", "activites_industrielles"}
    assert all(t.niveau == "faible" for t in report.themes)
    assert all(not t.donnees_manquantes for t in report.themes)


@pytest.mark.asyncio
@respx.mock
async def test_synthesis_flags_polluted_site_as_high():
    respx.get(f"{GEORISQUES}basias").mock(return_value=httpx.Response(200, json=_envelope(2)))
    respx.get(f"{GEORISQUES}ssp").mock(return_value=httpx.Response(200, json=_envelope(1)))
    respx.get(f"{GEORISQUES}installations_classees").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}tim").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}mvt").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}cavites").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}azi").mock(return_value=httpx.Response(200, json=_envelope(0)))
    respx.get(f"{GEORISQUES}gaspar/catnat").mock(return_value=httpx.Response(200, json={"data": []}))
    respx.get(f"{GEORISQUES}zonage_sismique").mock(
        return_value=httpx.Response(200, json={"data": [{"zone_sismicite": 1}]})
    )
    respx.get(f"{GEORISQUES}argiles").mock(return_value=httpx.Response(200, json={"data": [{"expo": "Faible"}]}))
    respx.get(f"{GEORISQUES}radon").mock(return_value=httpx.Response(200, json={"data": [{"classe_potentiel": 1}]}))

    async with httpx.AsyncClient() as client:
        report = await build_sensitivity_report(client, ADDRESS, rayon_metres=500)

    sols = next(t for t in report.themes if t.key == "sols")
    assert sols.niveau == "elevee"
    assert report.niveau_global == "elevee"


@pytest.mark.asyncio
@respx.mock
async def test_synthesis_handles_upstream_failure_as_indeterminate():
    respx.get(f"{GEORISQUES}basias").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}ssp").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}installations_classees").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}tim").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}mvt").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}cavites").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}azi").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}gaspar/catnat").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}zonage_sismique").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}argiles").mock(return_value=httpx.Response(500))
    respx.get(f"{GEORISQUES}radon").mock(return_value=httpx.Response(500))

    async with httpx.AsyncClient() as client:
        report = await build_sensitivity_report(client, ADDRESS, rayon_metres=500)

    assert report.niveau_global == "indeterminee"
    for theme in report.themes:
        assert theme.niveau == "indeterminee"
        assert theme.donnees_manquantes
