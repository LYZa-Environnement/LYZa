"""Pure classification rules, isolated from any I/O.

These take counts or official classifications already extracted from a
Géorisques response and return a SensitivityLevel. Keeping them here (no
network, no async) means they can be unit-tested directly and reused later
from a pandas/geopandas batch-scoring script without touching the API layer.
"""

from app.schemas import SensitivityLevel


def level_from_count(count: int | None, seuil_moderee: int = 1, seuil_elevee: int = 4) -> SensitivityLevel:
    """Generic rule: more nearby occurrences of a risk indicator -> higher level."""
    if count is None:
        return "indeterminee"
    if count >= seuil_elevee:
        return "elevee"
    if count >= seuil_moderee:
        return "moderee"
    return "faible"


def level_from_ssp(count: int | None) -> SensitivityLevel:
    """Sites et sols pollués (ex-BASOL) are confirmed/suspected pollution cases,
    so even one nearby is treated as a high-vigilance signal."""
    if count is None:
        return "indeterminee"
    return "elevee" if count >= 1 else "faible"


def level_from_zonage_sismique(zone: int | None) -> SensitivityLevel:
    """Official seismic zoning: 1 très faible ... 5 fort."""
    if zone is None:
        return "indeterminee"
    if zone <= 2:
        return "faible"
    if zone == 3:
        return "moderee"
    return "elevee"


def level_from_argiles(exposition: str | None) -> SensitivityLevel:
    """Official retrait-gonflement des argiles exposure classes."""
    if not exposition:
        return "indeterminee"
    normalized = exposition.strip().lower()
    mapping: dict[str, SensitivityLevel] = {
        "faible": "faible",
        "moyen": "moderee",
        "moyenne": "moderee",
        "fort": "elevee",
        "forte": "elevee",
    }
    return mapping.get(normalized, "indeterminee")


def level_from_radon(classe: int | None) -> SensitivityLevel:
    """Official radon potential class: 1 (faible) to 3 (élevé)."""
    if classe is None:
        return "indeterminee"
    if classe <= 1:
        return "faible"
    if classe == 2:
        return "moderee"
    return "elevee"


def level_from_flood_signals(in_azi: bool | None, catnat_inondation_count: int | None) -> SensitivityLevel:
    """Combine 'inside a known flood-prone zone' with the history of flood-related
    catastrophe-naturelle decrees for the commune."""
    if in_azi is None and catnat_inondation_count is None:
        return "indeterminee"
    if in_azi and (catnat_inondation_count or 0) >= 1:
        return "elevee"
    if in_azi or (catnat_inondation_count or 0) >= 3:
        return "moderee"
    if catnat_inondation_count is not None and catnat_inondation_count >= 1:
        return "moderee"
    return "faible"
