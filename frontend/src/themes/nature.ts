import { formatDistance } from '../lib/geo'
import { fetchEspeces, fetchZonagesNaturels, type ZonageNaturel } from '../lib/nature'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 5000
const RAYON_ESPECES_M = 2000

const COULEURS: Record<string, string> = {
  'Natura 2000 — Directive Habitats': '#1f6b45',
  'Natura 2000 — Directive Oiseaux': '#2a9d8f',
  'ZNIEFF de type I': '#a3671a',
  'ZNIEFF de type II': '#c9a227',
  'Parc national': '#0f4c81',
  'Parc naturel régional': '#1f6bbf',
  'Réserve naturelle nationale': '#7a4bbf',
  'Réserve naturelle régionale': '#a06cd5',
}

function resume(zonage: ZonageNaturel): string {
  return zonage.inclus ? 'Le site est inclus dans ce périmètre' : situation(zonage.distanceM, zonage.direction)
}

export async function buildNature(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [zonages, especes] = await Promise.all([safe(fetchZonagesNaturels(lat, lon, RAYON_M)), safe(fetchEspeces(lat, lon, RAYON_ESPECES_M))])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  if (zonages && zonages.length > 0) {
    for (const zonage of zonages.slice(0, 30)) {
      features.push({
        kind: 'area',
        geometry: zonage.geometrie,
        label: `${zonage.categorie} — ${zonage.nom}`,
        color: COULEURS[zonage.categorie] ?? '#1f6b45',
        group: zonage.categorie,
      })
    }

    const inclus = zonages.filter((z) => z.inclus)
    // One indicator per category, showing whichever of its zones is closest —
    // a site can sit inside three overlapping designations at once.
    const parCategorie = new Map<string, ZonageNaturel>()
    for (const zonage of zonages) if (!parCategorie.has(zonage.categorie)) parCategorie.set(zonage.categorie, zonage)

    for (const [categorie, zonage] of parCategorie) {
      indicateurs.push({
        label: categorie,
        value: zonage.nom,
        situation: resume(zonage),
        detail: zonage.code ? `Code ${zonage.code}` : undefined,
        level: zonage.inclus ? 'defavorable' : zonage.distanceM < 1000 ? 'attention' : 'favorable',
        href: zonage.url ?? undefined,
      })
    }

    if (inclus.length > 0) {
      commentaire.push(
        `Le site est situé à l'intérieur de ${pluriel(inclus.length, 'périmètre')} d'inventaire ou de protection : ` +
          `${inclus.map((z) => `${z.nom} (${z.categorie.toLowerCase()})`).join(', ')}. ` +
          `Une inclusion dans un site Natura 2000 ou une réserve entraîne des obligations réglementaires — évaluation des incidences, ` +
          `régime d'autorisation spécifique — tandis qu'une ZNIEFF est un inventaire scientifique sans portée réglementaire directe, ` +
          `mais qui fonde l'appréciation d'un enjeu écologique.`,
      )
    } else {
      const proche = zonages[0]
      commentaire.push(
        `Le site n'est inclus dans aucun périmètre d'inventaire ou de protection. Le plus proche est ${proche.nom} ` +
          `(${proche.categorie.toLowerCase()}), ${situation(proche.distanceM, proche.direction)}. ` +
          `${pluriel(zonages.length, 'périmètre')} au total ${zonages.length > 1 ? 'sont recensés' : 'est recensé'} dans un rayon de ${formatDistance(RAYON_M)}.`,
      )
    }
  } else if (zonages) {
    commentaire.push(
      `Aucun périmètre d'inventaire ou de protection de la nature (Natura 2000, ZNIEFF, parc, réserve) n'est recensé dans un rayon de ` +
        `${formatDistance(RAYON_M)} autour du site.`,
    )
    indicateurs.push({ label: 'Périmètres naturels à proximité', value: 'Aucun', level: 'favorable' })
  }

  if (especes && especes.total > 0) {
    indicateurs.push({
      label: 'Observations naturalistes géolocalisées',
      value: especes.total.toLocaleString('fr-FR'),
      situation: `Dans un rayon de ${formatDistance(especes.rayonM)}`,
      detail: 'Toutes dates et tous groupes confondus, agrégées par le GBIF (dont les flux français SINP/INPN).',
      level: 'favorable',
    })
    if (especes.especes.length > 0) {
      indicateurs.push({
        label: 'Espèces les plus observées',
        value: `${especes.especes.length} espèces dominantes`,
        detail: especes.especes
          .slice(0, 8)
          .map((espece) => `${espece.nomFrancais ?? espece.nom}${espece.groupe ? ` (${espece.groupe.toLowerCase()})` : ''} — ${espece.occurrences}`)
          .join(' · '),
      })
      const groupes = [...new Set(especes.especes.map((e) => e.groupe).filter(Boolean))]
      commentaire.push(
        `${especes.total.toLocaleString('fr-FR')} observations naturalistes géolocalisées sont recensées dans un rayon de ` +
          `${formatDistance(especes.rayonM)}${groupes.length > 0 ? `, principalement ${groupes.slice(0, 3).join(', ').toLowerCase()}` : ''}. ` +
          `La densité d'observations reflète autant la pression d'observation — on observe davantage près des villes et des réserves — ` +
          `que la richesse réelle du milieu : un faible nombre ne signifie pas un site pauvre.`,
      )
    }
  } else if (especes) {
    indicateurs.push({
      label: 'Observations naturalistes géolocalisées',
      value: 'Aucune',
      situation: `Dans un rayon de ${formatDistance(RAYON_ESPECES_M)}`,
      detail: "L'absence d'observation traduit le plus souvent une absence de prospection, pas une absence de biodiversité.",
      level: 'inconnu',
    })
  }

  lacunes.push(
    "Le statut de protection des espèces (liste rouge UICN, espèces protégées nationales) n'est pas croisé ici : la détermination d'un enjeu réglementaire espèce par espèce relève d'un inventaire de terrain mené par un écologue.",
    "Les zones humides, les continuités écologiques (trame verte et bleue) et les arrêtés de protection de biotope ne disposent pas d'un service national interrogeable par adresse — ils sont cartographiés à l'échelle régionale ou départementale.",
    "Les observations naturalistes sont opportunistes : leur répartition dépend de la fréquentation par les observateurs et ne constitue pas un inventaire exhaustif.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'INPN — Inventaire national du patrimoine naturel', href: 'https://inpn.mnhn.fr/', note: 'ZNIEFF, Natura 2000, parcs et réserves' },
      { label: 'IGN API Carto — module nature', href: 'https://apicarto.ign.fr/api/doc/nature', note: 'périmètres interrogés à l’adresse' },
      { label: 'GBIF — occurrences d’espèces', href: 'https://www.gbif.org/', note: 'agrège les flux SINP/INPN français' },
    ],
  }
}
