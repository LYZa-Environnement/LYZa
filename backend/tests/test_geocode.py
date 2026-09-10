import httpx
import pytest
import respx

from app.core.config import settings
from app.geocode import search_addresses

BAN_SEARCH = f"{settings.ban_base_url}search"


@pytest.mark.asyncio
@respx.mock
async def test_search_addresses_parses_features():
    respx.get(BAN_SEARCH).mock(
        return_value=httpx.Response(
            200,
            json={
                "features": [
                    {
                        "geometry": {"coordinates": [2.3305, 48.8697]},
                        "properties": {
                            "label": "1 Rue de la Paix 75002 Paris",
                            "citycode": "75102",
                            "postcode": "75002",
                            "city": "Paris",
                            "score": 0.93,
                        },
                    }
                ]
            },
        )
    )
    async with httpx.AsyncClient() as client:
        results = await search_addresses(client, "1 rue de la paix paris")

    assert len(results) == 1
    assert results[0].city == "Paris"
    assert results[0].lat == 48.8697
    assert results[0].lon == 2.3305


@pytest.mark.asyncio
async def test_search_addresses_empty_query_returns_empty():
    async with httpx.AsyncClient() as client:
        assert await search_addresses(client, "   ") == []


@pytest.mark.asyncio
@respx.mock
async def test_search_addresses_upstream_failure_returns_empty():
    respx.get(BAN_SEARCH).mock(return_value=httpx.Response(500))
    async with httpx.AsyncClient() as client:
        assert await search_addresses(client, "adresse quelconque") == []
