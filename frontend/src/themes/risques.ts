import { cached, pointKey } from '../lib/cache'
import { formatDistance } from '../lib/geo'
import {
  argilesExposition,
  communeRiskPortalUrl,
  fetchCavites,
  fetchIcpe,
  fetchMvt,
  fetchPprn,
  fetchPprt,
  estSeveso,
  fetchRisquesCommune,
  radonClasse,
  zonageSismique,
} from '../lib/georisques'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 3000

const COULEURS = {
  seveso: '#8c1d0f',
  icpe: '#c34a35',
  mvt: '#a3671a',
  cavite: '#7a4bbf',
}

const RADON_LABELS: Record<number, string> = {
  1: 'Potentiel faible',
  2: 'Potentiel faible mais localement élevé',
  3: 'Potentiel significatif',
}

export async function buildRisques(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [icpe, risques, pprn, pprt, mvt, cavites, sismique, radon, argiles] = await Promise.all([
    safe(cached(pointKey('icpe', lat, lon, RAYON_M), () => fetchIcpe(lat, lon, RAYON_M))),
    safe(cached(`risques-commune:${site.citycode}`, () => fetchRisquesCommune(site.citycode))),
    safe(fetchPprn(site.citycode)),
    safe(fetchPprt(site.citycode)),
    safe(fetchMvt(lat, lon, RAYON_M)),
    safe(fetchCavites(lat, lon, RAYON_M)),
    safe(zonageSismique(site.citycode)),
    safe(radonClasse(site.citycode)),
    safe(argilesExposition(site.citycode)),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  // ---- Risques recensés sur la commune -----------------------------------

  if (risques) {
    const familles = risques.filter((risque) => risque.famille)
    indicateurs.push({
      label: 'Risques recensés sur la commune',
      value: familles.length === 0 ? 'Aucun' : pluriel(familles.length, 'risque'),
      detail: familles.map((risque) => risque.libelle).join(' · ') || undefined,
      level: familles.length === 0 ? 'favorable' : familles.length > 3 ? 'defavorable' : 'attention',
      href: communeRiskPortalUrl(site.citycode),
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
    const plan = pprt[0]
    indicateurs.push({
      label: 'Plan de prévention des risques technologiques (PPRT)',
      value: pprt.length === 1 ? plan.libelle : pluriel(pprt.length, 'plan'),
      detail:
        `${pprt.map((item) => item.libelle).join(' · ')}` +
        (plan.zonages.length > 0 ? `. Zonage réglementaire : ${plan.zonages.join(', ').toLowerCase()}.` : ''),
      level: 'defavorable',
      href: communeRiskPortalUrl(site.citycode),
    })
    commentaire.push(
      `La commune est couverte par ${pluriel(pprt.length, 'plan de prévention des risques technologiques', 'plans de prévention des risques technologiques')} ` +
        `(${pprt.map((item) => item.libelle).join(', ')}). Un PPRT délimite des zones où la constructibilité et l'usage des bâtiments sont restreints ` +
        `autour d'un site industriel à risque : la position exacte de la parcelle dans le zonage réglementaire est déterminante et doit être vérifiée ` +
        `sur le plan opposable.`,
    )
  } else {
    indicateurs.push({
      label: 'Plan de prévention des risques technologiques (PPRT)',
      value: pprt ? 'Aucun sur la commune' : 'Donnée indisponible',
      level: pprt ? 'favorable' : 'inconnu',
    })
  }

  if (pprn && pprn.length > 0) {
    indicateurs.push({
      label: 'Plans de prévention des risques naturels (PPRN)',
      value: pluriel(pprn.length, 'plan'),
      detail: pprn.map((item) => `${item.libelle}${item.typeProcedure ? ` (${item.typeProcedure})` : ''}`).join(' · '),
      level: 'attention',
      href: communeRiskPortalUrl(site.citycode),
    })
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
    const seveso = classees.filter(estSeveso)
    for (const item of classees.slice(0, 80)) {
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

    if (seveso.length > 0) {
      const proche = [...seveso].sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
      indicateurs.push({
        label: 'Établissements SEVESO',
        value: pluriel(seveso.length, 'établissement'),
        situation: `Le plus proche ${situation(proche.localisation!.distanceM, proche.localisation!.direction)}`,
        detail: `${proche.nom} — statut ${proche.seveso}, régime ${proche.regime}`,
        level: proche.localisation!.distanceM < 1000 ? 'defavorable' : 'attention',
        href: proche.ficheUrl ?? undefined,
      })
      commentaire.push(
        `${pluriel(seveso.length, 'établissement SEVESO', 'établissements SEVESO')} ${seveso.length > 1 ? 'sont recensés' : 'est recensé'} ` +
          `dans un rayon de ${formatDistance(RAYON_M)}, le plus proche ${situation(proche.localisation!.distanceM, proche.localisation!.direction)}. ` +
          `Le classement SEVESO traduit la présence de substances dangereuses en quantité : il déclenche un plan particulier d'intervention ` +
          `et, pour le seuil haut, un PPRT.`,
      )
    } else {
      indicateurs.push({
        label: 'Établissements SEVESO',
        value: 'Aucun',
        detail: `Aucun établissement SEVESO dans un rayon de ${formatDistance(RAYON_M)}.`,
        level: 'favorable',
      })
    }

    const proche = [...classees].sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
    indicateurs.push({
      label: 'Installations classées (ICPE)',
      value: classees.length === 0 ? 'Aucune' : pluriel(classees.length, 'installation'),
      situation: proche ? `La plus proche ${situation(proche.localisation!.distanceM, proche.localisation!.direction)}` : undefined,
      detail: proche ? `${proche.nom} — régime ${proche.regime}` : undefined,
      level: classees.length === 0 ? 'favorable' : 'attention',
      href: proche?.ficheUrl ?? undefined,
    })
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
      detail: proche ? `${proche.type}${proche.lieu ? ` — ${proche.lieu}` : ''}` : undefined,
      level: proche && proche.localisation!.distanceM < 500 ? 'defavorable' : 'attention',
    })
  } else if (mvt) {
    indicateurs.push({
      label: 'Mouvements de terrain recensés',
      value: 'Aucun',
      level: 'favorable',
    })
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
    indicateurs.push({
      label: 'Cavités souterraines recensées',
      value: 'Aucune',
      level: 'favorable',
    })
  }

  indicateurs.push({
    label: 'Zonage sismique réglementaire',
    value: sismique === null ? 'Donnée indisponible' : `Zone ${sismique} sur 5`,
    detail:
      sismique === null
        ? undefined
        : sismique >= 3
          ? 'Des règles de construction parasismique s’appliquent aux bâtiments neufs.'
          : 'Aléa faible à très faible.',
    level: sismique === null ? 'inconnu' : sismique >= 4 ? 'defavorable' : sismique >= 3 ? 'attention' : 'favorable',
  })

  indicateurs.push({
    label: 'Potentiel radon de la commune',
    value: radon === null ? 'Donnée indisponible' : (RADON_LABELS[radon] ?? `Classe ${radon}`),
    detail:
      radon === 3 ? 'Gaz radioactif naturel issu du sous-sol granitique ou volcanique : un dépistage et une ventilation adaptée sont recommandés.' : undefined,
    level: radon === null ? 'inconnu' : radon === 3 ? 'attention' : 'favorable',
  })

  indicateurs.push({
    label: 'Retrait-gonflement des argiles',
    value: argiles === null ? 'Donnée indisponible' : `Exposition ${argiles.toLowerCase()}`,
    detail: argiles === null ? undefined : 'Premier poste d’indemnisation au titre des catastrophes naturelles : affecte les fondations des constructions.',
    level: argiles === null ? 'inconnu' : /fort/i.test(argiles) ? 'defavorable' : /moyen/i.test(argiles) ? 'attention' : 'favorable',
  })

  // ---- Nucléaire et installations militaires ------------------------------

  const risqueNucleaire = risques?.some((risque) => /nucl[ée]aire/i.test(risque.libelle)) ?? null
  indicateurs.push({
    label: 'Risque nucléaire (installation nucléaire de base)',
    value: risqueNucleaire === null ? 'Donnée indisponible' : risqueNucleaire ? 'Commune concernée' : 'Commune non concernée',
    detail: risqueNucleaire
      ? "La commune figure au recensement GASPAR pour le risque nucléaire : elle est vraisemblablement comprise dans le plan particulier d'intervention d'une installation nucléaire de base."
      : "Aucun risque nucléaire n'est recensé pour cette commune dans la base GASPAR. Le périmètre des plans particuliers d'intervention s'étend généralement à 20 km autour d'une centrale.",
    level: risqueNucleaire === null ? 'inconnu' : risqueNucleaire ? 'defavorable' : 'favorable',
    href: 'https://www.asnr.fr/',
  })

  lacunes.push(
    "Les installations nucléaires de base ne sont pas localisées individuellement : aucune base nationale ouverte ne publie leurs coordonnées dans un service interrogeable par adresse. Seul le recensement du risque à l'échelle communale est exploité ici, à compléter par le site de l'Autorité de sûreté nucléaire et de radioprotection.",
    "Les installations militaires ne font l'objet d'aucune publication en données ouvertes, pour des raisons de sécurité nationale : leur présence à proximité ne peut pas être vérifiée par cet outil.",
    'Le zonage réglementaire des PPRT et PPRN est restitué ici par ses catégories, pas par sa géométrie : savoir dans quelle zone tombe précisément une parcelle suppose de consulter le plan opposable en mairie ou en préfecture.',
    "Les risques sont recensés à l'échelle de la commune pour les rubriques GASPAR, PPR, sismicité, radon et argiles : ils décrivent un contexte communal, pas la situation exacte de la parcelle.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      {
        label: 'Géorisques — portail des risques (BRGM)',
        href: 'https://www.georisques.gouv.fr/',
        note: 'GASPAR, PPR, ICPE, cavités, mouvements de terrain',
      },
      {
        label: 'Géorisques — installations classées et SEVESO',
        href: 'https://www.georisques.gouv.fr/risques/installations',
      },
      {
        label: 'Géorisques — zonage sismique et potentiel radon',
        href: 'https://www.georisques.gouv.fr/risques/zonage-sismique',
      },
      {
        label: 'ASNR — Autorité de sûreté nucléaire et de radioprotection',
        href: 'https://www.asnr.fr/',
        note: 'installations nucléaires de base',
      },
    ],
  }
}
