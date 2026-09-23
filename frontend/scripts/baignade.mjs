/**
 * Builds the national list of official bathing sites shipped with the site.
 *
 * Runs at build time. The previous approach queried data.gouv's Tabular API
 * live from the browser, which had two flaws: the resource id of the seasonal
 * export is hardcoded and changes every year (a stale id silently returns
 * nothing), and the paginated reads capped how many sites could be loaded. A
 * site that simply was not in the fetched pages looked like "no bathing site
 * nearby", which is exactly the kind of false reassurance this platform is
 * supposed to avoid.
 *
 * Here the dataset's resource list is resolved fresh on every build, the most
 * recent season's CSV is downloaded whole, and the result is written as a
 * static file. Both fresh water and sea water are included — the export is the
 * ministry's full bathing-season list.
 *
 *   node scripts/baignade.mjs [chemin-de-sortie]
 */

import { writeFile, mkdir, access } from 'node:fs/promises'
import { dirname } from 'node:path'

const DATASET = '57fce28ac751df0e4079df72' // "Données de rapportage de la saison balnéaire"
const DELAI_MS = 120000

/** Splits a CSV line on a separator, honouring double-quoted fields. */
function decoupe(ligne, separateur) {
  const champs = []
  let courant = ''
  let entreGuillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"'
        i++
      } else entreGuillemets = !entreGuillemets
    } else if (c === separateur && !entreGuillemets) {
      champs.push(courant)
      courant = ''
    } else courant += c
  }
  champs.push(courant)
  return champs.map((v) => v.trim())
}

function normalise(valeur) {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Finds a column by trying several header spellings, so a small rename
 * upstream does not silently empty the file. */
function colonne(entetes, ...candidats) {
  const normalisees = entetes.map(normalise)
  for (const candidat of candidats) {
    const index = normalisees.findIndex((e) => e.includes(normalise(candidat)))
    if (index !== -1) return index
  }
  return -1
}

async function recupere(url, options = {}) {
  const controller = new AbortController()
  const minuteur = setTimeout(() => controller.abort(), DELAI_MS)
  try {
    const reponse = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'LYZa (+https://lyza-environnement.github.io/LYZa/)' },
      ...options,
    })
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
    return reponse
  } finally {
    clearTimeout(minuteur)
  }
}

/** Most recent CSV resource of the dataset whose title matches `motif`. */
function ressourceLaPlusRecente(dataset, motif) {
  const candidates = (dataset.resources ?? [])
    .filter((r) => motif.test(r.title ?? '') && /csv/i.test(r.format ?? ''))
    .map((r) => ({ titre: r.title, url: r.url, annee: Number((r.title.match(/(20\d\d)/) ?? [])[1] ?? 0) }))
    .sort((a, b) => b.annee - a.annee)
  return candidates[0] ?? null
}

async function litCsv(url) {
  // The ministry publishes these exports in Windows-1252, not UTF-8: decoding
  // them as UTF-8 turns "Rivière" into "Rivi\uFFFDre". Decode as UTF-8 first
  // and fall back as soon as replacement characters appear.
  const octets = new Uint8Array(await (await recupere(url)).arrayBuffer())
  let texte = new TextDecoder('utf-8').decode(octets)
  if (texte.includes('\uFFFD')) texte = new TextDecoder('windows-1252').decode(octets)
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lignes.length < 2) throw new Error('CSV vide')
  const separateur = (lignes[0].match(/;/g) ?? []).length >= (lignes[0].match(/,/g) ?? []).length ? ';' : ','
  return { entetes: decoupe(lignes[0], separateur), lignes: lignes.slice(1).map((l) => decoupe(l, separateur)) }
}

/** Bathing-water classification as reported under directive 2006/7/CE. 0 is
 * used for sites that have no classification yet — a new site, or one with too
 * few samples — which is not the same thing as a bad one. */
const CLASSEMENTS = { 1: 'Excellente', 2: 'Bonne', 3: 'Suffisante', 4: 'Insuffisante' }

/** Season dates and incidents of the last reported season, per site. */
async function collecteSaison(dataset) {
  const ressource = ressourceLaPlusRecente(dataset, /informations[- ]sur[- ]la[- ]saison/i)
  if (!ressource) return { ressource: null, parSite: new Map() }
  const { entetes, lignes } = await litCsv(ressource.url)
  const iCode = colonne(entetes, "code unique d'identification du site de baignade", 'code unique')
  const iType = colonne(entetes, "type d'événement", 'type d evenement')
  const iDebut = colonne(entetes, 'date de début', 'date de debut')
  const iFin = colonne(entetes, 'date de fin')
  if (iCode === -1 || iType === -1) return { ressource: null, parSite: new Map() }

  const parSite = new Map()
  for (const champs of lignes) {
    const code = champs[iCode]
    if (!code) continue
    const entree = parSite.get(code) ?? { interdictions: 0, cyanobacteries: 0, pollutions: 0 }
    const type = (champs[iType] ?? '').toLowerCase()
    if (type.includes('saison')) {
      entree.debut = champs[iDebut] || undefined
      entree.fin = champs[iFin] || undefined
    } else if (type.includes('interdiction')) entree.interdictions++
    else if (type.includes('cyanobact')) entree.cyanobacteries++
    else if (type.includes('pollution')) entree.pollutions++
    parSite.set(code, entree)
  }
  return { ressource, parSite }
}

/** Classification of the last reported season, per site. */
async function collecteClassement(dataset) {
  const ressource = ressourceLaPlusRecente(dataset, /caract[ée]ristiques[- ]des[- ]sites[- ]de[- ]baignade/i)
  if (!ressource) return { ressource: null, parSite: new Map() }
  const { entetes, lignes } = await litCsv(ressource.url)
  const iCode = colonne(entetes, "code unique d'identification du site de baignade", 'code unique')
  const iClassement = colonne(entetes, 'classement')
  if (iCode === -1 || iClassement === -1) return { ressource: null, parSite: new Map() }
  const parSite = new Map()
  for (const champs of lignes) {
    if (champs[iCode]) parSite.set(champs[iCode], CLASSEMENTS[Number(champs[iClassement])] ?? null)
  }
  return { ressource, parSite }
}

const sortie = process.argv[2] ?? new URL('../public/data/baignade.json', import.meta.url).pathname

console.log('Collecte des sites de baignade…')
try {
  const dataset = await (await recupere(`https://www.data.gouv.fr/api/1/datasets/${DATASET}/`)).json()

  const ressource = ressourceLaPlusRecente(dataset, /liste[- ]des[- ]sites[- ]de[- ]baignade|sites[- ]de[- ]baignade[- ]saison/i)
  if (!ressource) throw new Error('aucune ressource « liste des sites de baignade » trouvée')
  console.log(`  ressource retenue : ${ressource.titre}`)

  // The classification and the season log describe the last *reported* season,
  // which is the one before the list of open sites: a site's water quality is
  // computed on the four seasons that precede it, so it can only be published
  // once a season is over.
  const [classement, saison] = await Promise.all([collecteClassement(dataset), collecteSaison(dataset)])
  if (classement.ressource) console.log(`  classement : ${classement.ressource.titre} (${classement.parSite.size} sites)`)
  if (saison.ressource) console.log(`  saison : ${saison.ressource.titre} (${saison.parSite.size} sites)`)

  const { entetes, lignes } = await litCsv(ressource.url)
  const iNom = colonne(entetes, 'nom du site de baignade', 'nom site', 'nomsite')
  const iCommune = colonne(entetes, 'nom de la commune', 'commune')
  const iType = colonne(entetes, "type d'eau", 'typeeau')
  const iLon = colonne(entetes, 'longitude')
  const iLat = colonne(entetes, 'latitude')
  const iCode = colonne(entetes, "code unique d'identification du site de baignade", 'code unique')
  const iPrecedent = colonne(entetes, "précédent code unique d'identification", 'precedent code unique')
  if (iNom === -1 || iLon === -1 || iLat === -1) {
    throw new Error(`colonnes introuvables (nom=${iNom}, lon=${iLon}, lat=${iLat}) parmi : ${entetes.join(' | ')}`)
  }

  /** A site renamed between the two seasons keeps its data under its previous
   * code, so both are tried before giving up on it. */
  const joint = (table, champs) => {
    const code = iCode === -1 ? null : champs[iCode]
    const precedent = iPrecedent === -1 ? null : champs[iPrecedent]
    if (code && table.has(code)) return table.get(code)
    if (precedent && table.has(precedent)) return table.get(precedent)
    return undefined
  }

  const sites = []
  for (const champs of lignes) {
    const lon = Number(String(champs[iLon] ?? '').replace(',', '.'))
    const lat = Number(String(champs[iLat] ?? '').replace(',', '.'))
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || (lon === 0 && lat === 0)) continue
    const evenements = joint(saison.parSite, champs)
    sites.push({
      nom: champs[iNom] || 'Site de baignade',
      commune: iCommune === -1 ? null : champs[iCommune] || null,
      type: iType === -1 ? null : champs[iType] || null,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      qualite: joint(classement.parSite, champs) ?? null,
      saisonDebut: evenements?.debut ?? null,
      saisonFin: evenements?.fin ?? null,
      interdictions: evenements?.interdictions || 0,
      cyanobacteries: evenements?.cyanobacteries || 0,
      pollutions: evenements?.pollutions || 0,
    })
  }
  if (sites.length === 0) throw new Error('aucun site géolocalisé extrait')

  const parType = sites.reduce((acc, s) => ({ ...acc, [s.type ?? 'non précisé']: (acc[s.type ?? 'non précisé'] ?? 0) + 1 }), {})
  const classes = sites.filter((s) => s.qualite).length
  console.log(`  ${sites.length} sites géolocalisés — ${Object.entries(parType).map(([t, n]) => `${t} : ${n}`).join(', ')}`)
  console.log(`  ${classes} sites avec un classement de la qualité de l'eau`)

  await mkdir(dirname(sortie), { recursive: true })
  await writeFile(
    sortie,
    JSON.stringify({
      source: ressource.titre,
      saisonClassement: classement.ressource?.annee ?? null,
      collecteLe: new Date().toISOString(),
      sites,
    }),
    'utf8',
  )
  console.log(`  écrit dans ${sortie}`)
} catch (error) {
  // Never overwrite a good file with nothing: a failed refresh keeps the
  // previously published list, which is far better than an empty one.
  console.warn(`  échec (${error.message})`)
  try {
    await access(sortie)
    console.warn('  la liste précédente est conservée')
  } catch {
    console.warn('  aucune liste précédente : la rubrique eau signalera la donnée comme indisponible')
  }
}
