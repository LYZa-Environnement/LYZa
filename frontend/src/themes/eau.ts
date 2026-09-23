import { niveauQualiteBaignade, surveyBathingSites, type BathingSite } from '../lib/baignade'
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
/** How many bathing sites are detailed individually before the list is capped. */
const MAX_BAIGNADES_DETAILLEES = 15
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

/** Amont/aval only means something when the bathing site is on the same
 * watercourse as the study site. On a beach, a lake or an estuary the water
 * does not flow from one to the other in any useful sense, so those get the
 * distance and the direction alone. */
function situationBaignade(site: BathingSite, reseau: Parameters<typeof situationHydro>[2]): string {
  const enRiviere = /rivi[eè]re|cours d'eau/i.test(site.typeEau ?? '')
  return enRiviere ? situationHydro(site.distanceM, site.direction, reseau, site.lat, site.lon) : situation(site.distanceM, site.direction)
}

/** What is known about a bathing site beyond its classification: where it is,
 * when it is open, and what happened there during the last reported season. */
function detailBaignade(site: BathingSite, saison: number | null): string {
  const incidents: string[] = []
  if (site.interdictions > 0) incidents.push(pluriel(site.interdictions, "épisode d'interdiction sanitaire", "épisodes d'interdiction sanitaire"))
  if (site.cyanobacteries > 0) incidents.push(pluriel(site.cyanobacteries, 'épisode de prolifération de cyanobactéries', 'épisodes de prolifération de cyanobactéries'))
  if (site.pollutions > 0) incidents.push(pluriel(site.pollutions, 'épisode de pollution à court terme', 'épisodes de pollution à court terme'))

  return [
    [site.commune, site.typeEau].filter(Boolean).join(' — ') || null,
    site.saisonDebut && site.saisonFin ? `saison de baignade du ${site.saisonDebut} au ${site.saisonFin}` : null,
    incidents.length > 0
      ? `${incidents.join(', ')}${saison ? ` au cours de la saison ${saison}` : ''}`
      : saison
        ? `aucune fermeture ni prolifération signalée au cours de la saison ${saison}`
        : null,
    site.qualite
      ? null
      : "pas encore de classement : un site nouvellement identifié, ou trop peu d'analyses, n'est pas classé — ce n'est pas un mauvais résultat",
  ]
    .filter(Boolean)
    .join('. ')
}

export async function buildEau(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [reseau, potable, station, piscicole, baignade, restrictions, ppe, prelevements, ades] = await Promise.all([
    safe(cached(pointKey('reseau-hydro', lat, lon), () => findReseauHydro(lat, lon))),
    safe(fetchEauPotable(site.citycode)),
    safe(findNearestStationRiviere(lat, lon, RAYON_USAGES_M)),
    safe(findNearestStationPiscicole(lat, lon, RAYON_USAGES_M)),
    safe(surveyBathingSites(lat, lon, RAYON_USAGES_M)),
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

  if (baignade && baignade.sites.length > 0) {
    for (const site of baignade.sites.slice(0, 40)) {
      features.push({ kind: 'point', lat: site.lat, lon: site.lon, label: `Baignade — ${site.nom}`, color: COULEURS.baignade, group: 'Site de baignade' })
    }

    const proche = baignade.sites[0]
    const classes = baignade.sites.filter((site) => site.qualite !== null)
    const insuffisants = baignade.sites.filter((site) => site.qualite === 'Insuffisante')

    indicateurs.push({
      label: 'Sites de baignade officiels à proximité',
      value: pluriel(baignade.sites.length, 'site recensé', 'sites recensés'),
      situation: `Dans un rayon de ${formatDistance(RAYON_USAGES_M)}`,
      detail:
        `Le plus proche est ${proche.nom}, ${situationBaignade(proche, reseau)}. ` +
        (classes.length === 0
          ? "Aucun d'eux ne dispose encore d'un classement de la qualité de l'eau."
          : (classes.length === baignade.sites.length
              ? `Tous disposent d'un classement de la qualité de l'eau`
              : `${classes.length} d'entre eux ${classes.length > 1 ? 'disposent' : 'dispose'} d'un classement de la qualité de l'eau`) +
            `${baignade.saisonClassement ? ` pour la saison ${baignade.saisonClassement}` : ''}.` +
            (baignade.sites.length > MAX_BAIGNADES_DETAILLEES ? ` Les ${MAX_BAIGNADES_DETAILLEES} plus proches sont détaillés ci-dessous.` : '')),
      level: insuffisants.length > 0 ? 'defavorable' : proche.distanceM <= 1000 ? 'attention' : 'favorable',
      href: 'https://baignades.sante.gouv.fr/baignades/editorial/fr/accueil.html',
    })

    // One line per site: the quality classification is what a reader actually
    // wants from a bathing site, and a closure or a cyanobacteria bloom during
    // the season says more than the classification alone.
    for (const site of baignade.sites.slice(0, MAX_BAIGNADES_DETAILLEES)) {
      indicateurs.push({
        pliable: 'Détail des sites de baignade',
        label: site.nom,
        value: site.qualite ? `Qualité de l'eau ${site.qualite.toLowerCase()}` : 'Qualité non classée',
        situation: situationBaignade(site, reseau),
        detail: detailBaignade(site, baignade.saisonClassement),
        level: niveauQualiteBaignade(site.qualite),
      })
    }

    commentaire.push(
      `${pluriel(baignade.sites.length, 'site de baignade officiel', 'sites de baignade officiels')} ` +
        `${baignade.sites.length > 1 ? 'sont recensés' : 'est recensé'} dans un rayon de ${formatDistance(RAYON_USAGES_M)}, ` +
        `le plus proche (${proche.nom}) ${situationBaignade(proche, reseau)}. ` +
        `Le classement de la qualité de l'eau est établi sur les quatre saisons précédentes, à partir des analyses bactériologiques ` +
        `du contrôle sanitaire : il décrit une tendance, pas l'état de l'eau un jour donné.` +
        (insuffisants.length > 0
          ? ` ${pluriel(insuffisants.length, 'site', 'sites')} ${insuffisants.length > 1 ? 'sont classés' : 'est classé'} en qualité insuffisante, ` +
            `ce qui oblige la commune à identifier les sources de pollution et à en informer les baigneurs.`
          : ''),
    )
  } else {
    indicateurs.push({
      label: 'Sites de baignade officiels à proximité',
      value: 'Aucun recensé',
      situation: `Recherche dans un rayon de ${formatDistance(RAYON_USAGES_M)}`,
      detail:
        'Le recensement national du ministère de la Santé couvre les baignades en eau douce comme en eau de mer' +
        (baignade?.plusProche
          ? `. Le plus proche, ${baignade.plusProche.nom}${baignade.plusProche.commune ? ` (${baignade.plusProche.commune})` : ''}, se situe à ${formatDistance(baignade.plusProche.distanceM)} — au-delà du rayon de recherche.`
          : '.'),
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
        ? [ppe.captageRef ? `Référence du captage à l'agence régionale de santé : ${ppe.captageRef}` : null, ppe.etatProcedure].filter(Boolean).join(' — ') || undefined
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
    features.push({ kind: 'point', lat: ades.lat, lon: ades.lon, label: `Point de suivi des eaux souterraines ${ades.codeBss}`, color: COULEURS.captage, group: 'Point de suivi des nappes' })
    const entite = ades.entitesHydrogeologiques[0] ?? null
    indicateurs.push({
      label: 'Nappe souterraine (point de suivi le plus proche)',
      value: entite ?? ades.aquifere ?? 'Entité hydrogéologique non précisée',
      situation: situation(ades.distanceM, ades.direction),
      detail:
        [
          ades.profondeurNappeM !== null ? `Profondeur de nappe mesurée : ${ades.profondeurNappeM.toFixed(1)} m` : 'Profondeur de nappe non mesurée',
          ades.nature,
          `réf. banque du sous-sol ${ades.codeBss}`,
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
      { label: "Hub'Eau — Qualité de l'eau potable", href: 'https://hubeau.eaufrance.fr/page/api-qualite-eau-potable', note: 'contrôle sanitaire des agences régionales de santé (ARS), par commune' },
      { label: "Hub'Eau — Qualité des cours d'eau", href: 'https://hubeau.eaufrance.fr/page/api-qualite-cours-deau', note: 'stations et analyses physico-chimiques' },
      { label: "Hub'Eau — état piscicole", href: 'https://hubeau.eaufrance.fr/page/api-poisson', note: 'inventaires par pêche scientifique à l’électricité' },
      { label: "Hub'Eau — Prélèvements en eau", href: 'https://hubeau.eaufrance.fr/page/api-prelevements-eau' },
      { label: 'ADES — portail national d’accès aux données sur les eaux souterraines', href: 'https://ades.eaufrance.fr/', note: 'niveau, qualité et entité hydrogéologique (référentiel BDLISA)' },
      { label: 'VigiEau — restrictions en vigueur', href: 'https://vigieau.gouv.fr/', note: "arrêtés sécheresse applicables à l'adresse" },
      {
        label: 'Ministère de la Santé — rapportage de la saison balnéaire',
        href: 'https://baignades.sante.gouv.fr/',
        note: 'liste nationale des sites, classement de la qualité de l’eau et journal de la saison, eaux douces et eaux de mer',
      },
      { label: 'Institut national de l’information géographique et forestière (IGN), base de données BD TOPO® — réseau hydrographique', href: 'https://geoservices.ign.fr/bdtopo', note: "tracé et sens d'écoulement des cours d'eau" },
    ],
  }
}
