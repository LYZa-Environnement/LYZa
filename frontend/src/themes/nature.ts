import { formatDistance } from '../lib/geo'
import { fetchEspeces, fetchZonagesNaturels, type ZonageNaturel } from '../lib/nature'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 5000
const RAYON_ESPECES_M = 2000
/** Zones are listed individually; past this the list stops being readable. */
const MAX_ZONES_DETAILLEES = 14

const COULEURS: Record<string, string> = {
  'Natura 2000 — Directive Habitats': '#1f6b45',
  'Natura 2000 — Directive Oiseaux': '#2a9d8f',
  'Zone naturelle d’intérêt écologique (ZNIEFF) de type I': '#a3671a',
  'Zone naturelle d’intérêt écologique (ZNIEFF) de type II': '#c9a227',
  'Parc national': '#0f4c81',
  'Parc naturel régional': '#1f6bbf',
  'Réserve naturelle nationale': '#7a4bbf',
  'Réserve naturelle régionale': '#a06cd5',
}

/** What the designation actually obliges, in one line — the difference
 * between an inventory and an opposable protection is the single most useful
 * thing to know about a zone. */
const PORTEE: Record<string, string> = {
  'Natura 2000 — Directive Habitats': 'Protection européenne : évaluation des incidences obligatoire pour tout projet susceptible d’affecter le site.',
  'Natura 2000 — Directive Oiseaux': 'Protection européenne : évaluation des incidences obligatoire pour tout projet susceptible d’affecter le site.',
  'Zone naturelle d’intérêt écologique (ZNIEFF) de type I': 'Inventaire scientifique de la faune et de la flore, sans portée réglementaire directe — secteur de forte valeur biologique, opposable via l’erreur manifeste d’appréciation.',
  'Zone naturelle d’intérêt écologique (ZNIEFF) de type II': 'Inventaire scientifique de la faune et de la flore, sans portée réglementaire directe — grand ensemble naturel cohérent.',
  'Parc national': 'Réglementation propre, très contraignante en cœur de parc.',
  'Parc naturel régional': 'Charte opposable aux documents d’urbanisme.',
  'Réserve naturelle nationale': 'Réglementation stricte fixée par décret.',
  'Réserve naturelle régionale': 'Réglementation fixée par délibération régionale.',
}

function anneeDe(date: string | null): string | null {
  if (!date) return null
  const annee = date.slice(0, 4)
  return /^\d{4}$/.test(annee) ? annee : null
}

function detailZonage(zonage: ZonageNaturel): string {
  return [
    zonage.surfaceHa !== null ? `${Math.round(zonage.surfaceHa).toLocaleString('fr-FR')} ha` : null,
    anneeDe(zonage.dateCreation) ? `créée en ${anneeDe(zonage.dateCreation)}` : null,
    zonage.marin ? 'zone marine' : null,
    zonage.code ? `réf. ${zonage.code}` : null,
    zonage.gestionnaire,
    PORTEE[zonage.categorie],
  ]
    .filter(Boolean)
    .join(' — ')
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

    // One line per zone, nearest first, rather than one line per category:
    // a reader needs to know which zone, how big, since when, and what the
    // designation obliges — not just that "a ZNIEFF exists somewhere".
    indicateurs.push({
      label: "Périmètres d'inventaire et de protection de la nature",
      value: pluriel(zonages.length, 'périmètre'),
      situation: `Dans un rayon de ${formatDistance(RAYON_M)}`,
      detail:
        inclus.length > 0
          ? `Le site est inclus dans ${inclus.length === 1 ? "l'un d'eux" : `${inclus.length} d'entre eux`}.`
          : `Le site n'est inclus dans aucun d'eux ; le plus proche est ${zonages[0].nom}.`,
      level: inclus.length > 0 ? 'defavorable' : zonages[0].distanceM < 1000 ? 'attention' : 'favorable',
    })

    for (const zonage of zonages.slice(0, MAX_ZONES_DETAILLEES)) {
      indicateurs.push({
        pliable: 'Détail des périmètres',
        label: zonage.nom,
        value: zonage.categorie,
        situation: zonage.inclus ? 'Le site est inclus dans ce périmètre' : situation(zonage.distanceM, zonage.direction),
        detail: detailZonage(zonage),
        level: zonage.inclus ? 'defavorable' : zonage.distanceM < 1000 ? 'attention' : 'favorable',
        href: zonage.url ?? undefined,
      })
    }

    if (inclus.length > 0) {
      commentaire.push(
        `Le site est situé à l'intérieur de ${pluriel(inclus.length, 'périmètre')} d'inventaire ou de protection : ` +
          `${inclus.map((z) => `${z.nom} (${z.categorie.toLowerCase()})`).join(', ')}. ` +
          `Une inclusion dans un site Natura 2000 ou une réserve entraîne des obligations réglementaires — évaluation des incidences, ` +
          `régime d'autorisation spécifique — tandis qu'une zone naturelle d'intérêt écologique (ZNIEFF) est un inventaire scientifique sans portée réglementaire directe, ` +
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
      `Aucun périmètre d'inventaire ou de protection de la nature (Natura 2000, zone naturelle d'intérêt écologique, parc, réserve) n'est recensé dans un rayon de ` +
        `${formatDistance(RAYON_M)} autour du site.`,
    )
    indicateurs.push({
      label: 'Périmètres naturels à proximité',
      value: 'Aucun',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_M)}`,
      level: 'favorable',
    })
  }

  if (especes && especes.total > 0) {
    indicateurs.push({
      label: 'Observations naturalistes géolocalisées',
      value: especes.total.toLocaleString('fr-FR'),
      situation: `Dans un rayon de ${formatDistance(especes.rayonM)}`,
      detail: 'Toutes dates et tous groupes confondus, agrégées par le système mondial d’information sur la biodiversité (GBIF), dont les observations françaises.',
      level: 'favorable',
    })

    // Each dominant species on its own line, with its French name, its group
    // and how many times it has been recorded.
    for (const espece of especes.especes) {
      indicateurs.push({
        pliable: 'Détail des espèces les plus observées',
        label: espece.nomFrancais ?? espece.nom,
        value: `${espece.occurrences.toLocaleString('fr-FR')} observations`,
        situation: espece.groupe ?? undefined,
        detail: espece.nomFrancais ? espece.nom : undefined,
        href: `https://www.gbif.org/species/search?q=${encodeURIComponent(espece.nom)}`,
      })
    }

    const groupes = [...new Set(especes.especes.map((e) => e.groupe).filter(Boolean))]
    commentaire.push(
      `${especes.total.toLocaleString('fr-FR')} observations naturalistes géolocalisées sont recensées dans un rayon de ` +
        `${formatDistance(especes.rayonM)}${groupes.length > 0 ? `, principalement ${groupes.slice(0, 3).join(', ').toLowerCase()}` : ''}. ` +
        `La densité d'observations reflète autant la pression d'observation — on observe davantage près des villes et des réserves — ` +
        `que la richesse réelle du milieu : un faible nombre ne signifie pas un site pauvre.`,
    )
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
    "Les espèces listées sont celles le plus souvent observées aux alentours, pas les espèces déterminantes des zonages : la liste des espèces ayant justifié le classement d'une zone naturelle d'intérêt écologique ou d'un site Natura 2000 n'est pas exposée par une API ouverte et se consulte sur la fiche de l’Inventaire national du patrimoine naturel (INPN) du site.",
    "Le statut de protection des espèces (liste rouge de l’Union internationale pour la conservation de la nature, espèces protégées nationales) n'est pas croisé ici : la détermination d'un enjeu réglementaire espèce par espèce relève d'un inventaire de terrain mené par un écologue.",
    "Les zones humides, les continuités écologiques (trame verte et bleue) et les arrêtés de protection de biotope ne disposent pas d'un service national interrogeable par adresse.",
    'Les observations naturalistes sont opportunistes : leur répartition dépend de la fréquentation par les observateurs et ne constitue pas un inventaire exhaustif.',
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Inventaire national du patrimoine naturel (Muséum national d’histoire naturelle)', href: 'https://inpn.mnhn.fr/', note: 'zones naturelles d’intérêt écologique, Natura 2000, parcs et réserves' },
      { label: 'API Carto de l’Institut national de l’information géographique et forestière (IGN) — module nature', href: 'https://apicarto.ign.fr/api/doc/nature', note: 'périmètres interrogés à l’adresse' },
      { label: 'GBIF — système mondial d’information sur la biodiversité', href: 'https://www.gbif.org/', note: 'agrège notamment les observations françaises du système d’information sur la nature et les paysages' },
    ],
  }
}
