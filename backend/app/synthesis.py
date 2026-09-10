import asyncio

import httpx

from app.providers.georisques import GeorisquesClient
from app.rules import (
    level_from_argiles,
    level_from_count,
    level_from_flood_signals,
    level_from_radon,
    level_from_ssp,
    level_from_zonage_sismique,
)
from app.schemas import AddressResult, SensitivityReport, ThemeItem, ThemeSynthesis, worst_level


async def build_sensitivity_report(
    client: httpx.AsyncClient, address: AddressResult, rayon_metres: int
) -> SensitivityReport:
    georisques = GeorisquesClient(client)
    lat, lon, code_insee = address.lat, address.lon, address.citycode

    (
        basias_count,
        ssp_count,
        icpe_count,
        tim_count,
        mvt_count,
        cavites_count,
        in_azi,
        catnat_inondation,
        zone_sismique,
        argiles_expo,
        radon_classe,
    ) = await asyncio.gather(
        georisques.count_basias(lat, lon, rayon_metres),
        georisques.count_ssp(lat, lon, rayon_metres),
        georisques.count_icpe(lat, lon, rayon_metres),
        georisques.count_tim(lat, lon, rayon_metres),
        georisques.count_mvt(lat, lon, rayon_metres),
        georisques.count_cavites(lat, lon, rayon_metres),
        georisques.in_azi(lat, lon, rayon_metres),
        georisques.catnat_inondation_count(code_insee) if code_insee else _none(),
        georisques.zonage_sismique(code_insee) if code_insee else _none(),
        georisques.argiles_exposition(code_insee) if code_insee else _none(),
        georisques.radon_classe(code_insee) if code_insee else _none(),
    )

    themes = [
        _theme_sols(basias_count, ssp_count),
        _theme_eau(in_azi, catnat_inondation),
        _theme_risques_naturels(mvt_count, cavites_count, zone_sismique, argiles_expo, radon_classe),
        _theme_activites_industrielles(icpe_count, tim_count),
    ]

    return SensitivityReport(
        address=address,
        rayon_metres=rayon_metres,
        themes=themes,
        niveau_global=worst_level([t.niveau for t in themes]),
    )


async def _none():
    return None


def _theme_sols(basias_count: int | None, ssp_count: int | None) -> ThemeSynthesis:
    niveau = worst_level([level_from_count(basias_count, seuil_moderee=1, seuil_elevee=4), level_from_ssp(ssp_count)])
    items: list[ThemeItem] = []
    manquantes: list[str] = []

    if basias_count is None:
        manquantes.append("anciens sites industriels (BASIAS)")
    else:
        items.append(
            ThemeItem(
                label="Anciens sites industriels ou d'activité de service",
                detail=f"{basias_count} site(s) recensé(s) à proximité" if basias_count else "Aucun site recensé à proximité",
                source="BASIAS — BRGM/Géorisques",
            )
        )
    if ssp_count is None:
        manquantes.append("sites et sols pollués (ex-BASOL)")
    else:
        items.append(
            ThemeItem(
                label="Sites et sols pollués, ou potentiellement pollués",
                detail=f"{ssp_count} site(s) recensé(s) à proximité" if ssp_count else "Aucun site recensé à proximité",
                source="SSP (ex-BASOL) — BRGM/Géorisques",
            )
        )

    resume = _resume_sols(niveau, basias_count, ssp_count)
    return ThemeSynthesis(key="sols", titre="Sols", niveau=niveau, resume=resume, items=items, donnees_manquantes=manquantes)


def _resume_sols(niveau, basias_count, ssp_count) -> str:
    if niveau == "indeterminee":
        return "Les bases de données sur les sols n'ont pas pu être interrogées."
    if ssp_count:
        return "Un ou plusieurs sites pollués ou potentiellement pollués sont recensés à proximité immédiate."
    if basias_count:
        return "Le secteur a accueilli une ou plusieurs activités industrielles ou de service par le passé, sans pollution confirmée à ce stade."
    return "Aucun site industriel ancien ni sol pollué n'est recensé à proximité dans les bases publiques."


def _theme_eau(in_azi: bool | None, catnat_inondation: int | None) -> ThemeSynthesis:
    niveau = level_from_flood_signals(in_azi, catnat_inondation)
    items: list[ThemeItem] = []
    manquantes: list[str] = []

    if in_azi is None:
        manquantes.append("zones inondables (AZI)")
    else:
        items.append(
            ThemeItem(
                label="Zone inondable recensée",
                detail="Le secteur recoupe une zone inondable connue" if in_azi else "Aucune zone inondable recensée à proximité",
                source="Atlas des zones inondables — Géorisques",
            )
        )
    if catnat_inondation is None:
        manquantes.append("arrêtés catastrophe naturelle (inondation)")
    else:
        items.append(
            ThemeItem(
                label="Historique catastrophe naturelle — inondation",
                detail=f"{catnat_inondation} arrêté(s) pris pour la commune" if catnat_inondation else "Aucun arrêté recensé pour la commune",
                source="GASPAR — Géorisques",
            )
        )

    if niveau == "indeterminee":
        resume = "Les indicateurs liés à l'eau n'ont pas pu être interrogés."
    elif niveau == "elevee":
        resume = "Le secteur est en zone inondable connue et la commune a déjà fait l'objet d'arrêtés catastrophe naturelle pour inondation."
    elif niveau == "moderee":
        resume = "Un signal lié au risque inondation existe (zone recensée ou antécédents communaux) : un avis hydrogéologique permettrait de préciser l'enjeu."
    else:
        resume = "Aucun signal notable lié au risque inondation n'est recensé à proximité dans les bases publiques consultées."

    return ThemeSynthesis(key="eau", titre="Eau", niveau=niveau, resume=resume, items=items, donnees_manquantes=manquantes)


def _theme_risques_naturels(
    mvt_count: int | None,
    cavites_count: int | None,
    zone_sismique: int | None,
    argiles_expo: str | None,
    radon_classe: int | None,
) -> ThemeSynthesis:
    niveaux = [
        level_from_count(mvt_count, seuil_moderee=1, seuil_elevee=3),
        level_from_count(cavites_count, seuil_moderee=1, seuil_elevee=3),
        level_from_zonage_sismique(zone_sismique),
        level_from_argiles(argiles_expo),
        level_from_radon(radon_classe),
    ]
    niveau = worst_level(niveaux)

    items: list[ThemeItem] = []
    manquantes: list[str] = []

    def add(value, label, detail_fn, source, missing_label):
        if value is None:
            manquantes.append(missing_label)
        else:
            items.append(ThemeItem(label=label, detail=detail_fn(value), source=source))

    add(mvt_count, "Mouvements de terrain recensés", lambda v: f"{v} évènement(s) recensé(s) à proximité" if v else "Aucun évènement recensé à proximité", "BRGM/Géorisques", "mouvements de terrain")
    add(cavites_count, "Cavités souterraines recensées", lambda v: f"{v} cavité(s) recensée(s) à proximité" if v else "Aucune cavité recensée à proximité", "BRGM/Géorisques", "cavités souterraines")
    add(zone_sismique, "Zonage sismique réglementaire", lambda v: f"Zone {v} sur l'échelle réglementaire (1 très faible à 5 fort)", "Géorisques", "zonage sismique")
    add(argiles_expo, "Retrait-gonflement des argiles", lambda v: f"Exposition {v.lower()}", "Géorisques", "retrait-gonflement des argiles")
    add(radon_classe, "Potentiel radon", lambda v: f"Classe {v} sur l'échelle réglementaire (1 à 3)", "Géorisques", "potentiel radon")

    if niveau == "indeterminee":
        resume = "Les indicateurs de risques naturels n'ont pas pu être interrogés."
    elif niveau == "elevee":
        resume = "Un ou plusieurs indicateurs de risques naturels (mouvements de terrain, sismicité, argiles ou radon) atteignent un niveau élevé sur le secteur."
    elif niveau == "moderee":
        resume = "Le secteur présente un ou plusieurs indicateurs de risques naturels à surveiller, sans signal alarmant à ce stade."
    else:
        resume = "Les indicateurs de risques naturels consultés sont globalement favorables sur le secteur."

    return ThemeSynthesis(
        key="risques_naturels", titre="Risques naturels", niveau=niveau, resume=resume, items=items, donnees_manquantes=manquantes
    )


def _theme_activites_industrielles(icpe_count: int | None, tim_count: int | None) -> ThemeSynthesis:
    niveau = worst_level(
        [
            level_from_count(icpe_count, seuil_moderee=1, seuil_elevee=3),
            level_from_count(tim_count, seuil_moderee=1, seuil_elevee=2),
        ]
    )
    items: list[ThemeItem] = []
    manquantes: list[str] = []

    if icpe_count is None:
        manquantes.append("installations classées (ICPE)")
    else:
        items.append(
            ThemeItem(
                label="Installations classées pour la protection de l'environnement",
                detail=f"{icpe_count} installation(s) recensée(s) à proximité" if icpe_count else "Aucune installation recensée à proximité",
                source="ICPE — Géorisques",
            )
        )
    if tim_count is None:
        manquantes.append("canalisations de transport de matières dangereuses")
    else:
        items.append(
            ThemeItem(
                label="Transport de matières dangereuses par canalisation",
                detail=f"{tim_count} canalisation(s) recensée(s) à proximité" if tim_count else "Aucune canalisation recensée à proximité",
                source="TIM — Géorisques",
            )
        )

    if niveau == "indeterminee":
        resume = "Les indicateurs d'activités industrielles n'ont pas pu être interrogés."
    elif niveau == "elevee":
        resume = "Plusieurs installations classées ou canalisations de matières dangereuses sont recensées à proximité immédiate."
    elif niveau == "moderee":
        resume = "Une ou plusieurs installations classées sont recensées à proximité, sans concentration particulière."
    else:
        resume = "Aucune installation classée ni canalisation à risque n'est recensée à proximité dans les bases publiques."

    return ThemeSynthesis(
        key="activites_industrielles", titre="Activités industrielles", niveau=niveau, resume=resume, items=items, donnees_manquantes=manquantes
    )
