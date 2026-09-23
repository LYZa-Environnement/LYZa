/**
 * Collects the environmental-watch feed shown on the home page, sorted into
 * four reading angles: research, French public policy, what happens outside
 * France, and what is being invented.
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

export const CATEGORIES = {
  science: 'Actualité scientifique',
  politique: 'Actualité politique',
  international: 'Actualité internationale',
  innovation: 'Sujet innovant',
}

/**
 * `categorie` is the angle the source is read for, and the fallback when an
 * article carries no clear signal of its own. `langue` marks a feed published
 * in English, so the page can say so rather than let a reader click into it
 * unawares.
 *
 * Three feeds that would fit here — Sciences et Avenir, Pour la Science and
 * Euractiv — are left out: their front end answers 403 to Node's HTTP client
 * while serving the very same request from curl, so they refuse automated
 * reading rather than this machine. Working around a fingerprint check to take
 * content a publisher is declining to serve is not something this build does.
 */
const SOURCES = [
  // ---- Recherche ---------------------------------------------------------
  { nom: 'The Conversation France', categorie: 'science', url: 'https://theconversation.com/fr/environnement/articles.atom', site: 'https://theconversation.com/fr' },
  { nom: 'CNRS Le Journal', categorie: 'science', url: 'https://lejournal.cnrs.fr/rss', site: 'https://lejournal.cnrs.fr/' },
  { nom: 'Encyclopédie de l’Environnement (université Grenoble Alpes)', categorie: 'science', url: 'https://www.encyclopedie-environnement.org/feed/', site: 'https://www.encyclopedie-environnement.org/' },
  { nom: 'Futura Sciences — environnement', categorie: 'science', url: 'https://www.futura-sciences.com/rss/environnement/actualites.xml', site: 'https://www.futura-sciences.com/planete/' },
  { nom: 'Institut de recherche pour le développement', categorie: 'science', url: 'https://www.ird.fr/rss.xml', site: 'https://www.ird.fr/' },
  { nom: 'Nature Climate Change', categorie: 'science', url: 'https://www.nature.com/nclimate.rss', site: 'https://www.nature.com/nclimate', langue: 'en' },
  { nom: 'ScienceDaily — Terre et climat', categorie: 'science', url: 'https://www.sciencedaily.com/rss/earth_climate.xml', site: 'https://www.sciencedaily.com/news/earth_climate/', langue: 'en' },

  // ---- Politique publique française --------------------------------------
  { nom: 'Actu-Environnement', categorie: 'politique', url: 'https://www.actu-environnement.com/ae/news/archives/rss.php4', site: 'https://www.actu-environnement.com/' },
  { nom: 'Notre environnement — ministère de la Transition écologique', categorie: 'politique', url: 'https://www.notre-environnement.gouv.fr/?page=backend', site: 'https://www.notre-environnement.gouv.fr/' },
  { nom: 'Eaufrance', categorie: 'politique', url: 'https://www.eaufrance.fr/rss.xml', site: 'https://www.eaufrance.fr/' },
  { nom: 'Service des données et études statistiques (SDES)', categorie: 'politique', url: 'https://www.statistiques.developpement-durable.gouv.fr/rss.xml', site: 'https://www.statistiques.developpement-durable.gouv.fr/' },
  { nom: 'Autorité de sûreté nucléaire et de radioprotection (ASNR)', categorie: 'politique', url: 'https://www.asnr.fr/rss.xml', site: 'https://www.asnr.fr/' },

  // ---- Hors de France ----------------------------------------------------
  { nom: 'Agence européenne pour l’environnement', categorie: 'international', url: 'https://www.eea.europa.eu/en/newsroom/news/rss.xml', site: 'https://www.eea.europa.eu/', langue: 'en' },
  { nom: 'Programme des Nations unies pour l’environnement', categorie: 'international', url: 'https://www.unep.org/rss.xml', site: 'https://www.unep.org/', langue: 'en' },
  { nom: 'Groupe d’experts intergouvernemental sur l’évolution du climat (GIEC)', categorie: 'international', url: 'https://www.ipcc.ch/feed/', site: 'https://www.ipcc.ch/', langue: 'en' },
  { nom: 'Commission européenne', categorie: 'international', url: 'https://ec.europa.eu/commission/presscorner/api/rss?language=fr', site: 'https://ec.europa.eu/commission/presscorner/' },
  { nom: 'Carbon Brief', categorie: 'international', url: 'https://www.carbonbrief.org/feed/', site: 'https://www.carbonbrief.org/', langue: 'en' },

  // ---- Innovation --------------------------------------------------------
  { nom: 'Techniques de l’Ingénieur', categorie: 'innovation', url: 'https://www.techniques-ingenieur.fr/actualite/articles/feed/', site: 'https://www.techniques-ingenieur.fr/actualite/' },
  { nom: 'La Révolution Énergétique', categorie: 'innovation', url: 'https://www.revolution-energetique.com/feed/', site: 'https://www.revolution-energetique.com/' },
  { nom: 'Enerzine', categorie: 'innovation', url: 'https://www.enerzine.com/feed', site: 'https://www.enerzine.com/' },
]

/** How many articles a single source may contribute, so one prolific feed
 * does not take over a category. */
const PAR_SOURCE = 4
/** How many articles are published per category. */
const PAR_CATEGORIE = 12
const DELAI_MS = 25000

/** Every article has to be recognisably about the environment. Applying this
 * to focused feeds too, and not only to the generalist ones, is what keeps a
 * gambling filler out of an energy feed and a birth-rate essay out of a
 * research feed: an editorial line is not a guarantee, item by item. */
const ENVIRONNEMENT =
  /\b(environnement\w*|écolog\w*|ecolog\w*|climat\w*|climate|réchauffement|carbone|carbon|CO2|gaz à effet de serre|greenhouse|biodiversit\w*|espèce\w*|species|écosystème\w*|ecosystem\w*|forêt\w*|forest\w*|océan\w*|ocean\w*|mer|littoral|rivière\w*|fleuve\w*|eau|water|nappe\w*|sécheresse|drought|inondation\w*|flood\w*|pollution\w*|polluant\w*|pollutant\w*|pesticide\w*|PFAS|perfluor\w*|microplastique\w*|plastique\w*|plastic\w*|déchet\w*|waste|recycl\w*|sols?\b|soil\w*|agricol\w*|agricultur\w*|énergie\w*|energy|renouvelable\w*|renewable\w*|éolien\w*|wind power|solaire|photovoltaïque|nucléaire|nuclear|émission\w*|emission\w*|transition écologique|développement durable|sustainab\w*|air quality|qualité de l'air|biodiversity|neutralité carbone|canicule|heatwave|glacier\w*|banquise|permafrost|sobriété|risque\w* naturel\w*|séisme|sismi\w*|volcan\w*|radon|amiante|ICPE|Seveso|zone humide|wetland\w*|santé environnementale)\b/i

/** Feeds carry more than articles: job adverts, obituaries, thesis defences,
 * photo contests, subscription pitches and untitled publication notices. None
 * of it is news about the environment, and all of it slips through a keyword
 * filter because it is published alongside what is. */
const HORS_SUJET =
  /\b(offre d'emploi|offres d'emploi|nouvelle offre|offre disponible|recrut\w*|candidatur\w*|stage\b|alternance|job\b|jobs\b|vacancy|vacancies|internship|apply now|obituary|nécrologie|hommage à|in memoriam|soutenance de thèse|appel à projets?|appel à contribution|concours photo|photo competition|vote now|award winner|abonnement|s'abonner|subscribe|newsletter|webinaire|webinar|save the date|avis de parution|sommaire du numéro|numéro spécial|jeux?\b|casino|paris sportifs|bookmaker|position of|entry-level|nous recrutons|nouvelles quotidiennes|actualité quotidienne|daily news|midday express|avis de recrutement)\b/i

/** Signals that place an article in one angle rather than another. The default
 * is the source's own angle, so these only need to catch what clearly belongs
 * somewhere else — a decree published by a research magazine, a prototype
 * unveiled in a policy feed. */
const SIGNAUX = {
  science: /\b(étude\w*|studies|study|recherche\w*|research\w*|chercheu\w*|scientist\w*|scientifique\w*|publication\w*|revue|journal|Nature|Science|modélisation\w*|modelling|laborato\w*|expériment\w*|experiment\w*|analyse\w*|échantillon\w*|observation\w*|découverte\w*|discover\w*|données inédites|published in|preprint|méta-analyse|cohorte)\b/i,
  politique: /\b(loi|lois|décret\w*|arrêté\w*|réglementation\w*|règlement\w*|regulation\w*|gouvernement\w*|ministre\w*|ministère\w*|Parlement|Assemblée nationale|Sénat|préfe\w*|plan national|stratégie nationale|budget|fiscal\w*|taxe\w*|subvention\w*|consultation publique|Conseil d'État|Conseil constitutionnel|tribunal|justice|condamn\w*|sanction\w*|amende\w*|autorisation\w*|interdiction\w*|moratoire|élu\w*|collectivité\w*|maire\w*|commune\w*|département\w*|région\w*)\b/i,
  international: /\b(ONU|Nations unies|United Nations|COP\d*|GIEC|IPCC|Commission européenne|European Commission|Union européenne|European Union|Bruxelles|Brussels|directive européenne|mondial\w*|worldwide|global\w*|international\w*|accord de Paris|Paris Agreement|traité\w*|treaty|sommet|summit|États-Unis|United States|Chine|China|Inde|India|Brésil|Brazil|Afrique|Africa|Amazonie|Amazon|Arctique|Arctic|Antarctique|Antarctic)\b/i,
  innovation: /\b(innovation\w*|innovant\w*|invent\w*|technolog\w*|prototype\w*|démonstrateur\w*|start[- ]?up\w*|brevet\w*|patent\w*|procédé\w*|dispositif\w*|capteur\w*|intelligence artificielle|artificial intelligence|algorithm\w*|matériau\w*|material\w*|batterie\w*|batter\w*|hydrogène|hydrogen|stockage|storage|rendement|première mondiale|world[- ]first|breakthrough|pilote industriel|mise à l'échelle|scale[- ]up|nouvelle génération|next[- ]generation)\b/i,
}

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
      resume: nettoieResume(decodeEntities(stripTags(champ('description') || champ('summary') || champ('content') || ''))).slice(0, 260) || null,
    })
  }
  return items
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** WordPress feeds append their own footer to every summary — "L'article X est
 * apparu en premier sur Y" — and several truncate with a bracketed ellipsis.
 * Neither says anything about the article. */
function nettoieResume(value) {
  return value
    .replace(/\s*L['’]article\s.+?est apparu en premier sur\s.*$/i, '')
    .replace(/\s*(Cet article|The post)\s.+?(est apparu en premier sur|appeared first on)\s.*$/i, '')
    .replace(/\s*\[(…|\.\.\.)\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
    // Several feeds publish accented characters as numeric entities
    // ("gr&#226;ce"), which a fixed list of named entities never catches.
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

function dateIso(brut) {
  if (!brut) return null
  const date = new Date(brut)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Counts how many distinct signals of a category an article carries. */
function score(texte, motif) {
  const trouves = texte.match(new RegExp(motif.source, 'gi'))
  return trouves ? new Set(trouves.map((m) => m.toLowerCase())).size : 0
}

/**
 * Where to file an article. The source's own angle wins unless another one is
 * clearly better represented in the title and the summary — "clearly" being
 * two distinct signals more, so a single stray word never moves an article.
 */
function classe(article, source) {
  const texte = `${article.titre} ${article.resume ?? ''}`
  const defaut = source.categorie
  let meilleure = defaut
  let ecart = 0
  const reference = score(texte, SIGNAUX[defaut])
  for (const [categorie, motif] of Object.entries(SIGNAUX)) {
    if (categorie === defaut) continue
    const gain = score(texte, motif) - reference
    if (gain >= 2 && gain > ecart) {
      meilleure = categorie
      ecart = gain
    }
  }
  return meilleure
}

/** One retry, spaced out: these are public feeds behind ordinary web servers,
 * and a single refused request is more often a hiccup than a policy. */
async function collecte(source) {
  for (let essai = 0; essai < 2; essai++) {
    const resultat = await tente(source, essai)
    if (resultat !== null) return resultat
    if (essai === 0) await new Promise((r) => setTimeout(r, 1500))
  }
  return []
}

async function tente(source, essai) {
  const controller = new AbortController()
  const minuteur = setTimeout(() => controller.abort(), DELAI_MS)
  try {
    const reponse = await fetch(source.url, {
      signal: controller.signal,
      // Several publishers answer 403 to a bare request: they expect the
      // header set a feed reader actually sends.
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 LYZa-veille/1.0 (+https://lyza-environnement.github.io/LYZa/)',
        accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    })
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
    const xml = await reponse.text()
    const bruts = parseFeed(xml)
    const retenus = bruts
      .filter((item) => {
        const texte = `${item.titre} ${item.resume ?? ''}`
        return ENVIRONNEMENT.test(texte) && !HORS_SUJET.test(texte)
      })
      .slice(0, PAR_SOURCE)
      .map((item) => ({
        ...item,
        date: dateIso(item.date),
        source: source.nom,
        siteSource: source.site,
        langue: source.langue ?? 'fr',
        categorie: classe(item, source),
      }))
    console.log(`  ${source.nom} : ${retenus.length} retenus sur ${bruts.length}`)
    return retenus
  } catch (error) {
    if (essai === 0) return null
    console.warn(`  ${source.nom} : ignoré (${error.message})`)
    return []
  } finally {
    clearTimeout(minuteur)
  }
}

const sortie = process.argv[2] ?? new URL('../public/data/veille.json', import.meta.url).pathname

console.log('Collecte de la veille environnementale…')
const lots = await Promise.all(SOURCES.map(collecte))

// Two keys, because the same item shows up twice in two ways: the same link
// republished by two feeds, and a recurring untitled notice ("Avis de
// parution") posted under a different link each week.
const liens = new Set()
const titres = new Set()
const tous = lots
  .flat()
  .filter((article) => {
    const lien = article.lien.replace(/[?#].*$/, '')
    const titre = article.titre.toLowerCase().replace(/[^a-z0-9àâäéèêëîïôöùûüç]+/g, ' ').trim()
    if (liens.has(lien) || titres.has(titre)) return false
    liens.add(lien)
    titres.add(titre)
    return true
  })
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

/**
 * Fills a category one article per source at a time, most recent first within
 * each source. Taking the N most recent articles outright would hand every
 * slot to whoever publishes most often: a feed posting six times a day buries
 * a research institute that posts twice a month, and the category ends up
 * being one publication rather than a panorama.
 */
function tourniquet(candidats, places) {
  const parSource = new Map()
  for (const article of candidats) {
    if (!parSource.has(article.source)) parSource.set(article.source, [])
    parSource.get(article.source).push(article)
  }
  const files = [...parSource.values()]
  const retenus = []
  while (retenus.length < places && files.some((file) => file.length > 0)) {
    // Within a round, the source whose next article is the most recent goes
    // first, so the head of the list stays genuinely fresh.
    files
      .filter((file) => file.length > 0)
      .sort((a, b) => (b[0].date ?? '').localeCompare(a[0].date ?? ''))
      .forEach((file) => {
        if (retenus.length < places) retenus.push(file.shift())
      })
  }
  return retenus
}

const articles = []
for (const categorie of Object.keys(CATEGORIES)) {
  articles.push(...tourniquet(tous.filter((article) => article.categorie === categorie), PAR_CATEGORIE))
}
articles.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

for (const [cle, libelle] of Object.entries(CATEGORIES)) {
  console.log(`  ${libelle} : ${articles.filter((a) => a.categorie === cle).length} articles`)
}

await mkdir(dirname(sortie), { recursive: true })
await writeFile(sortie, JSON.stringify({ collecteLe: new Date().toISOString(), categories: CATEGORIES, articles }, null, 0), 'utf8')
console.log(`${articles.length} articles écrits dans ${sortie}`)
