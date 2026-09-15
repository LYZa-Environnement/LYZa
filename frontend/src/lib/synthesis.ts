import { cardinalPhraseFr, formatDistance } from './geo'
import * as georisques from './georisques'
import { surveyNearbyParcels, type ParcelSurvey } from './parcelles'
import { levelFromArgiles, levelFromCount, levelFromFloodSignals, levelFromRadon, levelFromSsp, levelFromZonageSismique, worstLevel } from './rules'
import type { AddressResult, SensitivityLevel, SensitivityReport, ThemeItem, ThemeSynthesis } from '../types/sensitivity'

function describeLocalisation(loc: georisques.Localisation | null): string | null {
  return loc ? `à ${formatDistance(loc.distanceM)} ${cardinalPhraseFr(loc.direction)} du site` : null
}

const AVERTISSEMENT =
  "Cette synthèse s'appuie sur des données publiques (BRGM/Géorisques, IGN) " +
  "recensées à proximité de l'adresse indiquée. Elle donne une première lecture " +
  "des enjeux et ne remplace pas une étude réglementaire (étude de sols, avis " +
  'hydrogéologique, diagnostic ICPE...).'

// Cap on how many individual items (ICPE, CASIAS...) are listed per theme —
// enough to be useful, not enough to turn the page into a raw data dump.
const MAX_LISTED = 6

export async function buildSensitivityReport(address: AddressResult, rayonMetres: number): Promise<SensitivityReport> {
  const { lat, lon, citycode } = address

  const [icpeResult, sspResult, timCount, mvtResult, cavitesResult, inAziResult, catnatItems, zoneSismique, argilesExpo, radonClasseResult, parcelSurvey] =
    await Promise.all([
      georisques.fetchIcpe(lat, lon, rayonMetres),
      georisques.fetchSsp(lat, lon, rayonMetres),
      georisques.countTim(lat, lon, rayonMetres),
      georisques.fetchMvt(lat, lon, rayonMetres),
      georisques.fetchCavites(lat, lon, rayonMetres),
      georisques.inAzi(lat, lon, rayonMetres),
      citycode ? georisques.fetchCatnatInondation(citycode) : Promise.resolve(null),
      citycode ? georisques.zonageSismique(citycode) : Promise.resolve(null),
      citycode ? georisques.argilesExposition(citycode) : Promise.resolve(null),
      citycode ? georisques.radonClasse(citycode) : Promise.resolve(null),
      surveyNearbyParcels(lat, lon),
    ])

  const themes: ThemeSynthesis[] = [
    themeRisquesNaturels(inAziResult, catnatItems, mvtResult, cavitesResult, zoneSismique, argilesExpo, radonClasseResult, parcelSurvey, citycode),
    themeRisquesIndustriels(sspResult, icpeResult, timCount, citycode),
  ]

  return {
    address,
    rayon_metres: rayonMetres,
    genere_le: new Date().toISOString(),
    themes,
    niveau_global: worstLevel(themes.map((t) => t.niveau)),
    avertissement: AVERTISSEMENT,
  }
}

function formatDateFr(value: string | null): string | null {
  if (!value) return null
  const date = georisques.parseFrenchDate(value)
  return date ? date.toLocaleDateString('fr-FR') : value
}

const ZONAGE_SISMIQUE_LABELS: Record<number, string> = {
  1: 'très faible',
  2: 'faible',
  3: 'modérée',
  4: 'moyenne',
  5: 'forte',
}

const ARGILES_DESCRIPTIONS: Record<string, string> = {
  faible: "un phénomène de retrait-gonflement possible mais peu probable, sans mesure constructive particulière requise pour les bâtiments courants",
  moyen:
    'une probabilité de survenance du phénomène significative — des dispositions constructives (fondations, joints de rupture...) sont en général recommandées pour un projet neuf',
  moyenne:
    'une probabilité de survenance du phénomène significative — des dispositions constructives (fondations, joints de rupture...) sont en général recommandées pour un projet neuf',
  fort: 'une probabilité de survenance du phénomène élevée — une étude géotechnique préalable est fortement recommandée pour tout projet de construction',
  forte: 'une probabilité de survenance du phénomène élevée — une étude géotechnique préalable est fortement recommandée pour tout projet de construction',
}

const RADON_DESCRIPTIONS: Record<number, string> = {
  1: 'un potentiel faible : les teneurs en uranium des sous-sols sont basses',
  2: 'un potentiel faible à moyen, avec des facteurs géologiques pouvant faciliter le transfert du radon vers le bâti',
  3: 'un potentiel significatif : des mesures de prévention (ventilation, étanchéité des points d’entrée) sont recommandées pour le bâti',
}

/** "Risques naturels" — tout ce qui menace le site du fait du milieu
 * environnant : inondation/coulée de boue, mouvements de terrain, cavités,
 * sismicité, argiles, radon, et l'usage de produits phytosanitaires sur les
 * parcelles agricoles voisines. */
function themeRisquesNaturels(
  inAziValue: boolean | null,
  catnatItems: georisques.CatnatItem[] | null,
  mvt: georisques.ListResult<georisques.MvtItem> | null,
  cavites: georisques.ListResult<georisques.CaviteItem> | null,
  zoneSismique: number | null,
  argilesExpo: string | null,
  radonClasseValue: number | null,
  parcelSurvey: ParcelSurvey | null,
  citycode: string,
): ThemeSynthesis {
  const catnatCount = catnatItems?.length ?? null
  const niveaux: SensitivityLevel[] = [
    levelFromFloodSignals(inAziValue, catnatCount),
    levelFromCount(mvt?.total ?? null, 2, 6),
    levelFromCount(cavites?.total ?? null, 2, 6),
    levelFromZonageSismique(zoneSismique),
    levelFromArgiles(argilesExpo),
    levelFromRadon(radonClasseValue),
  ]
  const niveau = worstLevel(niveaux)
  const items: ThemeItem[] = []
  const manquantes: string[] = []

  if (inAziValue === null) {
    manquantes.push('zones inondables (AZI)')
  } else {
    items.push({
      label: 'Zone inondable recensée',
      detail: inAziValue ? 'Le secteur recoupe une zone inondable connue' : 'Aucune zone inondable recensée à proximité',
      source: 'Atlas des zones inondables — Géorisques',
    })
  }

  if (catnatItems === null) {
    manquantes.push('arrêtés catastrophe naturelle (inondation)')
  } else if (catnatItems.length === 0) {
    items.push({ label: 'Historique catastrophe naturelle — inondation', detail: 'Aucun arrêté recensé pour la commune', source: 'GASPAR — Géorisques' })
  } else {
    const shown = catnatItems.slice(0, MAX_LISTED)
    shown.forEach((arrete) => {
      const datePublication = arrete.datePublicationJo ?? arrete.datePublicationArrete
      const dates = [
        arrete.dateDebut && arrete.dateFin ? `évènement du ${formatDateFr(arrete.dateDebut)} au ${formatDateFr(arrete.dateFin)}` : null,
        datePublication ? `publié au Journal officiel le ${formatDateFr(datePublication)}` : null,
        arrete.codeNational ? `réf. ${arrete.codeNational}` : null,
      ].filter(Boolean)
      items.push({
        label: arrete.libelle,
        detail: dates.join(' — ') || 'Arrêté de catastrophe naturelle',
        source: 'GASPAR — Géorisques',
      })
    })
    if (catnatItems.length > shown.length) {
      items.push({ label: `+ ${catnatItems.length - shown.length} autre(s) arrêté(s)`, detail: '', source: 'GASPAR — Géorisques' })
    }
  }

  if (mvt === null) {
    manquantes.push('mouvements de terrain')
  } else if (mvt.items.length === 0) {
    items.push({ label: 'Mouvements de terrain recensés', detail: 'Aucun évènement recensé à proximité', source: 'BRGM/Géorisques' })
  } else {
    const shown = mvt.items.slice(0, MAX_LISTED)
    shown.forEach((m) =>
      items.push({
        label: m.type,
        detail: [m.lieu, m.dateDebut ? `daté du ${formatDateFr(m.dateDebut)}` : null, describeLocalisation(m.localisation)].filter(Boolean).join(' — '),
        source: 'BRGM/Géorisques',
      }),
    )
    if (mvt.total > shown.length) {
      items.push({ label: `+ ${mvt.total - shown.length} autre(s) évènement(s)`, detail: '', source: 'BRGM/Géorisques' })
    }
  }

  if (cavites === null) {
    manquantes.push('cavités souterraines')
  } else if (cavites.items.length === 0) {
    items.push({ label: 'Cavités souterraines recensées', detail: 'Aucune cavité recensée à proximité', source: 'BRGM/Géorisques' })
  } else {
    const shown = cavites.items.slice(0, MAX_LISTED)
    shown.forEach((c) =>
      items.push({
        label: c.nom ? `${c.type} — ${c.nom}` : c.type,
        detail: describeLocalisation(c.localisation) ?? '',
        source: 'BRGM/Géorisques',
      }),
    )
    if (cavites.total > shown.length) {
      items.push({ label: `+ ${cavites.total - shown.length} autre(s) cavité(s)`, detail: '', source: 'BRGM/Géorisques' })
    }
  }

  if (zoneSismique === null) {
    manquantes.push('zonage sismique')
  } else {
    items.push({
      label: 'Zonage sismique réglementaire',
      detail: `Zone ${zoneSismique} sur l'échelle réglementaire (1 très faible à 5 fort) — sismicité ${ZONAGE_SISMIQUE_LABELS[zoneSismique] ?? 'non classée'}`,
      source: 'Géorisques',
    })
  }

  if (!argilesExpo) {
    manquantes.push('retrait-gonflement des argiles')
  } else {
    items.push({
      label: 'Retrait-gonflement des argiles',
      detail: `Exposition ${argilesExpo.toLowerCase()} : ${ARGILES_DESCRIPTIONS[argilesExpo.trim().toLowerCase()] ?? 'à préciser selon la carte réglementaire'}`,
      source: 'Géorisques',
    })
  }

  if (radonClasseValue === null) {
    manquantes.push('potentiel radon')
  } else {
    items.push({
      label: 'Potentiel radon',
      detail: `Classe ${radonClasseValue} sur l'échelle réglementaire (1 à 3) : ${RADON_DESCRIPTIONS[radonClasseValue] ?? 'à préciser selon la carte réglementaire'}`,
      source: 'Géorisques',
    })
  }

  // Usage de produits phytosanitaires sur les parcelles agricoles voisines —
  // heuristique par défaut (pas de vérification "bio" automatisée possible,
  // voir parcelles.ts) : une parcelle qui n'est pas de la prairie/estive
  // (proxy pour l'élevage) est considérée comme probablement traitée.
  if (parcelSurvey === null) {
    manquantes.push('usage de produits phytosanitaires (RPG)')
  } else if (parcelSurvey.nearestTreated) {
    const p = parcelSurvey.nearestTreated
    const localisation = p.inside
      ? 'le site est situé au sein-même de cette parcelle'
      : `à ${formatDistance(p.distanceM)} ${p.direction ? cardinalPhraseFr(p.direction) : ''} du site`
    items.push({
      label: 'Parcelle agricole probablement traitée la plus proche',
      detail: `Culture : ${p.cropLabel} (code ${p.codeCultu}) — ${localisation}. Ni prairie/estive (élevage) ni certifiée bio à notre connaissance — statut biologique non vérifiable automatiquement.`,
      source: 'RPG — IGN/ASP',
    })
  } else if (parcelSurvey.anyParcelFound) {
    items.push({
      label: "Parcelles agricoles voisines",
      detail: "Seules des prairies/estives (probable élevage) sont recensées à proximité — pas de parcelle cultivée identifiée dans le rayon consulté.",
      source: 'RPG — IGN/ASP',
    })
  } else {
    items.push({ label: 'Parcelles agricoles voisines', detail: 'Aucune parcelle agricole (RPG) recensée à proximité', source: 'RPG — IGN/ASP' })
  }

  if (citycode) {
    items.push({
      label: 'Consulter tous les risques de la commune',
      detail: 'Portail Géorisques (arrêtés, PPR, sismicité, radon...)',
      source: 'Géorisques',
      href: georisques.communeRiskPortalUrl(citycode),
    })
  }

  let resume: string
  if (niveau === 'indeterminee') resume = "Les indicateurs de risques naturels n'ont pas pu être interrogés."
  else if (niveau === 'elevee')
    resume =
      'Un ou plusieurs indicateurs de risques naturels (inondation, mouvements de terrain, cavités, sismicité, argiles ou radon) atteignent un niveau élevé sur le secteur.'
  else if (niveau === 'moderee')
    resume = 'Le secteur présente un ou plusieurs indicateurs de risques naturels à surveiller, sans signal alarmant à ce stade.'
  else resume = 'Les indicateurs de risques naturels consultés sont globalement favorables sur le secteur.'

  return { key: 'risques_naturels', titre: 'Risques naturels', niveau, resume, items, donnees_manquantes: manquantes }
}

/** "Risques industriels" — anciennes et actuelles activités industrielles
 * ou de service susceptibles d'affecter le site : sites et sols pollués
 * (CASIAS/SIS), installations classées (ICPE), canalisations de matières
 * dangereuses. */
function themeRisquesIndustriels(
  ssp: georisques.SspResult | null,
  icpe: georisques.ListResult<georisques.IcpeItem> | null,
  timCount: number | null,
  citycode: string,
): ThemeSynthesis {
  const casiasTotal = ssp?.casias.total ?? null
  const sisTotal = ssp?.sis.total ?? null
  const icpeTotal = icpe?.total ?? null
  const niveau = worstLevel([
    ssp === null ? 'indeterminee' : levelFromCount(casiasTotal, 3, 10),
    ssp === null ? 'indeterminee' : levelFromSsp(sisTotal),
    levelFromCount(icpeTotal, 3, 10),
    levelFromCount(timCount, 2, 5),
  ])
  const items: ThemeItem[] = []
  const manquantes: string[] = []

  if (ssp === null) {
    manquantes.push('anciens sites industriels et sols pollués (BASIAS/SIS)')
  } else {
    const casiasShown = ssp.casias.items.slice(0, MAX_LISTED)
    if (casiasShown.length === 0) {
      items.push({ label: 'Anciens sites industriels', detail: 'Aucun site recensé à proximité', source: 'BASIAS/BASOL (CASIAS) — BRGM/Géorisques' })
    } else {
      casiasShown.forEach((site) =>
        items.push({
          label: site.identifiant ? `${site.nom} (${site.identifiant})` : site.nom,
          detail:
            [site.activite, site.commune, site.statut, describeLocalisation(site.localisation)].filter(Boolean).join(' — ') ||
            'Ancien site industriel ou de service',
          source: 'BASIAS/BASOL (CASIAS) — BRGM/Géorisques',
          href: site.ficheUrl ?? undefined,
        }),
      )
      if (ssp.casias.total > casiasShown.length) {
        items.push({
          label: `+ ${ssp.casias.total - casiasShown.length} autre(s) site(s) recensé(s)`,
          detail: 'Liste complète sur Géorisques',
          source: 'BASIAS/BASOL (CASIAS) — BRGM/Géorisques',
        })
      }
    }

    const sisShown = ssp.sis.items.slice(0, MAX_LISTED)
    if (sisShown.length === 0) {
      items.push({ label: "Secteurs d'information sur les sols (SIS)", detail: 'Aucun secteur recensé à proximité', source: 'SIS — Géorisques' })
    } else {
      sisShown.forEach((site) =>
        items.push({
          label: site.identifiant ? `${site.nom} (${site.identifiant})` : site.nom,
          detail: [site.commune, site.superficieM2 ? `${Math.round(site.superficieM2)} m²` : null, describeLocalisation(site.localisation)]
            .filter(Boolean)
            .join(' — '),
          source: 'SIS — Géorisques',
          href: site.ficheUrl ?? undefined,
        }),
      )
      if (ssp.sis.total > sisShown.length) {
        items.push({
          label: `+ ${ssp.sis.total - sisShown.length} autre(s) secteur(s) recensé(s)`,
          detail: 'Liste complète sur Géorisques',
          source: 'SIS — Géorisques',
        })
      }
    }
  }

  if (icpe === null) {
    manquantes.push('installations classées (ICPE)')
  } else {
    const shown = icpe.items.slice(0, MAX_LISTED)
    if (shown.length === 0) {
      items.push({
        label: "Installations classées pour la protection de l'environnement",
        detail: 'Aucune installation recensée à proximité',
        source: 'ICPE — Géorisques',
      })
    } else {
      shown.forEach((installation) =>
        items.push({
          label: installation.nom,
          detail: [
            installation.regime,
            installation.commune,
            installation.seveso,
            installation.codeNaf ? `NAF ${installation.codeNaf}` : null,
            describeLocalisation(installation.localisation),
          ]
            .filter(Boolean)
            .join(' — '),
          source: 'ICPE — Géorisques',
          href: installation.ficheUrl ?? undefined,
        }),
      )
      if (icpe.total > shown.length) {
        items.push({ label: `+ ${icpe.total - shown.length} autre(s) installation(s)`, detail: 'Liste complète sur Géorisques', source: 'ICPE — Géorisques' })
      }
    }
  }

  if (timCount === null) {
    manquantes.push('canalisations de transport de matières dangereuses')
  } else {
    items.push({
      label: 'Transport de matières dangereuses par canalisation',
      detail: timCount ? `${timCount} canalisation(s) recensée(s) à proximité` : 'Aucune canalisation recensée à proximité',
      source: 'TIM — Géorisques',
    })
  }

  if (citycode) {
    items.push({
      label: 'Consulter le rapport de risques complet de la commune',
      detail: 'Portail Géorisques (installations classées, sites pollués, canalisations...)',
      source: 'Géorisques',
      href: georisques.communeRiskPortalUrl(citycode),
    })
  }

  let resume: string
  if (niveau === 'indeterminee') resume = "Les indicateurs d'activités industrielles n'ont pas pu être interrogés."
  else if (niveau === 'elevee')
    resume =
      "Un ou plusieurs signaux forts d'activité industrielle sont recensés à proximité immédiate (secteur d'information sur les sols, installations classées ou canalisations en nombre)."
  else if (niveau === 'moderee')
    resume = "Un ou plusieurs signaux d'activité industrielle passée ou présente sont recensés à proximité, sans concentration particulière."
  else resume = "Aucun signal notable d'activité industrielle passée ou présente n'est recensé à proximité dans les bases publiques."

  return { key: 'risques_industriels', titre: 'Risques industriels', niveau, resume, items, donnees_manquantes: manquantes }
}
