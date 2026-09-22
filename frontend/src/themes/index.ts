import type { Site, ThemeReport } from '../types/site'
import { buildAir } from './air'
import { buildClimat } from './climat'
import { buildEau } from './eau'
import { buildNature } from './nature'
import { buildRisques } from './risques'
import { buildSol } from './sol'

export interface Rubrique {
  id: string
  titre: string
  sousTitre: string
  build: (site: Site) => Promise<ThemeReport>
}

export const RUBRIQUES: Rubrique[] = [
  {
    id: 'eau',
    titre: 'Qualité de l’eau',
    sousTitre:
      "Eau potable distribuée, qualité du cours d'eau le plus proche, sites de baignade, restrictions en vigueur, captages et nappes — situés en amont ou en aval hydraulique du site.",
    build: buildEau,
  },
  {
    id: 'air',
    titre: 'Qualité de l’air',
    sousTitre:
      "Polluants modélisés et distance à la maille de calcul, rose des vents, exposition au bruit des infrastructures, proximité des parcelles traitées et des installations classées.",
    build: buildAir,
  },
  {
    id: 'sol',
    titre: 'Qualité des sols',
    sousTitre:
      "Nature pédologique, fond géochimique, anciens sites industriels et secteurs d'information sur les sols, et l'histoire du site vue du ciel, décennie par décennie.",
    build: buildSol,
  },
  {
    id: 'nature',
    titre: 'Faune et flore',
    sousTitre:
      'Périmètres Natura 2000, ZNIEFF, parcs naturels et réserves autour du site, et les espèces effectivement observées à proximité.',
    build: buildNature,
  },
  {
    id: 'climat',
    titre: 'Changements climatiques',
    sousTitre:
      "Température et précipitations projetées à l'horizon 2050, journées de forte chaleur, inondation, feux de forêt et recul du trait de côte.",
    build: buildClimat,
  },
  {
    id: 'risques',
    titre: 'Risques technologiques et naturels',
    sousTitre:
      'Établissements SEVESO et installations classées, plans de prévention PPRT et PPRN, mouvements de terrain, cavités, sismicité, radon et risque nucléaire.',
    build: buildRisques,
  },
]
