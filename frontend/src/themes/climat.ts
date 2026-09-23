import { cached, pointKey } from '../lib/cache'
import { fetchCommuneErosion } from '../lib/erosion'
import { ecart, fetchProjectionClimatique } from '../lib/climat'
import { formatDistance } from '../lib/geo'
import { fetchCatnatInondation, fetchRisquesCommune, inAzi, parseFrenchDate } from '../lib/georisques'
import { findReseauHydro } from '../lib/reseauHydro'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe } from './common'

const RAYON_M = 2000

/** Risk families from GASPAR that this rubrique reads as climate-driven. */
const MOTS_CLES = {
  inondation: /inondation|submersion|coulée de boue|ruissellement|remontée/i,
  littoral: /trait de côte|érosion|recul du trait|submersion marine/i,
  feu: /feu de for[êe]t|incendie/i,
  secheresse: /sécheresse|retrait.gonflement|argile/i,
}

export async function buildClimat(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [projection, risques, catnat, azi, reseau, erosion] = await Promise.all([
    safe(fetchProjectionClimatique(lat, lon)),
    safe(cached(`risques-commune:${site.citycode}`, () => fetchRisquesCommune(site.citycode))),
    safe(fetchCatnatInondation(site.citycode)),
    safe(inAzi(lat, lon, RAYON_M)),
    safe(cached(pointKey('reseau-hydro', lat, lon), () => findReseauHydro(lat, lon))),
    safe(fetchCommuneErosion(site.citycode)),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  if (reseau) {
    features.push({ kind: 'line', path: reseau.path, label: reseau.nom ?? "Cours d'eau", color: '#1f6bbf', group: "Cours d'eau" })
  }

  // ---- Trajectoire climatique à 2050 -------------------------------------

  if (projection) {
    const { reference, future, modele } = projection
    indicateurs.push({
      label: 'Température moyenne annuelle',
      value: `${future.temperatureMoyenne.toFixed(1)} °C en ${future.debut}–${future.fin}`,
      situation: `${ecart(future.temperatureMoyenne, reference.temperatureMoyenne, '°C')} par rapport à ${reference.debut}–${reference.fin}`,
      detail: `Référence ${reference.debut}–${reference.fin} : ${reference.temperatureMoyenne.toFixed(1)} °C. Modèle ${modele}.`,
      level: future.temperatureMoyenne - reference.temperatureMoyenne > 2 ? 'defavorable' : 'attention',
    })
    indicateurs.push({
      label: 'Journées de forte chaleur (> 30 °C)',
      value: `${future.joursChauds.toFixed(0)} jours/an à l'horizon 2050`,
      situation: `${ecart(future.joursChauds, reference.joursChauds, 'jours', 0)} par rapport à la référence`,
      detail: `Référence ${reference.debut}–${reference.fin} : ${reference.joursChauds.toFixed(0)} jours par an.`,
      level: future.joursChauds > 30 ? 'defavorable' : future.joursChauds > 10 ? 'attention' : 'favorable',
    })
    indicateurs.push({
      label: 'Journées de chaleur extrême (> 35 °C)',
      value: `${future.joursTresChauds.toFixed(0)} jours/an à l'horizon 2050`,
      situation: `${ecart(future.joursTresChauds, reference.joursTresChauds, 'jours', 0)} par rapport à la référence`,
      detail: 'Seuil à partir duquel la chaleur devient un enjeu sanitaire et non plus de confort.',
      level: future.joursTresChauds > 10 ? 'defavorable' : future.joursTresChauds > 2 ? 'attention' : 'favorable',
    })
    indicateurs.push({
      label: 'Précipitations annuelles',
      value: `${future.precipitations.toFixed(0)} mm/an à l'horizon 2050`,
      situation: `${ecart(future.precipitations, reference.precipitations, 'mm', 0)} par rapport à la référence`,
      detail: `Référence ${reference.debut}–${reference.fin} : ${reference.precipitations.toFixed(0)} mm par an.`,
    })

    const deltaT = future.temperatureMoyenne - reference.temperatureMoyenne
    const deltaChaud = future.joursChauds - reference.joursChauds
    commentaire.push(
      `À l'horizon 2050, le modèle ${modele} projette au droit du site une température moyenne annuelle de ` +
        `${future.temperatureMoyenne.toFixed(1)} °C, soit ${deltaT > 0 ? '+' : ''}${deltaT.toFixed(1)} °C par rapport à la période de référence ` +
        `${reference.debut}–${reference.fin}, et ${future.joursChauds.toFixed(0)} journées par an au-dessus de 30 °C ` +
        `(${deltaChaud > 0 ? '+' : ''}${deltaChaud.toFixed(0)} jours). ` +
        `Les deux périodes sont issues du même modèle, ce qui isole le signal climatique de l'écart entre produits de données.`,
    )
  }
  // Rien n'est affiché quand la projection est indisponible : une ligne
  // "donnée indisponible" pour quatre indicateurs climatiques n'apprend rien
  // et occupe la place de ce qui, lui, est connu.

  // ---- Îlot de chaleur ----------------------------------------------------

  commentaire.push(
    `L'intensité d'un îlot de chaleur urbain dépend de l'imperméabilisation, de la morphologie du bâti et de la présence de végétation ` +
      `à l'échelle de quelques centaines de mètres. Aucun service national ouvert ne restitue cette intensité par adresse : les cartes ` +
      `existantes sont produites ville par ville. Les journées de forte chaleur ci-dessus donnent l'exposition climatique de fond, ` +
      `à laquelle s'ajoute localement l'effet urbain.`,
  )

  // ---- Inondation ---------------------------------------------------------

  const risqueInondation = risques?.filter((risque) => risque.famille && MOTS_CLES.inondation.test(risque.libelle)) ?? []
  const sousTypesInondation = risques?.filter((risque) => !risque.famille && MOTS_CLES.inondation.test(risque.libelle)) ?? []

  indicateurs.push({
    label: 'Risque inondation recensé sur la commune',
    value: risqueInondation.length > 0 ? 'Oui' : risques ? 'Non recensé' : 'Donnée indisponible',
    detail: sousTypesInondation.length > 0 ? sousTypesInondation.map((risque) => risque.libelle).join(' · ') : undefined,
    level: risqueInondation.length > 0 ? 'defavorable' : risques ? 'favorable' : 'inconnu',
  })

  if (azi !== null) {
    indicateurs.push({
      label: "Atlas des zones inondables",
      value: azi ? 'Le site est dans une zone couverte' : 'Aucune zone à proximité',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_M)}`,
      level: azi ? 'defavorable' : 'favorable',
    })
  }

  if (catnat && catnat.length > 0) {
    const dates = catnat.map((arrete) => parseFrenchDate(arrete.dateDebut)).filter((date): date is Date => date !== null)
    const dernier = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null
    indicateurs.push({
      label: 'Arrêtés de catastrophe naturelle — inondation',
      value: pluriel(catnat.length, 'arrêté'),
      situation: dernier ? `Le plus récent en ${dernier.getFullYear()}` : undefined,
      detail:
        "Chaque arrêté atteste d'un épisode d'inondation ou de coulée de boue reconnu sur la commune. " +
        `Références nationales : ${catnat
          .map((arrete) => arrete.codeNational)
          .filter(Boolean)
          .slice(0, 6)
          .join(', ')}.`,
      level: catnat.length > 5 ? 'defavorable' : 'attention',
      href: 'https://www.georisques.gouv.fr/le-dispositif-dindemnisation-des-catastrophes-naturelles',
    })
    commentaire.push(
      `La commune a fait l'objet de ${pluriel(catnat.length, 'arrêté')} de catastrophe naturelle pour inondation ou coulée de boue` +
        `${dernier ? `, le plus récent en ${dernier.getFullYear()}` : ''}. ` +
        `Ces arrêtés constituent la trace administrative d'épisodes réellement survenus, et non une modélisation.`,
    )
  } else if (catnat) {
    indicateurs.push({ label: 'Arrêtés de catastrophe naturelle — inondation', value: 'Aucun', level: 'favorable' })
  }

  // ---- Feux de forêt et littoral -----------------------------------------

  const risqueFeu = risques?.some((risque) => MOTS_CLES.feu.test(risque.libelle)) ?? null
  indicateurs.push({
    label: 'Risque feu de forêt recensé sur la commune',
    value: risqueFeu === null ? 'Donnée indisponible' : risqueFeu ? 'Oui' : 'Non recensé',
    detail:
      risqueFeu === true
        ? "L'aléa feu de forêt est appelé à s'étendre : la saison à risque s'allonge et gagne des régions jusqu'ici peu concernées."
        : undefined,
    level: risqueFeu === null ? 'inconnu' : risqueFeu ? 'defavorable' : 'favorable',
  })

  const risqueLittoral = risques?.some((risque) => MOTS_CLES.littoral.test(risque.libelle)) ?? null
  indicateurs.push({
    label: 'Recul du trait de côte (liste fixée par décret)',
    value: erosion ? 'Commune inscrite au décret' : 'Commune non inscrite',
    situation: erosion?.statut ?? undefined,
    detail: erosion
      ? "La commune figure sur la liste nationale des communes devant adapter leur urbanisme au recul du trait de côte : cartographie locale de l'aléa à 30 et 100 ans, et inscription au document d'urbanisme."
      : "La commune ne figure pas sur la liste nationale des communes devant s'adapter au recul du trait de côte.",
    level: erosion ? 'defavorable' : 'favorable',
    href: erosion?.decret ?? undefined,
  })

  if (risqueLittoral) {
    indicateurs.push({
      label: 'Submersion marine / érosion (GASPAR)',
      value: 'Risque recensé sur la commune',
      detail: "Recensement des risques majeurs de la commune. L'indicateur national d'érosion côtière du Cerema donne l'évolution mesurée du trait de côte.",
      level: 'defavorable',
      href: 'https://www.cerema.fr/fr/actualites/indicateur-national-erosion-cotiere',
    })
  }

  const risqueSecheresse = risques?.some((risque) => MOTS_CLES.secheresse.test(risque.libelle)) ?? null
  if (risqueSecheresse) {
    indicateurs.push({
      label: 'Retrait-gonflement des argiles',
      value: 'Commune concernée',
      detail:
        "Aléa aggravé par la succession de sécheresses : il affecte les fondations des bâtiments et constitue le premier poste d'indemnisation catastrophe naturelle.",
      level: 'attention',
    })
  }

  lacunes.push(
    "Le recul du trait de côte n'est pas mesuré ici à l'adresse : l'indicateur national du Cerema est diffusé par linéaire côtier et son service ne peut pas être interrogé depuis un navigateur. Seule l'inscription de la commune au décret est vérifiée.",
    "Les arrêtés de catastrophe naturelle sont identifiés par leur code national, mais aucun permalien public ne permet d'ouvrir directement le texte d'un arrêté donné : ils se retrouvent par ce code sur Géorisques ou au Journal officiel.",
    "L'aléa feu de forêt est restitué au niveau de la commune (base GASPAR), pas à l'échelle de la parcelle ni avec une projection 2050 : les cartes d'aléa projeté sont produites par massif, à l'échelle régionale.",
    "Les projections reposent sur un unique modèle climatique et un scénario d'émissions : elles décrivent un futur plausible, pas une prévision. Les portails DRIAS (Météo-France) permettent d'explorer l'éventail complet des modèles et scénarios.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Open-Meteo Climate API — CMIP6 régionalisé', href: 'https://open-meteo.com/en/docs/climate-api', note: 'projections à 2050, corrigées sur ERA5' },
      { label: 'DRIAS — les futurs du climat (Météo-France)', href: 'https://www.drias-climat.fr/', note: 'référence française, tous modèles et scénarios' },
      { label: 'Géorisques — risques de la commune (GASPAR)', href: 'https://www.georisques.gouv.fr/', note: 'inondation, feu de forêt, littoral' },
      { label: 'Géorisques — arrêtés de catastrophe naturelle', href: 'https://www.georisques.gouv.fr/le-dispositif-dindemnisation-des-catastrophes-naturelles' },
      { label: 'Cerema — indicateur national de l’érosion côtière', href: 'https://www.cerema.fr/fr/actualites/indicateur-national-erosion-cotiere' },
    ],
  }
}
