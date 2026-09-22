import { findNearestBathingSite } from '../lib/baignade'
import { cached, pointKey } from '../lib/cache'
import { fetchEauPotable, limitesRespectees } from '../lib/eauPotable'
import { formatDistance } from '../lib/geo'
import { fetchPrelevements, findNearestAdesPoint, findNearestStationRiviere } from '../lib/hubeau'
import { findNearestPpe } from '../lib/ppe'
import { findReseauHydro } from '../lib/reseauHydro'
import { fetchRestrictions, GRAVITE_LABEL, sortBySeverityDesc, TYPE_LABEL } from '../lib/vigieau'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation, situationHydro } from './common'

const RAYON_M = 3000

const COULEURS = {
  coursDEau: '#1f6bbf',
  station: '#0f4c81',
  baignade: '#2a9d8f',
  captage: '#7a4bbf',
  prelevement: '#a3671a',
}

export async function buildEau(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [reseau, potable, station, baignade, restrictions, ppe, prelevements, ades] = await Promise.all([
    safe(cached(pointKey('reseau-hydro', lat, lon), () => findReseauHydro(lat, lon))),
    safe(fetchEauPotable(site.citycode)),
    safe(findNearestStationRiviere(lat, lon)),
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
    features.push({ kind: 'line', path: reseau.path, label: reseau.nom ?? "Cours d'eau", color: COULEURS.coursDEau, group: "Cours d'eau" })
    const nom = reseau.nom ? `Le cours d'eau le plus proche, ${reseau.nom},` : "Le cours d'eau le plus proche"
    commentaire.push(
      `${nom} s'écoule ${situation(reseau.distanceM, reseau.direction).replace(/^à /, 'à ')}.` +
        (reseau.flowKnown
          ? " Son sens d'écoulement est renseigné par la BD TOPO®, ce qui permet de situer les points de mesure et les usages en amont ou en aval hydraulique du site."
          : " Son sens d'écoulement n'est pas renseigné à cet endroit : aucune lecture amont/aval n'est proposée ci-dessous."),
    )
    indicateurs.push({
      label: "Cours d'eau le plus proche",
      value: reseau.nom ?? 'Non nommé',
      situation: situation(reseau.distanceM, reseau.direction),
      detail: reseau.flowKnown ? "Sens d'écoulement renseigné (BD TOPO®)" : "Sens d'écoulement non renseigné à cet endroit",
      level: reseau.distanceM < 150 ? 'attention' : 'favorable',
    })
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
      href: 'https://orobnat.sante.gouv.fr/orobnat/rechercherResultatQualite.do',
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
      level: station.distanceM > 10000 ? 'inconnu' : 'favorable',
      href: `https://www.naiades.eaufrance.fr/acces-donnees#/stations/${encodeURIComponent(station.code)}`,
    })
    commentaire.push(
      `Le suivi physico-chimique le plus proche est réalisé ${situationStation} : ${station.nombreParametres} paramètres y ont été mesurés ` +
        `sur les quatre dernières années. ` +
        (station.distanceM > 10000
          ? "Cette station est trop éloignée pour être représentative du cours d'eau au droit du site ; elle est citée à titre de contexte de bassin."
          : "Les valeurs y décrivent l'état du cours d'eau au point de mesure, pas nécessairement au droit du site."),
    )
  } else {
    indicateurs.push({ label: "Qualité du cours d'eau", value: 'Aucune station à proximité', level: 'inconnu' })
  }

  // ---- Baignade -----------------------------------------------------------

  if (baignade) {
    features.push({ kind: 'point', lat: baignade.lat, lon: baignade.lon, label: `Baignade — ${baignade.nom}`, color: COULEURS.baignade, group: 'Site de baignade' })
    indicateurs.push({
      label: 'Site de baignade officiel le plus proche',
      value: baignade.nom,
      situation: situationHydro(baignade.distanceM, baignade.direction, reseau, baignade.lat, baignade.lon),
      detail: [baignade.commune, baignade.typeEau].filter(Boolean).join(' — ') || undefined,
      level: baignade.distanceM <= 1000 ? 'attention' : 'favorable',
      href: 'https://baignades.sante.gouv.fr/',
    })
  } else {
    indicateurs.push({ label: 'Site de baignade officiel', value: 'Aucun recensé à proximité', level: 'favorable' })
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

  // The PPE export is national, so the "nearest" perimeter can be tens of
  // kilometres away — a distance that says nothing about this site. Past this
  // range the honest reading is simply that there is none nearby.
  const PPE_PERTINENT_M = 5000
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
      detail: pertinent ? [ppe.captageRef ? `Captage ${ppe.captageRef}` : null, ppe.etatProcedure].filter(Boolean).join(' — ') || undefined : undefined,
      level: ppe.inside ? 'defavorable' : ppe.distanceM < 500 ? 'attention' : 'favorable',
      href: pertinent ? (ppe.adesUrl ?? undefined) : undefined,
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
      detail: `Aucun ouvrage recensé dans un rayon de ${formatDistance(RAYON_M)}.`,
      level: 'favorable',
    })
  }

  if (ades) {
    features.push({ kind: 'point', lat: ades.lat, lon: ades.lon, label: `Point ADES ${ades.codeBss}`, color: COULEURS.captage, group: 'Point de suivi des nappes' })
    indicateurs.push({
      label: 'Nappe souterraine (point ADES le plus proche)',
      value: ades.profondeurNappeM !== null ? `${ades.profondeurNappeM.toFixed(1)} m de profondeur` : 'Profondeur non mesurée',
      situation: situation(ades.distanceM, ades.direction),
      detail: [ades.aquifere, ades.nature, `réf. ${ades.codeBss}`].filter(Boolean).join(' — '),
      level: ades.distanceM > 1000 ? 'inconnu' : ades.profondeurNappeM !== null && ades.profondeurNappeM < 5 ? 'attention' : 'favorable',
      href: `https://ades.eaufrance.fr/Fiche/PtEau?Code=${encodeURIComponent(ades.codeBss.split('/')[0])}`,
    })
  }

  lacunes.push(
    "La perméabilité des terrains entre la surface et la nappe n'est pas accessible en données ouvertes à l'échelle d'une parcelle : elle module pourtant fortement la vulnérabilité de la nappe.",
    "Les usages récréatifs hors baignade officielle (pêche de loisir, bases nautiques) ne font l'objet d'aucune base nationale ouverte.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: "Hub'Eau — Qualité de l'eau potable (ARS)", href: 'https://hubeau.eaufrance.fr/page/api-qualite-eau-potable', note: 'contrôle sanitaire, par commune' },
      { label: "Hub'Eau — Qualité des cours d'eau", href: 'https://hubeau.eaufrance.fr/page/api-qualite-cours-deau', note: 'stations et analyses physico-chimiques' },
      { label: "Hub'Eau — Prélèvements en eau", href: 'https://hubeau.eaufrance.fr/page/api-prelevements-eau' },
      { label: 'ADES — Accès aux données sur les eaux souterraines', href: 'https://ades.eaufrance.fr/', note: 'niveau et qualité des nappes' },
      { label: 'VigiEau — restrictions en vigueur', href: 'https://vigieau.gouv.fr/', note: "arrêtés sécheresse applicables à l'adresse" },
      { label: 'Baignades — Ministère de la Santé', href: 'https://baignades.sante.gouv.fr/', note: 'sites de baignade recensés' },
      { label: 'IGN BD TOPO® — réseau hydrographique', href: 'https://geoservices.ign.fr/bdtopo', note: "tracé et sens d'écoulement des cours d'eau" },
    ],
  }
}
