import { findNearestBathingSite } from '../lib/baignade'
import { cached, pointKey } from '../lib/cache'
import { fetchEauPotable, limitesRespectees } from '../lib/eauPotable'
import { formatDistance } from '../lib/geo'
import { fetchPrelevements, findNearestAdesPoint, findNearestStationPiscicole, findNearestStationRiviere } from '../lib/hubeau'
import { findNearestPpe } from '../lib/ppe'
import { findReseauHydro } from '../lib/reseauHydro'
import { fetchRestrictions, GRAVITE_LABEL, sortBySeverityDesc, TYPE_LABEL } from '../lib/vigieau'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation, situationHydro } from './common'

const RAYON_M = 3000
/** Bathing, fishing and water-quality stations are sparse: a 3 km window
 * usually finds none at all, which reads as "nothing here" when it only means
 * "nothing that close". These three are searched wider, and the radius is
 * always stated alongside the result. */
const RAYON_USAGES_M = 10000
const PPE_PERTINENT_M = 5000

const COULEURS = {
  coursDEau: '#1f6bbf',
  coursDEauNomme: '#0f4c81',
  station: '#0f4c81',
  piscicole: '#2a6b8f',
  baignade: '#2a9d8f',
  captage: '#7a4bbf',
  prelevement: '#a3671a',
}

/** Sandre permalink for a surface-water monitoring station — the official
 * reference page, verified reachable (the Naïades web app's own deep links
 * are client-side routes that do not resolve on their own). */
function ficheStation(code: string): string {
  return `https://id.eaufrance.fr/StationMesureEauxSurface/${encodeURIComponent(code)}`
}

export async function buildEau(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [reseau, potable, station, piscicole, baignade, restrictions, ppe, prelevements, ades] = await Promise.all([
    safe(cached(pointKey('reseau-hydro', lat, lon), () => findReseauHydro(lat, lon))),
    safe(fetchEauPotable(site.citycode)),
    safe(findNearestStationRiviere(lat, lon, RAYON_USAGES_M)),
    safe(findNearestStationPiscicole(lat, lon, RAYON_USAGES_M)),
    safe(findNearestBathingSite(lat, lon)),
    safe(fetchRestrictions(lat, lon)),
    safe(findNearestPpe(lat, lon)),
    safe(fetchPrelevements(lat, lon, RAYON_M)),
    safe(findNearestAdesPoint(lat, lon)),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  // ---- Réseau hydrographique : le cadre de lecture amont/aval -------------

  if (reseau) {
    features.push({ kind: 'line', path: reseau.path, label: reseau.nom ?? "Cours d'eau sans toponyme", color: COULEURS.coursDEau, group: "Cours d'eau le plus proche" })
    if (reseau.premierNomme) {
      features.push({
        kind: 'line',
        path: reseau.premierNomme.path,
        label: reseau.premierNomme.nom,
        color: COULEURS.coursDEauNomme,
        group: "Cours d'eau nommé le plus proche",
      })
    }

    indicateurs.push({
      label: "Cours d'eau le plus proche",
      value: reseau.nom ?? 'Sans toponyme (BD TOPO®)',
      situation: situation(reseau.distanceM, reseau.direction),
      detail: reseau.flowKnown ? "Sens d'écoulement renseigné (BD TOPO®)" : "Sens d'écoulement non renseigné à cet endroit",
      level: reseau.distanceM < 150 ? 'attention' : 'favorable',
    })

    if (reseau.premierNomme) {
      indicateurs.push({
        label: "Cours d'eau nommé le plus proche",
        value: reseau.premierNomme.nom,
        situation: situation(reseau.premierNomme.distanceM, reseau.premierNomme.direction),
        detail: "Le cours d'eau le plus proche ne porte pas de toponyme dans la BD TOPO® : celui-ci est le plus proche à en avoir un.",
        level: reseau.premierNomme.distanceM < 150 ? 'attention' : 'favorable',
      })
    }

    const nomPhrase = reseau.nom
      ? `Le cours d'eau le plus proche, ${reseau.nom},`
      : "Le cours d'eau le plus proche ne porte pas de toponyme dans la BD TOPO®. Il"
    commentaire.push(
      `${nomPhrase} s'écoule ${situation(reseau.distanceM, reseau.direction)}.` +
        (reseau.premierNomme
          ? ` Le premier cours d'eau nommé est ${reseau.premierNomme.nom}, ${situation(reseau.premierNomme.distanceM, reseau.premierNomme.direction)}.`
          : '') +
        (reseau.flowKnown
          ? " Son sens d'écoulement est renseigné par la BD TOPO®, ce qui permet de situer les points de mesure et les usages en amont ou en aval hydraulique du site."
          : " Son sens d'écoulement n'est pas renseigné à cet endroit : aucune lecture amont/aval n'est proposée ci-dessous."),
    )
  } else {
    commentaire.push("Aucun cours d'eau n'a pu être localisé à proximité du site dans la BD TOPO® : la lecture amont/aval n'est pas possible ici.")
    lacunes.push("Réseau hydrographique non trouvé à proximité — les positions amont/aval ne sont pas calculées.")
  }

  // ---- Eau potable communale ---------------------------------------------

  if (potable) {
    const limites = limitesRespectees(potable)
    const referencesKo = potable.conformiteReferencesBact === false || potable.conformiteReferencesChimie === false
    indicateurs.push({
      label: 'Eau potable distribuée (commune)',
      value: limites === null ? 'Non déterminé' : limites ? 'Conforme aux limites' : 'Non conforme aux limites',
      situation: potable.nomUdi ? `Réseau ${potable.nomUdi}` : undefined,
      detail:
        `${pluriel(potable.nombreParametres, 'paramètre')} analysés` +
        (potable.datePrelevement ? ` lors du prélèvement du ${new Date(potable.datePrelevement).toLocaleDateString('fr-FR')}` : '') +
        (potable.conclusion ? `. ${potable.conclusion}` : '.'),
      level: limites === null ? 'inconnu' : !limites ? 'defavorable' : referencesKo ? 'attention' : 'favorable',
    })
    commentaire.push(
      `L'eau distribuée sur la commune${potable.nomUdi ? ` par le réseau ${potable.nomUdi}` : ''} a fait l'objet d'un contrôle sanitaire portant sur ` +
        `${pluriel(potable.nombreParametres, 'paramètre')}. ` +
        (limites === false
          ? 'Le prélèvement le plus récent est déclaré non conforme aux limites de qualité — ce sont les seuils sanitaires opposables.'
          : referencesKo
            ? 'Le prélèvement le plus récent respecte les limites de qualité (seuils sanitaires opposables) mais pas toutes les références de qualité, qui sont indicatives.'
            : 'Le prélèvement le plus récent respecte les limites et références de qualité.'),
    )
  } else {
    indicateurs.push({ label: 'Eau potable distribuée (commune)', value: 'Donnée indisponible', level: 'inconnu' })
    lacunes.push("Contrôle sanitaire de l'eau potable non disponible pour cette commune via Hub'Eau.")
  }

  // ---- Qualité du cours d'eau --------------------------------------------

  if (station) {
    features.push({
      kind: 'point',
      lat: station.lat,
      lon: station.lon,
      label: `Station qualité — ${station.libelle ?? station.code}`,
      color: COULEURS.station,
      group: 'Station qualité rivière',
    })
    const situationStation = situationHydro(station.distanceM, station.direction, reseau, station.lat, station.lon)
    indicateurs.push({
      label: "Qualité du cours d'eau (station la plus proche)",
      value: `${station.nombreParametres} paramètres suivis`,
      situation: situationStation,
      detail:
        `Station ${station.libelle ?? station.code}${station.nomCoursEau ? ` sur ${station.nomCoursEau}` : ''}` +
        (station.derniereDate ? `, dernier prélèvement le ${new Date(station.derniereDate).toLocaleDateString('fr-FR')}` : '') +
        ` (4 dernières années).`,
      level: 'favorable',
      href: ficheStation(station.code),
    })
    commentaire.push(
      `Le suivi physico-chimique le plus proche est réalisé ${situationStation} : ${station.nombreParametres} paramètres y ont été mesurés ` +
        `sur les quatre dernières années. Les valeurs y décrivent l'état du cours d'eau au point de mesure, pas nécessairement au droit du site.`,
    )
  } else {
    indicateurs.push({
      label: "Qualité du cours d'eau",
      value: 'Aucune station',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_USAGES_M)}`,
      level: 'inconnu',
    })
  }

  // ---- Intérêt piscicole --------------------------------------------------

  if (piscicole && piscicole.especes.length > 0) {
    features.push({
      kind: 'point',
      lat: piscicole.lat,
      lon: piscicole.lon,
      label: `Inventaire piscicole — ${piscicole.libelle ?? piscicole.code}`,
      color: COULEURS.piscicole,
      group: 'Station piscicole',
    })
    indicateurs.push({
      label: 'Peuplement piscicole (station la plus proche)',
      value: pluriel(piscicole.especes.length, 'espèce', 'espèces'),
      situation: situationHydro(piscicole.distanceM, piscicole.direction, reseau, piscicole.lat, piscicole.lon),
      detail:
        `${piscicole.especes.slice(0, 10).join(', ')}${piscicole.especes.length > 10 ? '…' : ''}. ` +
        `Station ${piscicole.libelle ?? piscicole.code}` +
        (piscicole.dernierInventaire ? `, dernier inventaire le ${new Date(piscicole.dernierInventaire).toLocaleDateString('fr-FR')}` : '') +
        `. Recherche dans un rayon de ${formatDistance(RAYON_USAGES_M)}.`,
      level: 'favorable',
      href: ficheStation(piscicole.code),
    })
    commentaire.push(
      `${pluriel(piscicole.especes.length, 'espèce de poisson', 'espèces de poissons')} ont été recensées à la station d'inventaire la plus proche ` +
        `(${piscicole.libelle ?? piscicole.code}). Ce réseau relève de la pêche scientifique à l'électricité : il décrit le peuplement du cours d'eau, ` +
        `et donc son intérêt halieutique, mais ne recense ni les parcours de pêche ni les lots de pêche, qui ne font l'objet d'aucune base nationale ouverte.`,
    )
  } else {
    indicateurs.push({
      label: 'Peuplement piscicole',
      value: 'Aucune station',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_USAGES_M)}`,
      level: 'inconnu',
    })
  }

  // ---- Baignade (eau douce et eau de mer) ---------------------------------

  if (baignade && baignade.distanceM <= RAYON_USAGES_M) {
    features.push({ kind: 'point', lat: baignade.lat, lon: baignade.lon, label: `Baignade — ${baignade.nom}`, color: COULEURS.baignade, group: 'Site de baignade' })
    indicateurs.push({
      label: 'Site de baignade officiel le plus proche',
      value: baignade.nom,
      situation: situationHydro(baignade.distanceM, baignade.direction, reseau, baignade.lat, baignade.lon),
      detail:
        [baignade.commune, baignade.typeEau].filter(Boolean).join(' — ') +
        ` — recensement national (eaux douces et eaux de mer), rayon de recherche ${formatDistance(RAYON_USAGES_M)}.`,
      level: baignade.distanceM <= 1000 ? 'attention' : 'favorable',
      href: 'https://baignades.sante.gouv.fr/baignades/editorial/fr/accueil.html',
    })
  } else {
    indicateurs.push({
      label: 'Site de baignade officiel',
      value: 'Aucun recensé',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_USAGES_M)}`,
      detail:
        'Le recensement couvre les baignades en eau douce comme en eau de mer' +
        (baignade ? `. Le plus proche se situe à ${formatDistance(baignade.distanceM)}, au-delà du rayon de recherche.` : '.'),
      level: 'favorable',
      href: 'https://baignades.sante.gouv.fr/baignades/editorial/fr/accueil.html',
    })
  }

  // ---- Restrictions d'eau (VigiEau) --------------------------------------

  if (restrictions === null) {
    indicateurs.push({ label: "Restrictions d'eau en vigueur", value: 'Donnée indisponible', level: 'inconnu' })
  } else if (restrictions.length === 0) {
    indicateurs.push({
      label: "Restrictions d'eau en vigueur",
      value: 'Aucune zone d’alerte active',
      detail: "Aucun arrêté de restriction ne s'applique à cette adresse aujourd'hui.",
      level: 'favorable',
      href: 'https://vigieau.gouv.fr/',
    })
  } else {
    const sorted = sortBySeverityDesc(restrictions)
    const worst = sorted[0]
    indicateurs.push({
      label: "Restrictions d'eau en vigueur",
      value: GRAVITE_LABEL[worst.niveauGravite],
      situation: `${worst.nom} (${TYPE_LABEL[worst.type]})`,
      detail: sorted.map((zone) => `${TYPE_LABEL[zone.type]} : ${GRAVITE_LABEL[zone.niveauGravite]}`).join(' · '),
      level: worst.niveauGravite === 'vigilance' ? 'attention' : 'defavorable',
      href: 'https://vigieau.gouv.fr/',
    })
    commentaire.push(
      `Un arrêté de restriction est en vigueur à cette adresse : ${sorted
        .map((zone) => `${TYPE_LABEL[zone.type].toLowerCase()} en ${GRAVITE_LABEL[zone.niveauGravite].toLowerCase()}`)
        .join(', ')}.`,
    )
  }

  // ---- Captages et prélèvements ------------------------------------------

  if (ppe) {
    const pertinent = ppe.inside || ppe.distanceM <= PPE_PERTINENT_M
    indicateurs.push({
      label: 'Périmètre de protection de captage',
      value: ppe.inside ? 'Site inclus dans un périmètre' : pertinent ? 'Hors périmètre' : `Aucun à moins de ${formatDistance(PPE_PERTINENT_M)}`,
      situation: ppe.inside
        ? 'Le site est situé à l’intérieur du périmètre de protection éloignée'
        : pertinent
          ? situation(ppe.distanceM, ppe.direction)
          : undefined,
      // No fiche link: `ins_cap_ref` is an ARS/SISE-Eaux captage code
      // ("001000220"), not a BSS borehole code — verified against the export —
      // so the ADES fiche it used to point at never resolved. The reference is
      // given as text instead, which is what a préfecture or ARS will ask for.
      detail: pertinent
        ? [ppe.captageRef ? `Référence captage ARS ${ppe.captageRef}` : null, ppe.etatProcedure].filter(Boolean).join(' — ') || undefined
        : undefined,
      level: ppe.inside ? 'defavorable' : ppe.distanceM < 500 ? 'attention' : 'favorable',
    })
    if (ppe.inside) {
      commentaire.push(
        "Le site est situé à l'intérieur d'un périmètre de protection éloignée de captage d'eau destinée à la consommation humaine : " +
          "des prescriptions spécifiques peuvent s'appliquer aux activités et aux rejets.",
      )
    }
  }

  if (prelevements && prelevements.length > 0) {
    for (const ouvrage of prelevements.slice(0, 40)) {
      features.push({
        kind: 'point',
        lat: ouvrage.lat,
        lon: ouvrage.lon,
        label: `Prélèvement — ${ouvrage.nom ?? 'ouvrage'}${ouvrage.usage ? ` (${ouvrage.usage})` : ''}`,
        color: COULEURS.prelevement,
        group: 'Ouvrage de prélèvement',
      })
    }
    const closest = prelevements[0]
    indicateurs.push({
      label: 'Ouvrages de prélèvement recensés',
      value: pluriel(prelevements.length, 'ouvrage'),
      situation: `Le plus proche ${situation(closest.distanceM, closest.direction)}`,
      detail: `Dans un rayon de ${formatDistance(RAYON_M)}. ${closest.usage ? `Usage du plus proche : ${closest.usage}.` : ''}`,
      level: prelevements.length > 5 ? 'attention' : 'favorable',
    })
  } else if (prelevements) {
    indicateurs.push({
      label: 'Ouvrages de prélèvement recensés',
      value: 'Aucun',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_M)}`,
      level: 'favorable',
    })
  }

  if (ades) {
    features.push({ kind: 'point', lat: ades.lat, lon: ades.lon, label: `Point ADES ${ades.codeBss}`, color: COULEURS.captage, group: 'Point de suivi des nappes' })
    const entite = ades.entitesHydrogeologiques[0] ?? null
    indicateurs.push({
      label: 'Nappe souterraine (point ADES le plus proche)',
      value: entite ?? ades.aquifere ?? 'Entité hydrogéologique non précisée',
      situation: situation(ades.distanceM, ades.direction),
      detail:
        [
          ades.profondeurNappeM !== null ? `Profondeur de nappe mesurée : ${ades.profondeurNappeM.toFixed(1)} m` : 'Profondeur de nappe non mesurée',
          ades.nature,
          `réf. BSS ${ades.codeBss}`,
        ]
          .filter(Boolean)
          .join(' — '),
      level: ades.distanceM > 1000 ? 'inconnu' : ades.profondeurNappeM !== null && ades.profondeurNappeM < 5 ? 'attention' : 'favorable',
      // The fiche is keyed on the modern BSS identifier (BSS001GVLA), not on
      // the historical code ("04817X1698/PZ3") — verified live.
      href: ades.bssId ? `https://ades.eaufrance.fr/Fiche/PtEau?Code=${encodeURIComponent(ades.bssId)}` : undefined,
    })
    if (entite) {
      commentaire.push(
        `Le point de suivi des eaux souterraines le plus proche capte l'entité hydrogéologique « ${entite} » ` +
          `(${situation(ades.distanceM, ades.direction)}). C'est le nom sous lequel la nappe est décrite dans le référentiel BDLISA.`,
      )
    }
  }

  lacunes.push(
    "La perméabilité des terrains entre la surface et la nappe n'est pas accessible en données ouvertes à l'échelle d'une parcelle : elle module pourtant fortement la vulnérabilité de la nappe.",
    "Les parcours et lots de pêche, ainsi que les bases nautiques, ne font l'objet d'aucune base nationale ouverte : seul le peuplement piscicole issu des inventaires scientifiques est restitué ici.",
    "Le contrôle sanitaire de l'eau potable est publié par commune, pas par adresse : une commune desservie par plusieurs réseaux peut présenter des résultats différents selon le quartier.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_USAGES_M,
    sources: [
      { label: "Hub'Eau — Qualité de l'eau potable (ARS)", href: 'https://hubeau.eaufrance.fr/page/api-qualite-eau-potable', note: 'contrôle sanitaire, par commune' },
      { label: "Hub'Eau — Qualité des cours d'eau", href: 'https://hubeau.eaufrance.fr/page/api-qualite-cours-deau', note: 'stations et analyses physico-chimiques' },
      { label: "Hub'Eau — Poisson (état piscicole)", href: 'https://hubeau.eaufrance.fr/page/api-poisson', note: 'inventaires par pêche électrique' },
      { label: "Hub'Eau — Prélèvements en eau", href: 'https://hubeau.eaufrance.fr/page/api-prelevements-eau' },
      { label: 'ADES / BDLISA — eaux souterraines', href: 'https://ades.eaufrance.fr/', note: 'niveau, qualité et entité hydrogéologique' },
      { label: 'VigiEau — restrictions en vigueur', href: 'https://vigieau.gouv.fr/', note: "arrêtés sécheresse applicables à l'adresse" },
      { label: 'Baignades — Ministère de la Santé', href: 'https://baignades.sante.gouv.fr/', note: 'eaux douces et eaux de mer' },
      { label: 'IGN BD TOPO® — réseau hydrographique', href: 'https://geoservices.ign.fr/bdtopo', note: "tracé et sens d'écoulement des cours d'eau" },
    ],
  }
}
