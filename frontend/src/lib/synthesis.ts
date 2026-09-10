import * as georisques from './georisques'
import { levelFromArgiles, levelFromCount, levelFromFloodSignals, levelFromRadon, levelFromSsp, levelFromZonageSismique, worstLevel } from './rules'
import type { AddressResult, SensitivityLevel, SensitivityReport, ThemeItem, ThemeSynthesis } from '../types/sensitivity'

const AVERTISSEMENT =
  "Cette synthèse s'appuie sur des données publiques (BRGM/Géorisques, IGN) " +
  "recensées à proximité de l'adresse indiquée. Elle donne une première lecture " +
  "des enjeux et ne remplace pas une étude réglementaire (étude de sols, avis " +
  'hydrogéologique, diagnostic ICPE...).'

export async function buildSensitivityReport(address: AddressResult, rayonMetres: number): Promise<SensitivityReport> {
  const { lat, lon, citycode } = address

  const [
    basiasCount,
    sspCount,
    icpeCount,
    timCount,
    mvtCount,
    cavitesCount,
    inAziResult,
    catnatInondation,
    zoneSismique,
    argilesExpo,
    radonClasseResult,
  ] = await Promise.all([
    georisques.countBasias(lat, lon, rayonMetres),
    georisques.countSsp(lat, lon, rayonMetres),
    georisques.countIcpe(lat, lon, rayonMetres),
    georisques.countTim(lat, lon, rayonMetres),
    georisques.countMvt(lat, lon, rayonMetres),
    georisques.countCavites(lat, lon, rayonMetres),
    georisques.inAzi(lat, lon, rayonMetres),
    citycode ? georisques.catnatInondationCount(citycode) : Promise.resolve(null),
    citycode ? georisques.zonageSismique(citycode) : Promise.resolve(null),
    citycode ? georisques.argilesExposition(citycode) : Promise.resolve(null),
    citycode ? georisques.radonClasse(citycode) : Promise.resolve(null),
  ])

  const themes: ThemeSynthesis[] = [
    themeSols(basiasCount, sspCount),
    themeEau(inAziResult, catnatInondation),
    themeRisquesNaturels(mvtCount, cavitesCount, zoneSismique, argilesExpo, radonClasseResult),
    themeActivitesIndustrielles(icpeCount, timCount),
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

function themeSols(basiasCount: number | null, sspCount: number | null): ThemeSynthesis {
  const niveau = worstLevel([levelFromCount(basiasCount, 1, 4), levelFromSsp(sspCount)])
  const items: ThemeItem[] = []
  const manquantes: string[] = []

  if (basiasCount === null) {
    manquantes.push('anciens sites industriels (BASIAS)')
  } else {
    items.push({
      label: "Anciens sites industriels ou d'activité de service",
      detail: basiasCount ? `${basiasCount} site(s) recensé(s) à proximité` : 'Aucun site recensé à proximité',
      source: 'BASIAS — BRGM/Géorisques',
    })
  }
  if (sspCount === null) {
    manquantes.push('sites et sols pollués (ex-BASOL)')
  } else {
    items.push({
      label: 'Sites et sols pollués, ou potentiellement pollués',
      detail: sspCount ? `${sspCount} site(s) recensé(s) à proximité` : 'Aucun site recensé à proximité',
      source: 'SSP (ex-BASOL) — BRGM/Géorisques',
    })
  }

  let resume: string
  if (niveau === 'indeterminee') resume = "Les bases de données sur les sols n'ont pas pu être interrogées."
  else if (sspCount) resume = 'Un ou plusieurs sites pollués ou potentiellement pollués sont recensés à proximité immédiate.'
  else if (basiasCount)
    resume =
      "Le secteur a accueilli une ou plusieurs activités industrielles ou de service par le passé, sans pollution confirmée à ce stade."
  else resume = 'Aucun site industriel ancien ni sol pollué n\'est recensé à proximité dans les bases publiques.'

  return { key: 'sols', titre: 'Sols', niveau, resume, items, donnees_manquantes: manquantes }
}

function themeEau(inAziValue: boolean | null, catnatInondation: number | null): ThemeSynthesis {
  const niveau = levelFromFloodSignals(inAziValue, catnatInondation)
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
  if (catnatInondation === null) {
    manquantes.push('arrêtés catastrophe naturelle (inondation)')
  } else {
    items.push({
      label: 'Historique catastrophe naturelle — inondation',
      detail: catnatInondation ? `${catnatInondation} arrêté(s) pris pour la commune` : 'Aucun arrêté recensé pour la commune',
      source: 'GASPAR — Géorisques',
    })
  }

  let resume: string
  if (niveau === 'indeterminee') resume = "Les indicateurs liés à l'eau n'ont pas pu être interrogés."
  else if (niveau === 'elevee')
    resume =
      "Le secteur est en zone inondable connue et la commune a déjà fait l'objet d'arrêtés catastrophe naturelle pour inondation."
  else if (niveau === 'moderee')
    resume =
      "Un signal lié au risque inondation existe (zone recensée ou antécédents communaux) : un avis hydrogéologique permettrait de préciser l'enjeu."
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

function themeActivitesIndustrielles(icpeCount: number | null, timCount: number | null): ThemeSynthesis {
  const niveau = worstLevel([levelFromCount(icpeCount, 1, 3), levelFromCount(timCount, 1, 2)])
  const items: ThemeItem[] = []
  const manquantes: string[] = []

  if (icpeCount === null) {
    manquantes.push('installations classées (ICPE)')
  } else {
    items.push({
      label: "Installations classées pour la protection de l'environnement",
      detail: icpeCount ? `${icpeCount} installation(s) recensée(s) à proximité` : 'Aucune installation recensée à proximité',
      source: 'ICPE — Géorisques',
    })
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
  else resume = 'Aucune installation classée ni canalisation à risque n\'est recensée à proximité dans les bases publiques.'

  return { key: 'activites_industrielles', titre: 'Activités industrielles', niveau, resume, items, donnees_manquantes: manquantes }
}
