# LYZa — site & carte de sensibilité environnementale

Site professionnel pour LYZa (Léo Yecora-Zorzano, conseil en environnement et
hydrogéologie), incluant la présentation de l'activité, les prestations, et
un outil interactif ("Évaluer un site") : l'utilisateur saisit une adresse,
la voit positionnée sur une carte, et obtient une synthèse de sensibilité
environnementale construite à partir de données publiques.

## Architecture

```
backend/     API Python (FastAPI) — géocodage, appels aux données publiques,
             agrégation en synthèse de sensibilité. Voir backend/app/analytics
             pour le traitement par lots (pandas), pensé pour les futures
             analyses plus poussées.
frontend/    Site React (Vite + TypeScript) — pages du site + outil carte
             (Leaflet) consommant l'API du backend.
```

Le choix d'un backend Python séparé (plutôt que tout faire en JavaScript
côté client) est déterminé par l'usage prévu : les prochaines demandes
portent sur des analyses plus poussées (probablement en Python/pandas). En
gardant toute la logique de géocodage et de synthèse côté backend, elle est
directement réutilisable par des scripts d'analyse par lots — voir
`backend/app/analytics/batch_scoring.py`, qui note une liste d'adresses en
CSV en réutilisant exactement le même code que l'API.

### Backend — `backend/`

- `app/geocode.py` : géocodage d'adresse via l'API Adresse (BAN, IGN
  Géoplateforme), sans clé.
- `app/providers/georisques.py` : client pour l'API Géorisques (BRGM),
  sans clé — sites et sols pollués, BASIAS, ICPE, mouvements de terrain,
  cavités, zones inondables, sismicité, argiles, radon.
- `app/rules.py` : règles de classification (Faible / Modérée / Élevée),
  pures et testées isolément — c'est le morceau le plus susceptible d'être
  réutilisé/étendu par de futures analyses.
- `app/synthesis.py` : agrège les indicateurs en quatre thèmes (Sols, Eau,
  Risques naturels, Activités industrielles).
- `app/api/routes.py` : `GET /api/geocode`, `GET /api/sensitivity`.
- `app/analytics/batch_scoring.py` : script d'exemple pour scorer une liste
  d'adresses (CSV) en DataFrame pandas — point de départ pour du criblage de
  parcelles à plus grande échelle.

**Important — endpoints à vérifier après déploiement** : ce projet a été
construit dans un environnement sans accès sortant vers `georisques.gouv.fr`
ni `data.geopf.fr`. Les URLs de base sont vérifiées (récupérées depuis le
catalogue data.gouv.fr), mais les noms de paramètres exacts de certains
endpoints Géorisques (`zonage_sismique`, `argiles`, `radon`) n'ont pas pu
être testés en conditions réelles. Chaque appel échoue silencieusement en
« donnée indisponible » plutôt que de faire planter la synthèse — mais il
faut lancer un test réel une fois déployé (voir plus bas) et ajuster
`app/providers/georisques.py` si un champ de réponse diffère.

#### Lancer le backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

#### Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

Les tests (`tests/`) ne dépendent d'aucun accès réseau : les appels HTTP
sont simulés avec `respx`. Une fois déployé avec un accès réseau réel, un
test de fumée manuel est recommandé :

```bash
curl "http://localhost:8000/api/geocode?q=1+rue+de+la+paix+paris"
curl "http://localhost:8000/api/sensitivity?lat=48.8697&lon=2.3305&label=test&citycode=75102"
```

### Frontend — `frontend/`

```bash
cd frontend
npm install
npm run dev
```

Le serveur de dev (`http://localhost:5173`) proxie `/api/*` vers
`http://127.0.0.1:8000` (voir `vite.config.ts`) — lancer le backend en
parallèle. En production, servir le build (`npm run build` → `dist/`)
derrière un reverse proxy qui route `/api` vers le backend, ou définir
`VITE_API_BASE_URL` au build.

Pages : Accueil, Présentation, Prestations (+ page de détail par
prestation), Évaluer un site (la carte), Secteurs d'intervention, Démarche,
Contact.

## L'outil "Évaluer un site"

1. L'utilisateur saisit une adresse (autocomplétion via l'API Adresse).
2. L'adresse est positionnée sur une carte simplifiée (Leaflet / fond
   OpenStreetMap), avec un rayon d'analyse de 500 m.
3. Le backend interroge l'API Géorisques autour du point et agrège les
   résultats en quatre thèmes : **Sols** (BASIAS, sites et sols pollués),
   **Eau** (zones inondables, historique catastrophe naturelle),
   **Risques naturels** (mouvements de terrain, cavités, sismicité,
   argiles, radon), **Activités industrielles** (ICPE, canalisations de
   matières dangereuses).
4. Chaque thème reçoit un niveau (Faible / Modérée / Élevée / Non
   déterminée) selon des règles explicites, pas un score opaque — voir
   `backend/app/rules.py`.
5. Selon les thèmes signalés, la page propose les prestations pertinentes
   (ex. un signal sur l'eau renvoie vers la prestation hydrogéologie).

Un avertissement est affiché systématiquement : la synthèse s'appuie sur
des données publiques et ne remplace pas une étude réglementaire.

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
  avant/après par curseur.
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
- **Cours d'eau** : stations de qualité (Naïades), référentiel des
  masses d'eau (Sandre).
- **Espaces protégés** : Natura 2000 ZSC/ZPS (API Carto IGN/INPN).
- **Établissements sensibles** : écoles et santé/social (annuaire
  éducation, FINESS).
- **Outils** : mesure de distance, ordre d'affichage des calques
  (glisser devant/derrière), scan automatique en déplaçant la carte.

Cette page a été portée depuis une version HTML autonome fournie par
l'utilisateur, en conservant la logique d'origine à l'identique (seule
l'extraction du bloc PPE dans un fichier séparé, chargé en `fetch`, a été
modifiée — le reste des appels réseau, règles de couleur, popups et
fusion de parcelles n'a pas été réécrit).

## Prochaines pistes (analytique)

L'architecture est pensée pour absorber des demandes plus analytiques :

- `app/analytics/` est l'endroit prévu pour des scripts pandas/geopandas
  (criblage de parcelles, export GeoJSON, comparaison de plusieurs sites).
- La logique de classification étant isolée (`app/rules.py`), elle peut
  être recalibrée ou enrichie sans toucher aux appels réseau.
- Ajouter une source de données revient à écrire un nouveau module dans
  `app/providers/`, l'inclure dans `asyncio.gather` de `synthesis.py`, et
  éventuellement créer un nouveau thème.
