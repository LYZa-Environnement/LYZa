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
   OpenStreetMap), avec un rayon d'analyse de 500 m.
3. Le navigateur interroge l'API Géorisques autour du point
   (`frontend/src/lib/georisques.ts`) et agrège les résultats en quatre
   thèmes (`frontend/src/lib/synthesis.ts`) : **Sols** (BASIAS, sites et
   sols pollués), **Eau** (zones inondables, historique catastrophe
   naturelle), **Risques naturels** (mouvements de terrain, cavités,
   sismicité, argiles, radon), **Activités industrielles** (ICPE,
   canalisations de matières dangereuses).
4. Chaque thème reçoit un niveau (Faible / Modérée / Élevée / Non
   déterminée) selon des règles explicites, pas un score opaque — voir
   `frontend/src/lib/rules.ts`.
5. Selon les thèmes signalés, la page propose les prestations pertinentes
   (ex. un signal sur l'eau renvoie vers la prestation hydrogéologie).

Un avertissement est affiché systématiquement : la synthèse s'appuie sur
des données publiques et ne remplace pas une étude réglementaire.

**Important — endpoints à vérifier une fois en ligne** : ce projet a été
construit dans un environnement sans accès sortant vers `georisques.gouv.fr`
ni `data.geopf.fr`. Les URLs de base sont vérifiées (récupérées depuis le
catalogue data.gouv.fr) et le scénario a été validé avec des réponses
simulées, mais les noms de champs exacts de certains endpoints Géorisques
(`zonage_sismique`, `argiles`, `radon`) n'ont pas pu être confirmés en
conditions réelles. Chaque appel échoue silencieusement en « donnée
indisponible » plutôt que de faire planter la synthèse — un test réel une
fois en ligne reste recommandé, en ajustant `frontend/src/lib/georisques.ts`
si un champ diffère.

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
