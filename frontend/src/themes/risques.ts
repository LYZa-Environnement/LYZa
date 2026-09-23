import { cached, pointKey } from '../lib/cache'
import { formatDistance } from '../lib/geo'
import {
  estSeveso,
  fetchCavites,
  fetchExpositionArgiles,
  fetchIcpe,
  fetchMvt,
  fetchPprn,
  fetchPprt,
  fetchRisquesCommune,
  radonClasse,
  zonageSismique,
} from '../lib/georisques'
import { findNearestInb } from '../lib/nucleaire'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 3000
/** How many installations are listed individually before the list is capped. */
const MAX_ICPE_DETAILLEES = 15

const COULEURS = {
  seveso: '#8c1d0f',
  icpe: '#c34a35',
  mvt: '#a3671a',
  cavite: '#7a4bbf',
  nucleaire: '#4b2ba0',
}

const RADON_LABELS: Record<number, string> = {
  1: 'Potentiel faible',
  2: 'Potentiel faible mais localement élevé',
  3: 'Potentiel significatif',
}

function niveauArgiles(code: number | null, libelle: string): Indicator['level'] {
  if (code !== null) return code >= 3 ? 'defavorable' : code === 2 ? 'attention' : 'favorable'
  return /fort/i.test(libelle) ? 'defavorable' : /moyen/i.test(libelle) ? 'attention' : 'favorable'
}

export async function buildRisques(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [icpe, risques, pprn, pprt, mvt, cavites, sismique, radon, argiles, inb] = await Promise.all([
    safe(cached(pointKey('icpe', lat, lon, RAYON_M), () => fetchIcpe(lat, lon, RAYON_M))),
    safe(cached(`risques-commune:${site.citycode}`, () => fetchRisquesCommune(site.citycode))),
    safe(fetchPprn(site.citycode)),
    safe(fetchPprt(site.citycode)),
    safe(fetchMvt(lat, lon, RAYON_M)),
    safe(fetchCavites(lat, lon, RAYON_M)),
    safe(zonageSismique(site.citycode)),
    safe(radonClasse(site.citycode)),
    safe(fetchExpositionArgiles(lat, lon)),
    safe(findNearestInb(lat, lon)),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  // ---- Risques recensés sur la commune -----------------------------------

  if (risques) {
    const familles = risques.filter((risque) => risque.famille)
    const sousTypes = risques.filter((risque) => !risque.famille)
    indicateurs.push({
      label: 'Risques recensés sur la commune',
      value: familles.length === 0 ? 'Aucun' : pluriel(familles.length, 'risque'),
      situation: familles.map((risque) => risque.libelle).join(' · ') || undefined,
      // No link: Géorisques publishes no per-commune permalink that resolves
      // (every candidate pattern 404s or lands on the generic search form —
      // checked in a real browser), so the full list is given here instead.
      detail:
        sousTypes.length > 0
          ? `Détail : ${sousTypes.map((risque) => risque.libelle.toLowerCase()).join(', ')}.`
          : 'Recensement GASPAR des risques majeurs de la commune.',
      level: familles.length === 0 ? 'favorable' : familles.length > 3 ? 'defavorable' : 'attention',
    })
    if (familles.length > 0) {
      commentaire.push(
        `La commune est concernée par ${pluriel(familles.length, 'risque majeur', 'risques majeurs')} recensé${familles.length > 1 ? 's' : ''} dans la base GASPAR : ` +
          `${familles.map((risque) => risque.libelle.toLowerCase()).join(', ')}. ` +
          `Ce recensement vaut pour la commune entière : il indique quels risques ont été identifiés par les services de l'État, ` +
          `pas s'ils s'appliquent à cette parcelle.`,
      )
    }
  }

  // ---- Plans de prévention des risques ------------------------------------

  if (pprt && pprt.length > 0) {
    for (const plan of pprt) {
      indicateurs.push({
        label: `PPRT — ${plan.libelle}`,
        value: plan.typeProcedure ?? 'Plan de prévention des risques technologiques',
        situation: plan.identifiant ? `Procédure ${plan.identifiant}` : undefined,
        detail:
          (plan.zonages.length > 0 ? `Zonage réglementaire : ${plan.zonages.join(', ').toLowerCase()}. ` : '') +
          "Le plan lui-même n'est pas diffusé sous forme de permalien : il se consulte en mairie ou en préfecture, où la position exacte de la parcelle dans le zonage doit être vérifiée.",
        level: 'defavorable',
      })
    }
    commentaire.push(
      `La commune est couverte par ${pluriel(pprt.length, 'plan de prévention des risques technologiques', 'plans de prévention des risques technologiques')} ` +
        `(${pprt.map((item) => item.libelle).join(', ')}). Un PPRT délimite des zones où la constructibilité et l'usage des bâtiments sont restreints ` +
        `autour d'un site industriel à risque : la position exacte de la parcelle dans le zonage réglementaire est déterminante.`,
    )
  } else {
    indicateurs.push({
      label: 'Plan de prévention des risques technologiques (PPRT)',
      value: pprt ? 'Aucun sur la commune' : 'Donnée indisponible',
      level: pprt ? 'favorable' : 'inconnu',
    })
  }

  if (pprn && pprn.length > 0) {
    for (const plan of pprn) {
      indicateurs.push({
        label: `PPRN — ${plan.libelle}`,
        value: plan.typeProcedure ?? 'Plan de prévention des risques naturels',
        situation: plan.identifiant ? `Procédure ${plan.identifiant}` : undefined,
        detail: plan.zonages.length > 0 ? `Zonage réglementaire : ${plan.zonages.join(', ').toLowerCase()}.` : undefined,
        level: 'attention',
      })
    }
  } else {
    indicateurs.push({
      label: 'Plans de prévention des risques naturels (PPRN)',
      value: pprn ? 'Aucun sur la commune' : 'Donnée indisponible',
      level: pprn ? 'favorable' : 'inconnu',
    })
  }

  // ---- Installations classées et SEVESO ----------------------------------

  if (icpe) {
    const classees = icpe.items.filter((item) => item.classee && item.localisation)
    const triees = [...classees].sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)
    const seveso = triees.filter(estSeveso)

    for (const item of triees.slice(0, 80)) {
      const isSeveso = estSeveso(item)
      features.push({
        kind: 'point',
        lat: item.localisation!.lat,
        lon: item.localisation!.lon,
        label: `${item.nom} — ${item.regime}${isSeveso ? ` (${item.seveso})` : ''}`,
        color: isSeveso ? COULEURS.seveso : COULEURS.icpe,
        group: isSeveso ? 'Établissement SEVESO' : 'ICPE',
      })
    }

    indicateurs.push({
      label: 'Installations classées (ICPE)',
      value: triees.length === 0 ? 'Aucune' : pluriel(triees.length, 'installation'),
      situation: `Dans un rayon de ${formatDistance(RAYON_M)}`,
      detail:
        seveso.length > 0
          ? `Dont ${pluriel(seveso.length, 'établissement SEVESO', 'établissements SEVESO')}. Chaque installation est détaillée ci-dessous.`
          : 'Aucun établissement SEVESO parmi elles.',
      level: triees.length === 0 ? 'favorable' : seveso.length > 0 ? 'defavorable' : 'attention',
    })

    // One line per installation: what it does, where it is relative to the
    // site, and whether it is still operating — a count alone says nothing.
    const detaillees = [...seveso, ...triees.filter((item) => !estSeveso(item))].slice(0, MAX_ICPE_DETAILLEES)
    for (const item of detaillees) {
      const isSeveso = estSeveso(item)
      indicateurs.push({
        label: `↳ ${item.nom}`,
        value: item.secteur ?? item.regime,
        situation: situation(item.localisation!.distanceM, item.localisation!.direction),
        detail: [
          `Régime ${item.regime}`,
          isSeveso ? `statut ${item.seveso}` : null,
          item.etatActivite,
          item.codeNaf ? `NAF ${item.codeNaf}` : null,
          item.adresse,
        ]
          .filter(Boolean)
          .join(' — '),
        level: isSeveso ? 'defavorable' : item.localisation!.distanceM < 500 ? 'attention' : 'favorable',
        href: item.ficheUrl ?? undefined,
      })
    }

    if (seveso.length > 0) {
      const proche = seveso[0]
      commentaire.push(
        `${pluriel(seveso.length, 'établissement SEVESO', 'établissements SEVESO')} ${seveso.length > 1 ? 'sont recensés' : 'est recensé'} ` +
          `dans un rayon de ${formatDistance(RAYON_M)}, le plus proche (${proche.nom}) ${situation(proche.localisation!.distanceM, proche.localisation!.direction)}. ` +
          `Le classement SEVESO traduit la présence de substances dangereuses en quantité : il déclenche un plan particulier d'intervention ` +
          `et, pour le seuil haut, un PPRT.`,
      )
    }
  }

  // ---- Risques naturels ponctuels -----------------------------------------

  if (mvt && mvt.total > 0) {
    for (const item of mvt.items.filter((i) => i.localisation).slice(0, 50)) {
      features.push({
        kind: 'point',
        lat: item.localisation!.lat,
        lon: item.localisation!.lon,
        label: `Mouvement de terrain — ${item.type}`,
        color: COULEURS.mvt,
        group: 'Mouvement de terrain',
      })
    }
    const proche = [...mvt.items].filter((i) => i.localisation).sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
    indicateurs.push({
      label: 'Mouvements de terrain recensés',
      value: pluriel(mvt.total, 'événement'),
      situation: proche ? `Le plus proche ${situation(proche.localisation!.distanceM, proche.localisation!.direction)}` : undefined,
      detail: proche ? `${proche.type}${proche.lieu ? ` — ${proche.lieu}` : ''}${proche.dateDebut ? ` (${proche.dateDebut})` : ''}` : undefined,
      level: proche && proche.localisation!.distanceM < 500 ? 'defavorable' : 'attention',
    })
  } else if (mvt) {
    indicateurs.push({ label: 'Mouvements de terrain recensés', value: 'Aucun', situation: `Dans un rayon de ${formatDistance(RAYON_M)}`, level: 'favorable' })
  }

  if (cavites && cavites.total > 0) {
    for (const item of cavites.items.filter((i) => i.localisation).slice(0, 50)) {
      features.push({
        kind: 'point',
        lat: item.localisation!.lat,
        lon: item.localisation!.lon,
        label: `Cavité — ${item.type}`,
        color: COULEURS.cavite,
        group: 'Cavité souterraine',
      })
    }
    const proche = [...cavites.items].filter((i) => i.localisation).sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
    indicateurs.push({
      label: 'Cavités souterraines recensées',
      value: pluriel(cavites.total, 'cavité', 'cavités'),
      situation: proche ? `La plus proche ${situation(proche.localisation!.distanceM, proche.localisation!.direction)}` : undefined,
      detail: proche ? `${proche.type}${proche.nom ? ` — ${proche.nom}` : ''}` : undefined,
      level: proche && proche.localisation!.distanceM < 300 ? 'defavorable' : 'attention',
    })
  } else if (cavites) {
    indicateurs.push({ label: 'Cavités souterraines recensées', value: 'Aucune', situation: `Dans un rayon de ${formatDistance(RAYON_M)}`, level: 'favorable' })
  }

  indicateurs.push({
    label: 'Zonage sismique réglementaire',
    value: sismique === null ? 'Donnée indisponible' : `Zone ${sismique} sur 5`,
    situation: sismique === null ? undefined : sismique >= 3 ? 'Sismicité modérée à forte' : 'Sismicité faible à très faible',
    detail:
      sismique === null
        ? undefined
        : sismique >= 3
          ? 'Des règles de construction parasismique s’appliquent aux bâtiments neufs (arrêté du 22 octobre 2010).'
          : 'Pas d’exigence parasismique renforcée pour les bâtiments courants.',
    level: sismique === null ? 'inconnu' : sismique >= 4 ? 'defavorable' : sismique >= 3 ? 'attention' : 'favorable',
  })

  indicateurs.push({
    label: 'Retrait-gonflement des argiles (RGA)',
    value: argiles ? argiles.libelle : 'Donnée indisponible',
    situation: argiles ? 'Exposition évaluée au droit du point, pas à la commune' : undefined,
    detail: argiles
      ? "Premier poste d'indemnisation au titre des catastrophes naturelles : l'alternance sécheresse/réhydratation fait travailler les argiles et fissure les fondations. Une étude géotechnique préalable est obligatoire à la vente d'un terrain constructible en zone d'exposition moyenne ou forte."
      : undefined,
    level: argiles ? niveauArgiles(argiles.code, argiles.libelle) : 'inconnu',
  })

  indicateurs.push({
    label: 'Potentiel radon de la commune',
    value: radon === null ? 'Donnée indisponible' : (RADON_LABELS[radon] ?? `Classe ${radon}`),
    detail:
      radon === 3
        ? 'Gaz radioactif naturel issu du sous-sol granitique ou volcanique : un dépistage et une ventilation adaptée sont recommandés.'
        : undefined,
    level: radon === null ? 'inconnu' : radon === 3 ? 'attention' : 'favorable',
  })

  // ---- Nucléaire ----------------------------------------------------------

  if (inb) {
    features.push({
      kind: 'point',
      lat: inb.lat,
      lon: inb.lon,
      label: `Installation nucléaire — ${inb.nom}`,
      color: COULEURS.nucleaire,
      group: 'Installation nucléaire de base',
    })
    indicateurs.push({
      label: 'Installation nucléaire de base la plus proche',
      value: inb.nom,
      situation: situation(inb.distanceM, inb.direction),
      detail: [
        inb.type,
        inb.exploitant ? `exploitant ${inb.exploitant}` : null,
        inb.commune ? `commune de ${inb.commune}` : null,
        inb.rayonPpiM !== null
          ? inb.dansPpi
            ? `Le site est dans le plan particulier d'intervention (rayon ${formatDistance(inb.rayonPpiM)})`
            : `Hors plan particulier d'intervention (rayon ${formatDistance(inb.rayonPpiM)})`
          : "Pas de plan particulier d'intervention pour cette installation",
        inb.risqueIode && inb.rayonPpiM !== null ? 'distribution de comprimés d’iode autour du site' : null,
      ]
        .filter(Boolean)
        .join(' — '),
      level: inb.dansPpi ? 'defavorable' : inb.distanceM < 50000 ? 'attention' : 'favorable',
      href: 'https://www.asnr.fr/',
    })
    commentaire.push(
      `L'installation nucléaire de base la plus proche est ${inb.nom}${inb.commune ? ` (${inb.commune})` : ''}, ${situation(inb.distanceM, inb.direction)}. ` +
        (inb.dansPpi
          ? `Le site se trouve à l'intérieur de son plan particulier d'intervention : il est concerné par les consignes de mise à l'abri et, le cas échéant, la distribution d'iode.`
          : inb.rayonPpiM !== null
            ? `Le site est en dehors de son plan particulier d'intervention.`
            : `Cette installation ne fait pas l'objet d'un plan particulier d'intervention.`),
    )
  }

  lacunes.push(
    "Les installations militaires ne font l'objet d'aucune publication en données ouvertes, pour des raisons de sécurité nationale : leur présence à proximité ne peut pas être vérifiée par cet outil.",
    "Le zonage réglementaire des PPRT et PPRN est restitué par ses catégories, pas par sa géométrie, et aucun permalien public ne donne accès au plan lui-même : savoir dans quelle zone tombe précisément une parcelle suppose de consulter le plan opposable en mairie ou en préfecture.",
    "La base des installations classées ne publie ni date de création ni date de cessation : seul l'état administratif de l'établissement est repris ici.",
    "Les risques GASPAR, les PPR, la sismicité et le radon sont recensés à l'échelle de la commune : ils décrivent un contexte communal, pas la situation exacte de la parcelle. Seul le retrait-gonflement des argiles est évalué au point.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Géorisques — portail des risques (BRGM)', href: 'https://www.georisques.gouv.fr/', note: 'GASPAR, PPR, ICPE, cavités, mouvements de terrain' },
      { label: 'Géorisques — installations classées et SEVESO', href: 'https://www.georisques.gouv.fr/risques/installations' },
      { label: 'Géorisques — retrait-gonflement des argiles', href: 'https://www.georisques.gouv.fr/minformer-sur-un-risque/retrait-gonflement-des-argiles', note: 'exposition au point' },
      { label: 'Géorisques — zonage sismique', href: 'https://www.georisques.gouv.fr/minformer-sur-un-risque/seisme' },
      { label: 'ASNR — Autorité de sûreté nucléaire et de radioprotection', href: 'https://www.asnr.fr/', note: 'installations nucléaires de base' },
      { label: 'ERRIAL — état des risques à l’adresse', href: 'https://errial.georisques.gouv.fr/', note: 'outil officiel, à renseigner avec l’adresse' },
    ],
  }
}
