/**
 * Collects the environmental-watch feed shown on the home page.
 *
 * Runs at build time, not in the browser: none of these feeds sends CORS
 * headers (checked), so a static site cannot read them client-side. The
 * workflow runs this before `vite build` and on a daily schedule, so the
 * published JSON is never more than a day behind.
 *
 * A source that fails is skipped rather than failing the build — a news
 * column is not worth breaking a deployment over, and the page states when
 * the collection ran so a stale feed is visible as such.
 *
 *   node scripts/veille.mjs [chemin-de-sortie]
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const SOURCES = [
  { nom: 'Actu-Environnement', url: 'https://www.actu-environnement.com/ae/news/archives/rss.php4', site: 'https://www.actu-environnement.com/' },
  { nom: 'Notre environnement', url: 'https://www.notre-environnement.gouv.fr/?page=backend', site: 'https://www.notre-environnement.gouv.fr/' },
  { nom: 'Eaufrance', url: 'https://www.eaufrance.fr/rss.xml', site: 'https://www.eaufrance.fr/' },
  { nom: 'SDES — statistiques développement durable', url: 'https://www.statistiques.developpement-durable.gouv.fr/rss.xml', site: 'https://www.statistiques.developpement-durable.gouv.fr/' },
]

const PAR_SOURCE = 6
const TOTAL = 18
const DELAI_MS = 20000

/** Minimal RSS/Atom reader. A dependency-free regex pass is enough here: the
 * feeds are well-formed and only four fields are needed. */
function parseFeed(xml) {
  const items = []
  const blocs = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g), ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/g)]
  for (const [bloc] of blocs) {
    const champ = (nom) => {
      const cdata = bloc.match(new RegExp(`<${nom}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${nom}>`))
      if (cdata) return cdata[1].trim()
      const brut = bloc.match(new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`))
      return brut ? brut[1].trim() : null
    }
    const lienAtom = bloc.match(/<link[^>]*href="([^"]+)"/)
    const titre = champ('title')
    const lien = champ('link') || (lienAtom ? lienAtom[1] : null)
    if (!titre || !lien) continue
    items.push({
      titre: decodeEntities(stripTags(titre)),
      lien: lien.trim(),
      date: champ('pubDate') || champ('updated') || champ('published') || null,
      resume: decodeEntities(stripTags(champ('description') || champ('summary') || '')).slice(0, 260) || null,
    })
  }
  return items
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function dateIso(brut) {
  if (!brut) return null
  const date = new Date(brut)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function collecte(source) {
  const controller = new AbortController()
  const minuteur = setTimeout(() => controller.abort(), DELAI_MS)
  try {
    const reponse = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'LYZa/veille (+https://lyza-environnement.github.io/LYZa/)' },
    })
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
    const xml = await reponse.text()
    const items = parseFeed(xml)
      .slice(0, PAR_SOURCE)
      .map((item) => ({ ...item, date: dateIso(item.date), source: source.nom, siteSource: source.site }))
    console.log(`  ${source.nom} : ${items.length} articles`)
    return items
  } catch (error) {
    console.warn(`  ${source.nom} : ignoré (${error.message})`)
    return []
  } finally {
    clearTimeout(minuteur)
  }
}

const sortie = process.argv[2] ?? new URL('../public/data/veille.json', import.meta.url).pathname

console.log('Collecte de la veille environnementale…')
const lots = await Promise.all(SOURCES.map(collecte))
const articles = lots
  .flat()
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  .slice(0, TOTAL)

await mkdir(dirname(sortie), { recursive: true })
await writeFile(sortie, JSON.stringify({ collecteLe: new Date().toISOString(), articles }, null, 0), 'utf8')
console.log(`${articles.length} articles écrits dans ${sortie}`)
