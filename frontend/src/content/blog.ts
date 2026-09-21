export interface BlogPost {
  slug: string
  /** Publication date on this site (YYYY-MM-DD) — not necessarily the source's own date. */
  date: string
  title: string
  summary: string
  body: string[]
  sourceLabel: string
  sourceUrl: string
  tags: string[]
}

// Fed by a daily veille (monitoring) routine: one short, sourced note added
// per relevant item found, oldest at the bottom. Nothing here is invented —
// every post links back to the primary source it summarizes.
export const posts: BlogPost[] = [
  {
    slug: 'nappes-secheresse-septembre-2026',
    date: '2026-09-21',
    title: 'Nappes phréatiques : une rentrée sous tension hydrique',
    summary:
      "Le bulletin du BRGM arrêté au 1er septembre 2026 confirme une dégradation générale de l'état des nappes par rapport à l'an dernier à la même période.",
    body: [
      "Selon le bulletin national de situation des eaux souterraines publié par le BRGM (points de situation au 1er septembre 2026), 90 % des niveaux de nappes sont orientés à la baisse et 61 % des points d'observation se situent sous les normales mensuelles — contre 19 % au-dessus de la normale et 20 % autour de la normale.",
      "Les secteurs les plus tendus concernent le socle limousin, les calcaires du Jura et la plaine nord d'Alsace, où les niveaux sont qualifiés de très bas pour la saison. À l'inverse, certaines nappes du sud de la France — dont celle des formations de la Vistrenque — conservent des niveaux modérément hauts à hauts.",
      "Le BRGM attribue cette dégradation à un déficit pluviométrique marqué depuis le mois de mai, aggravé par des températures élevées ayant accru l'évapotranspiration. Pour un diagnostic de site, ce contexte renforce l'intérêt de vérifier la disponibilité et la fiabilité d'un point de référence ADES à proximité avant de conclure sur une vulnérabilité des eaux souterraines.",
    ],
    sourceLabel: 'BRGM — Nappes d’eau souterraine au 1er septembre 2026',
    sourceUrl: 'https://www.brgm.fr/en/news/press-release/groundwater-tables-1-september-2026',
    tags: ['Eau souterraine', 'Sécheresse', 'Hydrogéologie'],
  },
  {
    slug: 'conseil-etat-plans-deau-zones-humides',
    date: '2026-09-21',
    title: 'Plans d’eau en zone humide : le Conseil d’État annule l’assouplissement de 2024',
    summary:
      "Décision du 2 mars 2026 : l'arrêté qui exemptait les plans d'eau de moins d'un hectare des conditions cumulatives imposées depuis 2021 est annulé.",
    body: [
      "Par une décision du 2 mars 2026, le Conseil d'État a annulé l'arrêté du 3 juillet 2024, qui modifiait l'arrêté du 9 juin 2021 relatif aux prescriptions techniques applicables aux plans d'eau. Le texte annulé exemptait les plans d'eau de moins d'un hectare — soit la majorité des plans d'eau français — des trois conditions cumulatives instaurées en 2021 pour leur création en zone humide.",
      "Le Conseil d'État a jugé cet assouplissement contraire au principe de non-régression environnementale posé par la loi du 8 août 2016, les zones humides jouant un rôle reconnu de refuge pour la biodiversité, de filtration et de régulation hydrique, sans que les autres dispositifs de protection existants n'offrent une protection équivalente.",
      "En pratique, tout projet de création de plan d'eau en zone humide reste donc soumis aux trois conditions cumulatives de 2021 : démonstration d'un intérêt général majeur, absence d'alternative de moindre impact, et mesures compensatoires — quelle que soit la surface du plan d'eau. Un point à vérifier systématiquement en amont d'un projet touchant une zone humide identifiée.",
    ],
    sourceLabel: 'Conseil d’État — communiqué du 2 mars 2026',
    sourceUrl:
      'https://www.conseil-etat.fr/actualites/environnement-le-conseil-d-etat-annule-les-nouvelles-regles-de-creation-de-plans-d-eau-dans-les-zones-humides',
    tags: ['Zones humides', 'Réglementation', 'Eau'],
  },
]
