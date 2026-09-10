import * as georisques from './georisques'
import { levelFromArgiles, levelFromCount, levelFromFloodSignals, levelFromRadon, levelFromSsp, levelFromZonageSismique, worstLevel } from './rules'
import type { AddressResult, SensitivityLevel, SensitivityReport, ThemeItem, ThemeSynthesis } from '../types/sensitivity'

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

  const [icpeResult, sspResult, timCount, mvtCount, cavitesCount, inAziResult, catnatItems, zoneSismique, argilesExpo, radonClasseResult] =
    await Promise.all([
      georisques.fetchIcpe(lat, lon, rayonMetres),
      georisques.fetchSsp(lat, lon, rayonMetres),
      georisques.countTim(lat, lon, rayonMetres),
      georisques.countMvt(lat, lon, rayonMetres),
      georisques.countCavites(lat, lon, rayonMetres),
      georisques.inAzi(lat, lon, rayonMetres),
      citycode ? georisques.fetchCatnatInondation(citycode) : Promise.resolve(null),
      citycode ? georisques.zonageSismique(citycode) : Promise.resolve(null),
      citycode ? georisques.argilesExposition(citycode) : Promise.resolve(null),
      citycode ? georisques.radonClasse(citycode) : Promise.resolve(null),
    ])

  const themes: ThemeSynthesis[] = [
    themeSols(sspResult),
    themeEau(inAziResult, catnatItems, citycode),
    themeRisquesNaturels(mvtCount, cavitesCount, zoneSismique, argilesExpo, radonClasseResult),
    themeActivitesIndustrielles(icpeResult, timCount),
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

function formatDateFr(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR')
}

function themeSols(ssp: georisques.SspResult | null): ThemeSynthesis {
  const casiasTotal = ssp?.casias.total ?? null
  const sisTotal = ssp?.sis.total ?? null
  const niveau = ssp === null ? 'indeterminee' : worstLevel([levelFromCount(casiasTotal, 1, 4), levelFromSsp(sisTotal)])
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
          label: site.nom,
          detail: [site.activite, site.commune, site.statut].filter(Boolean).join(' — ') || 'Ancien site industriel ou de service',
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
          label: site.nom,
          detail: [site.commune, site.superficieM2 ? `${Math.round(site.superficieM2)} m²` : null].filter(Boolean).join(' — '),
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

  let resume: string
  if (niveau === 'indeterminee') resume = "Les bases de données sur les sols n'ont pas pu être interrogées."
  else if (sisTotal) resume = "Un ou plusieurs secteurs d'information sur les sols (SIS) sont recensés à proximité immédiate."
  else if (casiasTotal)
    resume = "Le secteur a accueilli une ou plusieurs activités industrielles ou de service par le passé, sans restriction d'usage confirmée à ce stade."
  else resume = "Aucun site industriel ancien ni secteur d'information sur les sols n'est recensé à proximité dans les bases publiques."

  return { key: 'sols', titre: 'Sols', niveau, resume, items, donnees_manquantes: manquantes }
}

function themeEau(inAziValue: boolean | null, catnatItems: georisques.CatnatItem[] | null, citycode: string): ThemeSynthesis {
  const catnatCount = catnatItems?.length ?? null
  const niveau = levelFromFloodSignals(inAziValue, catnatCount)
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
      const dates = [
        arrete.dateDebut && arrete.dateFin ? `évènement du ${formatDateFr(arrete.dateDebut)} au ${formatDateFr(arrete.dateFin)}` : null,
        arrete.datePublication ? `arrêté publié le ${formatDateFr(arrete.datePublication)}` : null,
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

  if (citycode) {
    items.push({
      label: 'Consulter tous les risques de la commune',
      detail: 'Portail Géorisques (arrêtés, PPR, sismicité, radon...)',
      source: 'Géorisques',
      href: georisques.communeRiskPortalUrl(citycode),
    })
  }

  let resume: string
  if (niveau === 'indeterminee') resume = "Les indicateurs liés à l'eau n'ont pas pu être interrogés."
  else if (niveau === 'elevee')
    resume = "Le secteur est en zone inondable connue et la commune a déjà fait l'objet d'arrêtés catastrophe naturelle pour inondation."
  else if (niveau === 'moderee')
    resume = "Un signal lié au risque inondation existe (zone recensée ou antécédents communaux) : un avis hydrogéologique permettrait de préciser l'enjeu."
  else resume = "Aucun signal notable lié au risque inondation n'est recensé à proximité dans les bases publiques consultées."

  return { key: 'eau', titre: 'Eau', niveau, resume, items, donnees_manquantes: manquantes }
}

function themeRisquesNaturels(
  mvtCount: number | null,
  cavitesCount: number | null,
  zoneSismique: number | null,
  argilesExpo: string | null,
  radonClasseValue: number | null,
): ThemeSynthesis {
  const niveaux: SensitivityLevel[] = [
    levelFromCount(mvtCount, 1, 3),
    levelFromCount(cavitesCount, 1, 3),
    levelFromZonageSismique(zoneSismique),
    levelFromArgiles(argilesExpo),
    levelFromRadon(radonClasseValue),
  ]
  const niveau = worstLevel(niveaux)
  const items: ThemeItem[] = []
  const manquantes: string[] = []

  const add = (value: unknown, label: string, detail: string, source: string, missingLabel: string) => {
    if (value === null || value === undefined) manquantes.push(missingLabel)
    else items.push({ label, detail, source })
  }

  add(
    mvtCount,
    'Mouvements de terrain recensés',
    mvtCount ? `${mvtCount} évènement(s) recensé(s) à proximité` : 'Aucun évènement recensé à proximité',
    'BRGM/Géorisques',
    'mouvements de terrain',
  )
  add(
    cavitesCount,
    'Cavités souterraines recensées',
    cavitesCount ? `${cavitesCount} cavité(s) recensée(s) à proximité` : 'Aucune cavité recensée à proximité',
    'BRGM/Géorisques',
    'cavités souterraines',
  )
  add(
    zoneSismique,
    'Zonage sismique réglementaire',
    `Zone ${zoneSismique} sur l'échelle réglementaire (1 très faible à 5 fort)`,
    'Géorisques',
    'zonage sismique',
  )
  add(argilesExpo, 'Retrait-gonflement des argiles', `Exposition ${argilesExpo?.toLowerCase()}`, 'Géorisques', 'retrait-gonflement des argiles')
  add(
    radonClasseValue,
    'Potentiel radon',
    `Classe ${radonClasseValue} sur l'échelle réglementaire (1 à 3)`,
    'Géorisques',
    'potentiel radon',
  )

  let resume: string
  if (niveau === 'indeterminee') resume = "Les indicateurs de risques naturels n'ont pas pu être interrogés."
  else if (niveau === 'elevee')
    resume =
      'Un ou plusieurs indicateurs de risques naturels (mouvements de terrain, sismicité, argiles ou radon) atteignent un niveau élevé sur le secteur.'
  else if (niveau === 'moderee')
    resume = 'Le secteur présente un ou plusieurs indicateurs de risques naturels à surveiller, sans signal alarmant à ce stade.'
  else resume = 'Les indicateurs de risques naturels consultés sont globalement favorables sur le secteur.'

  return { key: 'risques_naturels', titre: 'Risques naturels', niveau, resume, items, donnees_manquantes: manquantes }
}

function themeActivitesIndustrielles(icpe: georisques.ListResult<georisques.IcpeItem> | null, timCount: number | null): ThemeSynthesis {
  const icpeTotal = icpe?.total ?? null
  const niveau = worstLevel([levelFromCount(icpeTotal, 1, 3), levelFromCount(timCount, 1, 2)])
  const items: ThemeItem[] = []
  const manquantes: string[] = []

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
          detail: [installation.regime, installation.commune, installation.seveso, installation.codeNaf ? `NAF ${installation.codeNaf}` : null]
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

  let resume: string
  if (niveau === 'indeterminee') resume = "Les indicateurs d'activités industrielles n'ont pas pu être interrogés."
  else if (niveau === 'elevee')
    resume = 'Plusieurs installations classées ou canalisations de matières dangereuses sont recensées à proximité immédiate.'
  else if (niveau === 'moderee') resume = 'Une ou plusieurs installations classées sont recensées à proximité, sans concentration particulière.'
  else resume = "Aucune installation classée ni canalisation à risque n'est recensée à proximité dans les bases publiques."

  return { key: 'activites_industrielles', titre: 'Activités industrielles', niveau, resume, items, donnees_manquantes: manquantes }
}
