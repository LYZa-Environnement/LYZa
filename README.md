# LYZa — site & carte de sensibilité environnementale

Site professionnel pour LYZa (Léo Yecora-Zorzano, conseil en environnement et
hydrogéologie), incluant la présentation de l'activité, les prestations, et
un outil interactif ("Évaluer un site") : l'utilisateur saisit une adresse,
la voit positionnée sur une carte, et obtient une synthèse de sensibilité
environnementale construite à partir de données publiques.

Le site est entièrement statique — **aucun backend à héberger**. La
synthèse par adresse et LYZa Cartes appellent toutes les deux les API
publiques (BAN, Géorisques, Hub'Eau, IGN...) directement depuis le
navigateur, exactement comme un site JavaScript classique.

## Architecture

```
frontend/    Site React (Vite + TypeScript) — pages du site, outil carte
             (Leaflet) et LYZa Cartes. Tout tourne dans le navigateur.
backend/     Optionnel, non utilisé par le site en ligne : boîte à outils
             Python qui réplique la même logique de synthèse (voir plus
             bas) pour un usage local — scripts d'analyse par lots,
             expérimentation pandas, etc.
```

## Identité visuelle

Refonte graphique de l'ensemble du site — React (`frontend/`) **et**
LYZa Cartes (`frontend/public/lyza-cartes.html`) — inspirée d'affiches de
campagne électorale fournies par l'utilisateur (cartes communales
illustrées à la main, lettrage noir épais, formes organiques, vert/rouge) :

- Polices via Google Fonts (`frontend/index.html`) : **Bricolage
  Grotesque** (titres, graisse 700-800) et **Caveat** (citations, classe
  `.quote`), avec repli sur la pile système si les polices ne chargent pas.
- Nouvelle palette (`frontend/src/index.css`) : fond crème, vert forêt en
  accent principal, vert sapin profond pour les sections « inversées »
  (pied de page), rouge terracotta en accent ponctuel (puce de
  `.eyebrow`).
- Bordures épaisses (`--border-w: 2px`) et ombre portée façon autocollant
  sur les boutons/cartes (`box-shadow` décalée), plutôt que les fines
  bordures 1px d'origine — reprise aussi sur `a.card:hover` (légère
  translation + ombre agrandie) pour donner un retour visuel sur toutes
  les cartes cliquables du site (prestations, actualités), sans l'imposer
  aux cartes non interactives (formulaire de contact, etc.).
- L'illustration décorative « carte communale dessinée à la main »
  (`MapMotif.tsx`, hero de la page d'accueil) a été retirée à la demande
  de l'utilisateur ; le composant, devenu inutilisé, a été supprimé.

Le thème « Évaluer un site » utilise les mêmes classes CSS partagées
(`.card`, `.btn`, `.badge`, `.grid`) donc hérite du nouveau style sans
modification propre — seules les bordures de formulaires (recherche
d'adresse, formulaire de contact, sélecteur de rayon CASIAS/SIS) ont été
alignées manuellement sur `--border-w`.

**LYZa Cartes** (`frontend/public/lyza-cartes.html`) garde son propre
système de thème CSS (variables `:root`, clair/sombre) mais celui-ci a été
réaligné sur la même identité plutôt que traité comme un style à part :

- Police **Bricolage Grotesque** chargée dans le `<head>` de ce fichier
  autonome et appliquée aux titres/étiquettes de marque (`h1`,
  `.brand-mark`, `.popup h3`, `.wc-title`, boutons) — le corps de texte
  dense (tableaux, popups de données, légendes) reste en Verdana pour
  rester lisible à petite taille.
- Jetons de couleur « chrome » (`--bg`, `--paper`, `--ink`, `--accent`,
  `--danger`, `--warn`, …) remplacés par la même palette que le site React,
  en clair comme en sombre — mais les ~17 jetons fonctionnels de légende
  cartographique (`--c-icpe-*`, `--c-casias`, `--c-sis`, `--c-bss`,
  `--c-river`, `--c-natura-*`, `--c-piezo`, `--c-ppe`, etc.) sont
  **volontairement laissés inchangés** : ils codent la signification réelle
  des couches de la carte, pas l'identité de marque — les toucher casserait
  les conventions de couleur que l'outil utilise déjà en interne.
- Bordures épaissies (2px, couleur `--ink`) et ombre décalée façon
  autocollant sur les éléments de chrome (bandeau d'en-tête, champ de
  recherche, boutons, popups, étiquette Nord, liste de suggestions) —
  les rangées denses (calques, parcelles sélectionnées, tableaux de
  popup) gardent leurs bordures fines d'origine pour ne pas surcharger
  visuellement un outil de travail.
- Un bandeau tricolore (vert/rouge/orange) en tête de la barre latérale.

## Priorité aux outils gratuits sur l'accompagnement

À la demande de l'utilisateur, le site pose désormais explicitement LYZa
comme un outil d'aide à la décision en libre accès avant tout, un
accompagnement payant restant possible mais secondaire — « si besoin » :

- `Nav.tsx` : « Évaluer un site » et « LYZa Cartes » sont juste après
  « Accueil » (avant Présentation/Accompagnement) et affichés en vert
  accent même hors état actif, pour se distinguer visuellement du reste
  du menu.
- `Home.tsx` : le second bouton du hero pointe vers LYZa Cartes (plus
  vers les prestations). La section « Outils gratuits » (deux cartes de
  poids égal, une par outil) est mise en avant tôt sur la page. La
  section accompagnement — désormais intitulée « Si besoin » — est la
  toute dernière section de la page, volontairement : jamais la première
  chose vue à l'arrivée sur le site.
- `a.card:hover` profite aussi à ces cartes d'outils.

**Fusion de Prestations, Secteurs d'intervention et Démarche en une
seule page** (`/accompagnement`, `frontend/src/pages/Accompagnement.tsx`).
Ces trois anciennes pages séparées (`Services.tsx`, `Sectors.tsx`,
`Approach.tsx`, désormais supprimées) racontaient en réalité une seule
histoire — comment je travaille, pour qui, sous quelles formes — et sont
maintenant trois chapitres d'une même page plutôt que trois entrées de
menu distinctes : « Comment je travaille » (démarche : principes, étapes,
citation), « Secteurs d'intervention » (pour qui), puis « Neuf formes
d'intervention » (les prestations, en grille de cartes renvoyant chacune
vers sa page de détail à `/accompagnement/:slug` — `ServiceDetail.tsx`
n'a pas changé, seule sa route parente a été renommée). Contenu intégral
conservé, rien de supprimé — uniquement réorganisé en sections chapitrées
sur une page au lieu de trois pages.

D'anciens liens vers `/prestations`, `/secteurs` ou `/demarche`
redirigent maintenant vers `/accompagnement` (`App.tsx`), et
`/prestations/:slug` continue de fonctionner directement (même
composant `ServiceDetail`, mêmes `slug`) — pas de lien cassé pour qui
aurait gardé un ancien signet. Une route `*` de repli vers l'accueil a
aussi été ajoutée à cette occasion : il n'en existait aucune avant, donc
une URL invalide affichait auparavant une page entièrement blanche (pas
même la navigation), un défaut préexistant corrigé au passage.

## Refonte plateforme (septembre 2026)

À la demande explicite de l'utilisateur, une seconde passe pousse plus loin
la logique de la section précédente : le site se présente d'abord comme une
**plateforme d'évaluation de la vulnérabilité d'un site face à son
environnement** (risques technologiques et naturels), la vente de
prestations devenant quasi invisible plutôt que « juste secondaire ».

- **`Nav.tsx` réordonné** : Accueil, Évaluer un site, LYZa Cartes, Eau
  quantitative (nouveau), Actualités, Contact — puis, en tout dernier,
  sans mise en avant visuelle, Accompagnement. « Présentation » a été
  retirée du menu principal (reste accessible depuis le pied de page) :
  les deux pages à caractère commercial ne sont plus dans la barre de
  navigation du tout, seulement dans `Footer.tsx`.
- **`Home.tsx` réordonné** : la section « Outils gratuits » (désormais
  trois cartes — Évaluer un site, LYZa Cartes, Eau quantitative) est
  remontée juste après le hero, avant les actualités. La section
  « Une expertise, pas un guichet d'études » (positionnement consultant)
  a été retirée ; ce qui restait d'accompagnement tient maintenant en un
  bandeau d'une ligne tout en bas de page (« Un accompagnement plus
  poussé reste possible… ») plutôt qu'une section à deux cartes. Le hero
  lui-même a été réécrit pour parler plateforme/données publiques
  d'abord (« Évaluer la vulnérabilité d'un site… ») plutôt que conseil
  stratégique.
- **ICPE & émissions n'est plus une page séparée.** L'ancienne page
  `/icpe-emissions` (recherche par adresse + IREP + rose des vents) est
  retirée ; les émissions et prélèvements déclarés au registre IREP sont
  désormais chargés **au clic sur une installation, directement dans le
  cartouche ICPE de LYZa Cartes** — voir la section dédiée plus bas.
  L'ancienne URL redirige maintenant vers `lyza-cartes.html`
  (`RedirectToLyzaCartes.tsx`). La rose des vents (Open-Meteo/ERA5,
  `lib/wind.ts`, `WindRoseChart.tsx`) n'a pas été portée dans ce cartouche
  et a été retirée du site plutôt que laissée orpheline — hors du
  périmètre explicitement demandé (« ICPE et émission »).
- **Nouvel onglet « Eau quantitative »** (`/eau-quantitative`,
  `EauQuantitative.tsx`) — voir sa section dédiée plus bas. Absorbe
  l'ancien outil « Restrictions d'eau » (`/restrictions-eau` redirige
  maintenant ici) comme un chapitre parmi d'autres, plutôt que deux
  entrées de menu voisines pour deux facettes du même sujet.
- **Présentation cartographique par défaut** : quand une nouvelle donnée
  géolocalisée est ajoutée (ici, la ressource en eau souterraine/
  superficielle la plus proche d'une adresse), le réflexe pris est de la
  poser sur une carte (réutilisation de `SensitivityMap.tsx`) plutôt que
  de se limiter à du texte — cohérent avec ce que fait déjà chaque autre
  outil du site.

## Déploiement — GitHub Pages

`.github/workflows/deploy-pages.yml` build et déploie automatiquement
`frontend/` sur GitHub Pages à chaque push sur `main` (nécessite d'activer
Pages une fois dans les paramètres du dépôt : Settings → Pages → Source =
"GitHub Actions"). URL : `https://lyza-environnement.github.io/LYZa/`.

Deux adaptations spécifiques à ce mode d'hébergement statique :

- Le routage utilise `HashRouter` (URLs en `#/accompagnement`) plutôt que
  `BrowserRouter`, car GitHub Pages n'a pas de règle de réécriture
  serveur pour les liens profonds d'une SPA — un rafraîchissement sur
  `/accompagnement` renverrait une 404 avec un routeur basé sur l'URL
  réelle.
- Le build est préfixé par `/LYZa/` (`base` dans `vite.config.ts`, activé
  uniquement quand `GITHUB_PAGES=true`, donc sans effet sur `npm run dev`
  ou un build local classique).

Comme le site est 100% statique, il n'y a rien de plus à activer pour que
"Évaluer un site" et LYZa Cartes fonctionnent en ligne — les deux tournent
déjà entièrement côté navigateur.

### Frontend — `frontend/`

```bash
cd frontend
npm install
npm run dev
```

Pages : Accueil, Évaluer un site (la carte), LYZa Cartes, Eau quantitative,
Actualités, Contact, Présentation, Accompagnement (démarche + secteurs
d'intervention + prestations, avec une page de détail par prestation) — les
deux dernières ne sont plus dans le menu principal (voir « Refonte
plateforme » plus haut).

## L'outil "Évaluer un site"

La page est structurée en deux parties, qui répondent à deux questions
différentes plutôt qu'à une seule synthèse mélangée (retour direct) :

- **Partie 1 — Quels risques s'appliquent à ce site ?** (dangers/signaux
  qui pourraient affecter le site lui-même), chapitrée en deux thèmes :
  **Risques naturels** (inondation/coulée de boue, mouvements de terrain,
  cavités, sismicité, argiles, radon, usage de pesticides sur les parcelles
  agricoles voisines) et **Risques industriels** (anciens sites industriels
  et sols pollués CASIAS/SIS, ICPE, canalisations de matières dangereuses).
- **Partie 2 — Quel impact une activité sur ce site pourrait-elle avoir sur
  l'environnement ?** — la question inverse : c'est la note de
  vulnérabilité/sensibilité hydro (voir plus bas), inchangée dans son
  contenu mais désormais présentée comme un second chapitre à part entière
  plutôt qu'un bloc supplémentaire sous la synthèse.

Les deux parties partagent la même recherche d'adresse et la même carte
(un seul scan, pas de re-fetch) — une vraie deuxième page aurait dupliqué
l'état ou nécessité de refaire les appels après navigation, pour un
bénéfice de partage d'URL qui n'était pas demandé.

1. L'utilisateur saisit une adresse (autocomplétion via l'API Adresse —
   `frontend/src/lib/geocode.ts`, appel direct au navigateur).
2. L'adresse est positionnée sur une carte simplifiée (Leaflet / fond
   OpenStreetMap), avec un rayon d'analyse de 1 000 m.
3. Le navigateur interroge l'API Géorisques autour du point
   (`frontend/src/lib/georisques.ts`) et agrège les résultats en deux
   thèmes (`frontend/src/lib/synthesis.ts`) : **Risques naturels** et
   **Risques industriels** (composition détaillée ci-dessus).
4. Chaque thème reçoit un niveau (Faible / Modérée / Élevée / Non
   déterminée) selon des règles explicites, pas un score opaque — voir
   `frontend/src/lib/rules.ts`. Les seuils de `levelFromCount` (ICPE,
   CASIAS, mouvements de terrain, cavités, canalisations TIM) demandent une
   certaine concentration d'évènements avant de passer en « modérée » ou
   « élevée » (3 puis 8 par défaut, ajusté par catégorie) plutôt que de
   réagir à la première occurrence dans le rayon d'étude — un seul ICPE ou
   ancien site industriel à 900 m n'est pas en soi alarmant. Même logique
   pour `levelFromFloodSignals` : un historique d'arrêtés catastrophe
   naturelle pour inondation est quasi universel pour les communes
   françaises et ne fait plus, seul, basculer le thème Eau en « modérée »
   (il faut soit être en zone inondable cartographiée (AZI), soit un
   historique inhabituellement dense) — les classifications officielles
   (zonage sismique, argiles, radon) restent en revanche inchangées, elles
   reprennent directement l'échelle réglementaire du gouvernement.
5. Selon les thèmes signalés, la page propose les prestations pertinentes
   (ex. un signal sur l'eau renvoie vers la prestation hydrogéologie).

Le détail de chaque thème liste les éléments individuels quand la donnée
s'y prête (jusqu'à 6 par catégorie, avec un « + N autres » au-delà) plutôt
qu'un simple total : sites CASIAS et secteurs SIS nommés, installations
ICPE avec régime/NAF/statut Seveso, arrêtés catastrophe naturelle datés,
mouvements de terrain et cavités souterraines (type, lieu, date, distance
et direction au site). Chaque site/point/ouvrage mentionné dans l'outil —
CASIAS, SIS, ICPE, mouvements de terrain, cavités, point ADES, cours d'eau,
site de baignade, périmètre de protection éloignée — indique systématiquement
sa distance ET sa direction cardinale au site étudié (jamais l'une sans
l'autre) ; `describeLocalisation` dans `synthesis.ts` et `distanceEtDirection`
dans `hydroNote.ts` centralisent ce formatage, et `cardinalPhraseFr` dans
`geo.ts` gère l'élision française correcte (« à l'est »/« à l'ouest », pas
« au est »/« au ouest »). Chaque élément qui a une fiche officielle (CASIAS,
SIS, ICPE) y renvoie en lien direct. Les arrêtés catastrophe naturelle
(inondation et/ou coulée de boue — le libellé officiel GASPAR exact,
confirmé en direct) affichent leurs dates (évènement, publication au
Journal officiel) et leur référence nationale (`code_national_catnat`) en
texte, sans lien cliquable : aucune page publique par arrêté n'a été
trouvée, et un lien générique vers le Journal officiel du jour n'apportait
rien d'utile (retiré après retour direct). Le thème Risques naturels
ajoute, pour le zonage sismique, l'exposition aux argiles et le potentiel
radon, une description en clair de ce que la classe réglementaire signifie
concrètement, ainsi qu'un lien vers le rapport de risques complet de la
commune sur le portail Géorisques.

Un avertissement est affiché systématiquement : la synthèse s'appuie sur
des données publiques et ne remplace pas une étude réglementaire.

### Usage de pesticides sur les parcelles voisines — `frontend/src/lib/parcelles.ts`

Ajouté au thème Risques naturels sur demande : un signal sur l'usage
probable de produits phytosanitaires sur les parcelles agricoles voisines,
d'après le RPG (Registre Parcellaire Graphique). Interroge en direct la
couche WFS `RPG.LATEST:parcelles_graphiques` (module `wfs-geoportail`
d'API Carto IGN) — vérifiée en direct sur ~300 parcelles réelles en Beauce
(région de grandes cultures) : champs `id_parcel`, `surf_parc`,
`code_cultu` (code culture, ex. `BTH` blé tendre), `code_group` (groupe de
culture, "1" à "28"), `culture_d1`/`culture_d2`, `cat_cult_p`,
`code_insee`. Aucun champ « bio » n'existe sur cette couche.

Heuristique appliquée, reprise du retour direct : une parcelle est
considérée comme probablement traitée sauf si elle correspond à de la
prairie/estive (proxy pour l'élevage) ou si elle est certifiée bio.
`code_group` 17/18/19 (estives et landes, prairies permanentes, prairies
temporaires) sert de proxy pour l'élevage — 18 et 19 confirmés en direct
(échantillon réel de parcelles `PPH`/`PTR`), 17 non vérifié localement
(pas d'estive dans la zone testée) mais nomenclature RPG stable et bien
documentée. Le statut bio, lui, ne peut **pas** être vérifié
automatiquement : le seul jeu de données trouvé (« Parcelles en
Agriculture Biologique déclarées à la PAC », Agence Bio) est publié sous
forme d'environ 190 exports statiques par département/année, pas une API
interrogeable par point — intégrer ça en direct dans un outil léger
côté navigateur n'était pas réaliste. Plutôt que de supposer « non bio »,
le texte le dit explicitement (« statut biologique non vérifiable
automatiquement ») à chaque fois que l'indicateur est affiché.

La parcelle non-prairie la plus proche est affichée avec sa distance et
sa direction (toujours les deux, comme le reste de l'outil), sa culture,
et son code RPG brut si elle n'est pas dans le petit dictionnaire de
labels de `CROP_LABELS` (non exhaustif — un code inconnu s'affiche tel
quel plutôt qu'une traduction devinée). `isPointInGeometry`,
`minDistanceToGeometryBoundaryM` et `centroidOfGeometry` (extraits de
`ppe.ts` vers `geo.ts` à cette occasion, pour éviter une troisième
copie du même calcul de géométrie polygonale) sont partagés entre
`ppe.ts` et `parcelles.ts`.

### Note de vulnérabilité/sensibilité hydro — `frontend/src/lib/hydroNote.ts`

Sous la synthèse par thème, une note narrant la vulnérabilité et la
sensibilité hydrologique/hydrogéologique du site, dans le style d'une note
de consultant plutôt qu'un simple badge — récepteurs nommés quand connus
(rivière, nappe), classification (faible/moyenne/forte) toujours assortie
d'une distance réelle au site et, pour un point BSS/ADES, de sa référence
et d'un lien vers sa fiche.

La note est structurée en deux chapitres distincts — **Eaux superficielles**
et **Eaux souterraines** — chacun scindé en **Vulnérabilité** puis
**Sensibilité** (`HydroSection`/`HydroSubsection` dans `hydroNote.ts`,
rendu par `Carte.tsx`) plutôt qu'une liste de paragraphes à plat : les deux
compartiments répondent à des questions différentes (eau de surface
atteinte par ruissellement/rejet vs. nappe atteinte par infiltration) et ne
doivent pas se lire comme un verdict unique mélangé :

- *Eaux superficielles* → Vulnérabilité (distance au cours d'eau) et
  Sensibilité (usages — baignade).
- *Eaux souterraines* → Vulnérabilité (profondeur de nappe/ouvrage ADES +
  perméabilité) et Sensibilité (périmètre de protection éloignée/captage +
  ouvrages de prélèvement).

Détail par indicateur :

- **Vulnérabilité hydrologique** : distance *réelle* au cours d'eau le
  plus proche (<150 m forte, 150–250 m moyenne, >250 m faible) —
  `frontend/src/lib/hydrography.ts` interroge le tracé BD TOPO
  (`BDTOPO_V3:cours_d_eau`, via le module WFS d'API Carto IGN) et calcule
  la distance au segment le plus proche, plutôt que la distance à la
  station de suivi qualité la plus proche (l'approche initiale, qui
  surestimait systématiquement : une station peut être à plusieurs
  kilomètres d'un cours d'eau qui passe en réalité tout près du site).
  Endpoint et nom de champ (`toponyme`) vérifiés en direct pendant le
  développement (recherche sur la Seine à Paris).
- **Sensibilité hydrologique** : `frontend/src/lib/baignade.ts` interroge
  le seul signal national réellement disponible pour les usages sensibles
  d'un cours d'eau — les sites de baignade officiels (directive
  2006/7/CE), via le jeu de données « Données de rapportage de la saison
  balnéaire » du Ministère de la Santé, lu par la Tabular API de
  data.gouv.fr (`tabular-api.data.gouv.fr`, id de ressource à rafraîchir
  chaque saison — voir le commentaire en tête du fichier). Une recherche a
  été menée pour trouver un équivalent pêche de loisir / bases nautiques :
  aucune API ou jeu de données national n'existe pour ces usages (l'API
  Hub'Eau « État piscicole » couvre des stations de suivi scientifique par
  pêche électrique, pas les usages récréatifs — l'utiliser comme substitut
  aurait affirmé plus que ce qu'elle mesure réellement ; seuls des jeux de
  données départementaux épars ont été trouvés pour les bases nautiques).
  Le texte classe donc la sensibilité hydrologique sur la distance au site
  de baignade officiel le plus proche quand il y en a un (≤1 km forte,
  1–3 km moyenne, >3 km faible) et dit explicitement qu'aucune donnée
  nationale n'existe pour la pêche/le nautisme plutôt que d'inventer un
  niveau pour ces usages.
- **Vulnérabilité hydrogéologique** : profondeur de nappe mesurée au point
  ADES le plus proche (<5 m forte, 5–15 m moyenne, >15 m faible), toujours
  citée avec sa référence BSS et un lien vers sa fiche ADES. Un seul point
  de référence (`findNearestAdesPoint` dans `hubeau.ts`) : le point
  `qualite_nappes` le plus proche, qui décrit l'entité hydrogéologique (le
  nom de la nappe), et la chronique `niveaux_nappes` de ce même `code_bss`
  pour sa profondeur — jamais deux points différents pour la nappe et la
  profondeur, qui donneraient une lecture incohérente. Hub'Eau/BDLISA
  utilisent parfois la valeur littérale « Inconnu » pour une nappe ou une
  nature non classée — un bug remonté après avoir vu s'afficher « la nappe
  des Inconnu » comme si c'était un vrai nom d'entité ; `meaningfulStr` dans
  `hubeau.ts` filtre maintenant cette valeur (et ses variantes : non
  renseigné, non communiqué, NC, indéterminé) pour retomber sur « entité non
  précisée » plutôt que de l'afficher telle quelle. Quand aucune
  mesure de niveau d'eau n'est disponible mais que le point ADES renseigne
  la profondeur de l'ouvrage lui-même (`profondeur_investigation`), cette
  profondeur est donnée à titre indicatif (clairement libellée « profondeur
  de l'ouvrage », pas « profondeur de nappe ») plutôt que de ne rien dire
  du tout — sans en tirer de classification, car ce n'est qu'un indice
  indirect. Au-delà d'1 km (`ADES_USABLE_M` dans `hydroNote.ts`, resserré
  après retour direct — un point à plusieurs kilomètres n'était plus jugé
  fiable), aucune lecture de vulnérabilité hydrogéologique n'est affichée
  du tout, plutôt qu'une classification caveatée : à cette échelle la
  profondeur au point ADES ne dit plus grand-chose de fiable sur celle au
  droit du site. La perméabilité des couches traversées entre la surface et
  la nappe — qui
  module directement cette lecture — n'est pas disponible dans les données
  publiques mobilisées ici (pas d'API donnant une lithologie exploitable
  point par point, seulement les métadonnées d'un forage BSS) ; le texte
  le dit explicitement plutôt que de l'ignorer ou de l'inventer.
- **Périmètre de protection éloignée (PPE)** : distance et direction (8
  points cardinaux) au périmètre le plus proche, réutilisant l'export
  déjà embarqué pour LYZa Cartes (`frontend/public/data/ppe.geojson`, 14
  179 périmètres), plus le captage associé (`ins_cap_ref`) avec un lien
  ADES en meilleur effort — voir `frontend/src/lib/ppe.ts`.
- **Sensibilité hydrogéologique** : nombre d'ouvrages de prélèvement
  recensés dans un rayon d'1 km (0 → faible, 1-2 → moyenne, 3+ → forte).

Chaque sous-partie retombe sur une phrase honnête (« n'a pas pu être
évalué·e », « trop éloigné pour être représentatif ») plutôt qu'une
classification fabriquée quand la donnée sous-jacente manque ou n'est pas
assez proche pour être fiable. Les seuils (distances, profondeurs) sont
des règles de lecture rapide, pas une méthode figée — à ajuster si
l'usage réel appelle d'autres bornes.

### Recherche CASIAS / SIS par rayon — `CasiasSisExplorer.tsx`

Section dédiée sous la note hydro : l'utilisateur choisit un rayon
(100 m à 5 km) et obtient deux tableaux triés par distance croissante —
identifiant (cliquable vers la fiche Géorisques quand elle existe),
société/activité (ou descriptif pour un SIS), et localisation par rapport
au site (distance + point cardinal sur 8 directions, calculés depuis la
géométrie `geom` — point ou polygone — que l'API renvoie par site).

`fetchSsp` (dans `georisques.ts`) pagine désormais les trois sous-listes
de `/ssp` (`casias`, `conclusions_sis`, `conclusions_sup`) au lieu de ne
lire que la première page — vérifié en direct : une recherche à 500 m en
plein Paris remonte 104 sites CASIAS sur plusieurs pages, qu'un appel non
paginé tronquait silencieusement. L'identifiant CASIAS est le champ
`identifiant_casias` (confirmé en direct, ex. `IDF7500001`), avec
`identifiant_ssp` en repli ; celui d'un SIS (`identifiant_sis`) est en
revanche une supposition par analogie, aucun secteur SIS n'étant apparu
dans le point testé pour le vérifier.

CASIAS regroupe dans la base Géorisques actuelle les ex-BASIAS et
ex-BASOL — l'API ne les distingue plus, d'où un seul tableau CASIAS
plutôt que deux ; un éventuel champ permettant de les re-séparer n'a pas
été identifié.

**Important — à vérifier une fois en ligne** : ce projet a été construit
dans un environnement sans accès sortant vers `georisques.gouv.fr` ni
`data.geopf.fr`. Les URLs de base et les champs de réponse pour
`installations_classees` et `ssp` (CASIAS, SIS) sont vérifiés — ils
viennent de `frontend/public/lyza-cartes.html`, un outil qui appelle
exactement ces mêmes endpoints en production. En revanche, trois choses
n'ont pas pu être confirmées en conditions réelles et méritent un coup
d'œil une fois en ligne :
- les noms de champs exacts de `zonage_sismique`, `argiles` et `radon` ;
- le format des dates renvoyées par `gaspar/catnat`
  (`frontend/src/lib/synthesis.ts` suppose un format compréhensible par
  `Date()`, sinon la date brute s'affiche telle quelle) ;
- le lien générique vers le portail Géorisques d'une commune
  (`communeRiskPortalUrl` dans `frontend/src/lib/georisques.ts`) est une
  URL construite par déduction, pas confirmée.

Les appels Hub'Eau (`hubeau.ts`) reprennent les champs déjà utilisés par
`lyza-cartes.html` en production (`profondeur_nappe`, `nom_caracteristique_aquifere`,
`nom_cours_eau`...), donc a priori fiables. Le champ « identifiant » des
tableaux CASIAS/SIS est en revanche une supposition (`identifiant`,
`id_etablissement`... par ordre de préférence) : si l'API n'en renvoie
aucun de connu, la colonne affiche « — » plutôt qu'une valeur inventée —
à vérifier une fois en ligne et à corriger dans `fetchSsp`.

Chaque appel échoue silencieusement en « donnée indisponible » plutôt que
de faire planter la synthèse, donc rien ne casse si l'un de ces points
diffère — seul l'affichage correspondant sera à ajuster.

## LYZa Cartes — `frontend/public/lyza-cartes.html`

L'explorateur cartographique complet (accessible depuis le lien « LYZa
Cartes » du menu, ou `/lyza-cartes.html`), distinct de la synthèse par
adresse ci-dessus : plus détaillé, pensé pour un usage pendant une
mission plutôt que pour un visiteur du site. C'est une page HTML
autonome (pas une route React) — Leaflet et Turf.js sont servis en local
(`frontend/public/vendor/`), sans dépendance à un CDN externe. Elle est
volontairement isolée du reste du site (CSS/JS propres, aucun risque de
collision avec les styles des autres pages).

Calques et outils repris :

- **Fond de carte** : Plan IGN, photos aériennes, OSM, photos aériennes
  historiques (IGN « Remonter le temps », par période) + comparateur
  avant/après par curseur. « Relancer automatiquement en déplaçant la
  carte » est activé par défaut.
- **Cadastre** : parcelles cadastrales, sélection de parcelles au clic,
  fusion en un seul contour (Turf.js `union`), isolement du contour
  fusionné.
- **Sites et sols pollués (Géorisques)** : ICPE par régime (autorisation /
  enregistrement / déclaration), CASIAS (ex-BASIAS/BASOL), SIS.
- **Sous-sol (BRGM)** : BSS (forages, survol pour fiche + lien log
  géologique), carte géologique imprimée 1/50 000 avec opacité réglable.
- **Eaux souterraines (Hub'Eau)** : piézométrie (avec mini-graphique de
  chronique au survol), qualité des nappes (ADES), ouvrages de
  prélèvement.
- **Eau potable (Cart'Eaux/ARS)** : périmètres de protection éloignée —
  export statique intégré (`frontend/public/data/ppe.geojson`, 14 179
  périmètres France entière, ~14 Mo) avec repli sur le WFS AtlaSanté si
  le fichier est absent ; recherche d'adresse affichant le dernier
  contrôle sanitaire de la commune.
- **Cours d'eau** : stations de qualité (Naïades) — cliquer sur une
  station charge les résultats réels de sa dernière campagne d'analyse
  (paramètre, valeur, unité, date), plutôt qu'un simple lien vers une
  fiche station (retour direct : « je préfère avoir des données qualité »).
- **Espaces protégés** : Natura 2000 ZSC/ZPS (API Carto IGN/INPN).
- **Établissements sensibles** : écoles et santé/social (annuaire
  éducation, FINESS).
- **Outils** : mesure de distance, ordre d'affichage des calques
  (glisser devant/derrière), scan automatique en déplaçant la carte (activé
  par défaut, désactivable) — la carte se met à jour toute seule, il n'y a
  plus de bouton « Actualiser » manuel (retiré : redondant une fois
  l'auto-scan activé par défaut) ; un premier scan tourne automatiquement
  dès le chargement de la page, sur la vue par défaut.

Cette page a été portée depuis une version HTML autonome fournie par
l'utilisateur, en conservant la logique d'origine à l'identique (seule
l'extraction du bloc PPE dans un fichier séparé, chargé en `fetch`, a été
modifiée — le reste des appels réseau, règles de couleur, popups et
fusion de parcelles n'a pas été réécrit).

Le calque « Référentiel des masses d'eau (Sandre) » a été retiré (retour
direct) : la case, le calque WMS et l'entrée dans l'outil d'ordre
d'affichage des calques ont été supprimés.

**Comparateur de photos aériennes — bug corrigé.** Le comparateur affichait
systématiquement la même image des deux côtés. Cause racine trouvée en
interrogeant en direct le vrai WMTS `data.geopf.fr` : les 25 périodes
« année individuelle » générées par le code (2000 à 2024, une par année,
layer `ORTHOIMAGERY.ORTHOPHOTOS<année>`) existent bien dans le catalogue
IGN, mais ne renvoient des tuiles qu'à faible zoom (probablement une
mosaïque de survol) — au-delà du zoom 13, elles renvoient systématiquement
une erreur « No data found », y compris en plein Paris. Résultat : à chaque
vérification de disponibilité (`refreshHistoAvailability`), les 25 périodes
échouaient toutes, et le code — qui repliait alors les deux menus du
comparateur sur « Aujourd'hui (actuelle) » par défaut — finissait par
comparer l'image actuelle à elle-même. Remplacé par les 5 vraies mosaïques
pluriannuelles que l'IGN publie et qui, elles, fonctionnent à tous les
niveaux de zoom testés (`ORTHOIMAGERY.ORTHOPHOTOS2000-2005` jusqu'à
`ORTHOIMAGERY.ORTHOPHOTOS2021-2023`, vérifiées en direct). Une garde-fou a
aussi été ajoutée : si les deux côtés du comparateur devaient malgré tout
se retrouver sur la même période (donnée indisponible sur la zone), le
bouton se désactive et un message explicite s'affiche plutôt que de
montrer deux vues identiques sans le dire.

**Le même symptôme est réapparu après ce premier correctif**, pour une
raison différente et plus subtile : la couche « actuelle »
(`ORTHOIMAGERY.ORTHOPHOTOS`, sans année) *est*, pour l'essentiel du
territoire, la mosaïque la plus récente déjà publiée — donc comparer
« Aujourd'hui » à la période la plus récente (ex. 2021-2023) sert
fréquemment, à un endroit donné, exactement la même prise de vue des deux
côtés, même s'il s'agit bien de deux requêtes WMTS distinctes. La
vérification de disponibilité ne suffisait donc pas : une période peut
être disponible (HTTP 200, vraie image) sans être *différente*.
Corrigé en calculant, pendant le même balayage de disponibilité, une
empreinte (longueur + somme de contrôle échantillonnée) de la tuile
« actuelle » et de chaque mosaïque récente au point testé, puis en
comparant deux à deux (`looksIdentical`, pas seulement contre
« actuelle ») avant de choisir les valeurs par défaut, avant d'activer le
comparateur, et à chaque changement manuel de sélection. Une période
identifiée comme identique à l'actuelle ici est annotée dans son libellé
(« ≈ identique à l'actuelle ici ») ; si les deux sélections en cours
rendraient malgré tout la même image, le bouton se désactive avec le
message « Les clichés disponibles semblent identiques à cet endroit… »
plutôt que d'afficher silencieusement deux vues indiscernables.

**Poignée du comparateur agrandie.** La bande cliquable pour faire glisser
le curseur était en pratique large de 2 px (la seule bordure visible du
séparateur) : la poignée ronde à 34 px de diamètre restait cliquable par
propagation d'évènement, mais rien entre les deux. Élargi la zone de
glisser-déposer invisible à 36 px sur toute la hauteur de la carte
(`::before` dessine le trait visuel de 2 px en son centre) et la poignée
elle-même à 48 px, plus un `touchAction:none` + `preventDefault` sur les
évènements tactiles pour éviter que le geste ne fasse défiler la carte en
même temps.

**Le symptôme persistait malgré tout — la cause réelle, trouvée cette
fois.** Les deux correctifs ci-dessus portaient sur la sélection des
*données* (quelle période choisir), et étaient réels et utiles, mais
aucun n'était la cause du bug rapporté : le rendu lui-même. Diagnostiqué
en lançant Chromium avec `--ignore-certificate-errors` (contournant la
limitation connue du bac à sable pour `data.geopf.fr`) pour comparer, tuile
par tuile, ce qui est réellement envoyé au navigateur et ce qui est
réellement affiché à l'écran. Un test avec le mode comparateur désactivé
(une seule couche « Photographies aériennes ») confirmait bien une image
couleur ; en mode comparateur, le côté « après » couvrait tout l'écran,
quelle que soit la sélection.

Cause : `#pane-compare-after` est un panneau Leaflet — `position:absolute`
sans largeur/hauteur propre, puisque ses enfants (les tuiles) sont
positionnés uniquement par `transform`, ce qui ne compte pour rien dans le
calcul de la taille d'un parent. `getBoundingClientRect()` confirmait une
boîte de 0×0 px. Or `clip-path: inset(...)` se calcule par rapport à la
boîte de l'élément auquel il s'applique — avec une boîte 0×0, l'inset
(en pourcentage *ou* en pixels, les deux ont été testés) produit un
rectangle dégénéré que Chromium ignore, et retombe sur un panneau non
découpé, affiché en entier. Résultat : le panneau « après » recouvrait
tout le panneau « avant » sur toute la largeur, donc les deux côtés du
curseur montraient la même image — quelles que soient les deux périodes
sélectionnées, aussi différentes soient-elles en réalité (vérifié aussi :
`mix-blend-mode` et `isolation` n'y étaient pour rien, écartés par test
direct avant d'identifier la vraie cause).

Corrigé en donnant explicitement au panneau une largeur/hauteur réelles en
pixels (`syncComparePaneSize()`, calées sur les dimensions du conteneur de
la carte, appliquée à l'activation du comparateur et sur redimensionnement)
avant d'y appliquer le `clip-path` — dès lors la boîte de référence est
réelle et l'inset découpe exactement là où on l'attend. Vérifié en direct
(vraies tuiles IGN, pas de mock) : mesure de « colorfulness » des pixels
rendus de part et d'autre du curseur (avant : ≈0, cohérent avec un cliché
N&B ; après : nettement positif, cohérent avec un cliché couleur), à 50 %
et après glisser-déposer vers une autre position, en desktop et en mobile.

**Le curseur se décalait de la ligne de séparation en déplaçant la
carte.** Conséquence directe du correctif précédent : `#pane-compare-after`
hérite du `transform` de son ancêtre `.leaflet-map-pane`, que Leaflet
décale en continu pendant un glisser de la carte (et ne remet pas à zéro
après, contrairement à ce qu'on pourrait attendre — vérifié en lisant
`getBoundingClientRect()` du panneau plusieurs secondes après un
déplacement : toujours décalé exactement du delta du glisser). Le
séparateur visuel, lui, est volontairement en dehors de cette
transformation (ajouté directement au conteneur de la carte, pour rester
fixe à l'écran) — donc le `clip-path`, exprimé en pixels dans le repère
*local* (mobile) du panneau, part se désynchroniser du séparateur dès que
la carte bouge. Corrigé en recalculant le `clip-path` à chaque évènement
`move`/`zoom` de la carte, à partir des `getBoundingClientRect()` actuels
du conteneur et du panneau plutôt que d'une valeur figée au moment du
réglage — ça convertit la position d'écran voulue vers le repère local du
panneau à chaque fois, donc la ligne de découpe suit le séparateur quel
que soit le décalage accumulé. Vérifié en direct : glisser-déposer du
curseur, puis déplacement de la carte, puis zoom, puis un second
déplacement — la ligne de séparation reste alignée avec le curseur à
chaque étape.

## Actualités — `/actualites` (`frontend/src/pages/Blog.tsx`, `frontend/src/content/blog.ts`)

Page de veille réglementaire et environnementale : une liste de notes
courtes (`frontend/src/content/blog.ts`, un tableau `BlogPost[]`), chacune
avec un titre, un résumé, un corps en plusieurs paragraphes, des tags, et
un lien obligatoire vers sa source primaire. Les trois notes les plus
récentes sont aussi mises en avant sur la page d'accueil (`Home.tsx`),
juste sous le hero, avec un lien vers la liste complète. `Blog.tsx` liste les notes
(plus récentes d'abord), `BlogPost.tsx` affiche une note en entier — même
schéma de routes que l'accompagnement (`/accompagnement` + `/accompagnement/:slug`).

Le site restant entièrement statique (pas de backend, pas de base de
données), le contenu vit dans le dépôt : chaque nouvelle note est un ajout
au tableau `posts`, commité et poussé sur `main` comme n'importe quel autre
changement — le déploiement GitHub Pages existant s'en charge.

**Alimentation quotidienne automatique.** Une routine planifiée (déclenchée
une fois par jour) relance une session Claude Code dédiée qui :
1. Recherche l'actualité réglementaire/environnementale française récente
   pertinente pour le métier (eau, sols, risques, zones protégées, ICPE…) ;
2. Rédige une note courte et factuelle en français, sourcée ;
3. Vérifie qu'aucune note existante ne couvre déjà le même sujet/la même
   source récemment ;
4. L'ajoute à `frontend/src/content/blog.ts`, vérifie `tsc`/`build`, commite
   et pousse sur `main` — sans rien inventer : si aucune actualité
   pertinente n'est trouvée ce jour-là, la routine ne publie rien plutôt que
   de forcer une note creuse.

Le champ `summary` de chaque note est volontairement une courte synthèse
autoportante de 2-3 phrases (pas juste une accroche à une ligne) — c'est
ce texte qui apparaît dans les cartouches de la page Actualités et de
l'accueil, donc quelqu'un qui ne lit que le cartouche doit repartir avec
les faits clés, pas seulement l'envie de cliquer. Le corps (`body`)
détaille davantage. La page `/actualites` et l'accueil rappellent tous
deux la portée de la veille et sa fréquence (« mise à jour quotidienne »),
pour que le lecteur sache sur quoi porte la sélection sans avoir à le
deviner.

Les deux notes actuellement en place (état des nappes phréatiques au 1er
septembre 2026 d'après le BRGM, et l'annulation par le Conseil d'État de
l'assouplissement 2024 sur les plans d'eau en zone humide) ont été rédigées
à la mise en place de la page, comme premier contenu ; la routine prend le
relais pour les jours suivants.

## Eau quantitative — `/eau-quantitative` (`frontend/src/pages/EauQuantitative.tsx`)

Onglet demandé explicitement, orienté collectivités : un état de la
ressource en eau (souterraine et superficielle), les arrêtés de
restriction en vigueur, et des exemples concrets pour réduire les
consommations sur un territoire. Remplace l'ancien outil « Restrictions
d'eau » (`/restrictions-eau` y redirige désormais) en l'intégrant comme un
chapitre parmi d'autres plutôt que comme un outil isolé.

**Exemples pour réduire les consommations** : six leviers déjà mobilisés
par des collectivités (rendement des réseaux/sectorisation, patrimoine et
services publics, gestion différenciée des espaces verts, récupération/
réutilisation de l'eau, désimperméabilisation, tarification et
sensibilisation), rédigés à partir d'une recherche des dispositifs
publics réels en cours (Plan Eau, « Défi Sobriété -10 % d'Eau »
ministère/AMORCE, ADEME) plutôt qu'inventés — chaque carte pointe vers sa
source. Section statique, affichée sans qu'une adresse soit nécessaire :
c'est le contenu qu'un visiteur qui ne cherche pas une adresse précise
doit quand même repartir avec.

**État des ressources**, une fois une adresse saisie (mairie, siège de la
collectivité) — toujours présenté sur une carte (réutilisation de
`SensitivityMap.tsx`), avec deux cartouches à côté :
- *Eaux souterraines* : réutilise `findNearestAdesPoint` (`lib/hubeau.ts`,
  déjà utilisé par la note de vulnérabilité hydro de l'outil « Évaluer un
  site ») — entité hydrogéologique, dernier niveau mesuré ou profondeur de
  l'ouvrage à défaut, lien vers la chronique ADES complète.
- *Eaux superficielles* : nouvelle librairie `frontend/src/lib/hydrometrie.ts`
  — Hub'Eau Hydrométrie (`/v2/hydrometrie/`), vérifiée en direct
  (septembre 2026) : `referentiel/stations` pour la station en service la
  plus proche (champs `latitude_station`/`longitude_station`, pas une
  géométrie GeoJSON contrairement aux autres API Hub'Eau utilisées
  ailleurs sur ce site), puis `obs_elab` avec `grandeur_hydro_elab=QmnJ`
  (débit moyen journalier — `QmJ` sans le « n » n'est *pas* une valeur
  valide, confirmé par l'erreur de validation de l'API elle-même) filtré
  par `date_debut_obs_elab`/`date_fin_obs_elab` sur les ~120 derniers
  jours. Débit le plus récent affiché en m³/s, avec une tendance à 30
  jours (comparaison simple dernière valeur / valeur ~30 jours plus tôt,
  pas une comparaison statistique à l'historique pluriannuel — hors de
  portée d'un appel unique côté navigateur) et un mini-graphique
  (`DischargeSparkline`, SVG à la main).

**Arrêtés en vigueur** : même logique que l'ancien outil « Restrictions
d'eau » (API VigiEau, ministère de la Transition écologique — voir détail
ci-après), simplement déplacée dans cette page comme second chapitre après
l'état des ressources plutôt que sur sa propre URL.

<details>
<summary>Détail VigiEau (historique, inchangé)</summary>

L'API VigiEau
([api.vigieau.beta.gouv.fr](https://api.vigieau.beta.gouv.fr) — spec
trouvée en direct sur `/swagger-json`, non documentée dans le catalogue
data.gouv.fr) renvoie, pour une adresse, le niveau de restriction d'eau
réellement en vigueur — `vigilance` / `alerte` / `alerte_renforcee` /
`crise` — séparément pour les eaux superficielles, les eaux souterraines
et l'eau potable (`GET /api/zones?lat&lon`), avec le détail des usages
concrètement interdits ou limités (arrosage, prélèvements, lavage…) et un
lien vers l'arrêté préfectoral (PDF) réellement en vigueur. Vérifié en
direct avant implémentation : une adresse réelle testée pendant le
développement (Manche, sécheresse 2026) est ressortie en niveau *crise*
sur les trois types d'eau, avec 17 à 22 usages listés par zone — donnée
manifestement vivante, pas un jeu de données figé.

Un tableau de zones plutôt qu'une valeur unique est renvoyé par
l'API : un même site peut être en alerte renforcée pour les eaux
superficielles et seulement en vigilance pour l'eau potable, d'où
plusieurs cartes possibles par adresse, triées par gravité décroissante
(`sortBySeverityDesc`). Chaque carte affiche son niveau, son type d'eau,
les dates de validité de l'arrêté, et un repli `<details>` listant les
usages (groupés par thématique) — repliable pour ne pas noyer la page
quand une zone en compte vingt. Comme partout ailleurs sur le site : `null`
en cas d'échec réseau, message honnête plutôt qu'une absence de
restriction fabriquée ; un tableau vide est un résultat réel et distinct
(« aucune restriction actuellement »), pas une erreur.

</details>

## ICPE & émissions — cartouche de LYZa Cartes (`frontend/public/lyza-cartes.html`)

Initialement une page dédiée (`/icpe-emissions`), demandée explicitement
(« avoir les ICPE + les roses des vents + les résultats émissions/rejet »).
À la demande de l'utilisateur lors de la refonte plateforme, la partie
ICPE + émissions est maintenant gérée directement **dans le cartouche
(popup) ICPE de LYZa Cartes** plutôt que sur une page séparée : cliquer sur
une installation classée charge, en plus de sa fiche existante (régime,
NAF, Seveso, lien Géorisques), ses émissions et prélèvements déclarés au
registre IREP — chargés à la demande (`popupopen`), pas au chargement de
la couche : un scan peut remonter des centaines d'ICPE, et la plupart ne
déclarent de toute façon rien à l'IREP. Même mécanisme que les analyses de
qualité des cours d'eau au clic (`riverQualityMarker`, déjà en place) :
placeholder dans le popup, rempli après coup. Jusqu'à 8 lignes de rejets
et 8 de prélèvements par établissement, puis un repli « + N autres » —
même convention que les tableaux CASIAS/SIS de l'outil « Évaluer un
site » — pour éviter un cartouche interminable sur un site qui déclare des
dizaines de polluants.

**IREP** : le seul accès *documenté* est un export ZIP annuel —
inutilisable pour une consultation live par adresse. Géorisques a
cependant sa propre page « registre des émissions polluantes » par
établissement, adossée à une API JSON non documentée mais réelle, trouvée
en chargeant cette page et en inspectant ses propres appels réseau, puis
vérifiée en direct (recherche, détail, émissions, prélèvements). Deux
pièges découverts et corrigés en cours de route :
- Le frontend de Géorisques appelle lui-même `.../etablissement/{id}data/emission`
  (slash manquant), ce qui renvoie une 400 — y compris sur leur propre
  site en production. Le chemin qui fonctionne réellement est
  `.../etablissement/{id}/emission` (sans segment `data`).
- Le paramètre `siret` de la recherche est accepté mais **silencieusement
  ignoré** par l'API — vérifié en passant un SIRET inventé, qui renvoie
  exactement le même nombre de résultats (13 499) qu'un SIRET réel. Un
  premier essai avec ce paramètre laissait croire, à tort, que des sites
  industriels majeurs (LUBRIZOL, TOTALENERGIES) ne déclaraient pas à
  l'IREP. Corrigé en recherchant par nom d'établissement (`nomEtablissement`,
  qui fait une vraie recherche par sous-chaîne) puis en filtrant sur la
  commune, car un même nom peut exister dans plusieurs communes (IREP
  recense 3 « LUBRIZOL FRANCE » distincts). Revérifié en direct : un ICPE
  réel (TRIADIS SERVICES, Rouen) retrouve bien ses rejets air/CO2 et
  seuils déclarés par polluant, à jour 2025.

Ne pas déclarer à l'IREP est un résultat honnête et attendu pour la
plupart des ICPE (seuls les sites dépassant certains seuils y sont tenus),
affiché comme tel plutôt que comme une erreur.

**Rose des vents retirée.** L'ancienne page combinait aussi une rose des
vents (Open-Meteo/ERA5, `lib/wind.ts` + `WindRoseChart.tsx`) — hors du
périmètre explicitement demandé pour ce cartouche (« ICPE et émission »,
pas la météo) et sans autre emplacement naturel sur le site après la
suppression de la page dédiée ; plutôt que la laisser orpheline, elle a
été retirée avec les fichiers qui ne servaient qu'à elle.

## Compatibilité mobile

Vérifiée avec Playwright à une largeur de 390 px (iPhone 12/13) sur les sept
pages du site React et sur LYZa Cartes, en détectant automatiquement tout
élément dépassant la largeur de la fenêtre plutôt qu'en se fiant uniquement
à l'inspection visuelle. Deux vrais bugs trouvés et corrigés :

- **Débordement horizontal sur toutes les pages du site React** :
  `Footer.tsx` utilisait une grille à 3 colonnes fixes en style inline
  (`gridTemplateColumns: 'repeat(3, 1fr)'`), qui ne participait pas aux
  points de rupture responsive déjà définis pour les classes utilitaires
  `.grid--3` dans `index.css`. Sur petit écran, l'adresse e-mail (chaîne
  non sécable) forçait la colonne à dépasser la largeur de l'écran.
  Remplacé par les classes `grid grid--3`, qui repassent à 1 colonne sous
  640 px comme partout ailleurs sur le site.
- **Carte invisible sur mobile dans LYZa Cartes** : en dessous de 760 px,
  la mise en page passe d'une grille en colonnes (barre latérale + carte)
  à une grille en lignes. La règle voulait mettre la carte en premier
  (ligne haute) et la barre latérale en second (ligne basse, plafonnée à
  44 % de la hauteur d'écran) via `order`, mais `order` était posé sur
  `#map` — qui n'est pas lui-même un élément de la grille (`.app`), c'est
  son parent — donc sans effet. Combiné à `grid-template-rows: auto 1fr` et
  à `#map{ height:100% }` (un pourcentage de hauteur ne se résout pas dans
  une ligne « auto »), la ligne de la carte s'effondrait à une hauteur
  quasi nulle : la carte ne s'affichait tout simplement pas, seule la barre
  latérale (plafonnée, avec un grand vide en dessous) était visible.
  Corrigé en donnant un id au conteneur de la carte (`#map-wrap`, la cible
  réelle de la grille) et en inversant les lignes (`1fr auto`) pour que la
  carte reçoive la hauteur définie en pixels dont elle a besoin.

## Prochaines pistes (analytique) — `backend/`

Le site n'a pas de backend, mais `backend/` existe toujours en local comme
boîte à outils Python : c'est un port fidèle de `frontend/src/lib/` (mêmes
règles de classification, mêmes appels Géorisques/BAN) pensé pour des
scripts d'analyse plutôt que pour être déployé.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest   # tests hors-ligne (réseau simulé avec respx)
python -m app.analytics.batch_scoring addresses.csv   # scoring par lots -> CSV/DataFrame
```

- `app/analytics/batch_scoring.py` : script d'exemple pour scorer une liste
  d'adresses (CSV) en DataFrame pandas — point de départ pour du criblage
  de parcelles à plus grande échelle.
- `app/rules.py` : règles de classification (Faible / Modérée / Élevée),
  pures et testées isolément, identiques à `frontend/src/lib/rules.ts` —
  c'est le morceau le plus susceptible d'être recalibré/étendu.
- `app/providers/georisques.py`, `app/geocode.py`, `app/synthesis.py` :
  mêmes appels et même agrégation que côté frontend, réutilisables sans
  navigateur pour du traitement par lots.
- Ajouter une source de données revient à écrire un nouveau module dans
  `app/providers/` (et son équivalent dans `frontend/src/lib/` si le site
  doit aussi en profiter), à l'inclure dans les appels parallèles de
  `synthesis.py`, et éventuellement à créer un nouveau thème.

Les deux implémentations (Python et TypeScript) ne se rappellent pas l'une
l'autre — un changement de règle métier est à reporter dans les deux si les
deux usages doivent rester cohérents.
