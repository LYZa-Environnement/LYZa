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

## Déploiement — GitHub Pages

`.github/workflows/deploy-pages.yml` build et déploie automatiquement
`frontend/` sur GitHub Pages à chaque push sur `main` (nécessite d'activer
Pages une fois dans les paramètres du dépôt : Settings → Pages → Source =
"GitHub Actions"). URL : `https://lyza-environnement.github.io/LYZa/`.

Deux adaptations spécifiques à ce mode d'hébergement statique :

- Le routage utilise `HashRouter` (URLs en `#/prestations`) plutôt que
  `BrowserRouter`, car GitHub Pages n'a pas de règle de réécriture
  serveur pour les liens profonds d'une SPA — un rafraîchissement sur
  `/prestations` renverrait une 404 avec un routeur basé sur l'URL réelle.
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

Pages : Accueil, Présentation, Prestations (+ page de détail par
prestation), Évaluer un site (la carte), LYZa Cartes, Secteurs
d'intervention, Démarche, Contact.

## L'outil "Évaluer un site"

1. L'utilisateur saisit une adresse (autocomplétion via l'API Adresse —
   `frontend/src/lib/geocode.ts`, appel direct au navigateur).
2. L'adresse est positionnée sur une carte simplifiée (Leaflet / fond
   OpenStreetMap), avec un rayon d'analyse de 1 000 m.
3. Le navigateur interroge l'API Géorisques autour du point
   (`frontend/src/lib/georisques.ts`) et agrège les résultats en quatre
   thèmes (`frontend/src/lib/synthesis.ts`) : **Sols** (BASIAS, sites et
   sols pollués), **Eau** (zones inondables, historique catastrophe
   naturelle), **Risques naturels** (mouvements de terrain, cavités,
   sismicité, argiles, radon), **Activités industrielles** (ICPE,
   canalisations de matières dangereuses).
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
