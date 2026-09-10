from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

SensitivityLevel = Literal["faible", "moderee", "elevee", "indeterminee"]

# Worst-first ordering, used to combine several indicators into one theme level
# and several themes into one overall level.
LEVEL_ORDER: dict[SensitivityLevel, int] = {
    "indeterminee": 0,
    "faible": 1,
    "moderee": 2,
    "elevee": 3,
}

LEVEL_LABELS: dict[SensitivityLevel, str] = {
    "faible": "Faible",
    "moderee": "Modérée",
    "elevee": "Élevée",
    "indeterminee": "Non déterminée",
}


def worst_level(levels: list[SensitivityLevel]) -> SensitivityLevel:
    """Return the most severe level among several, ignoring 'indeterminee' unless it's all there is."""
    known = [l for l in levels if l != "indeterminee"]
    if not known:
        return "indeterminee"
    return max(known, key=lambda l: LEVEL_ORDER[l])


class AddressResult(BaseModel):
    label: str
    citycode: str
    postcode: str
    city: str
    lat: float
    lon: float
    score: float


class ThemeItem(BaseModel):
    label: str
    detail: str
    source: str


class ThemeSynthesis(BaseModel):
    key: str
    titre: str
    niveau: SensitivityLevel
    resume: str
    items: list[ThemeItem] = Field(default_factory=list)
    donnees_manquantes: list[str] = Field(default_factory=list)


class SensitivityReport(BaseModel):
    address: AddressResult
    rayon_metres: int
    genere_le: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    themes: list[ThemeSynthesis]
    niveau_global: SensitivityLevel
    avertissement: str = (
        "Cette synthèse s'appuie sur des données publiques (BRGM/Géorisques, IGN) "
        "recensées à proximité de l'adresse indiquée. Elle donne une première lecture "
        "des enjeux et ne remplace pas une étude réglementaire (étude de sols, avis "
        "hydrogéologique, diagnostic ICPE...)."
    )
