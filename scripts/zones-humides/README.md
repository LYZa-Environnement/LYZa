# Zones humides départementales — génération des tuiles

Produit `frontend/public/data/zh/`, utilisé par LYZa Cartes (rubrique
« Zones humides », couches « Inventaires départementaux » et « Zones humides
probables »).

```bash
pip install shapely pyproj          # + mapshaper : npm i -g mapshaper
./download.sh /chemin/sources       # ~ 400 Mo d'archives
python build.py /chemin/sources ../../frontend/public/data/zh
```

## Sources par département

| Dép. | Inventaire (couche `inv`) | Zones probables (couche `pot`) |
|------|---------------------------|--------------------------------|
| 50, 14, 61, 76 | Inventaire régional des zones humides — DREAL Normandie (filtré sur le département, l'Eure est exclue) | Milieux prédisposés à la présence de zones humides — DREAL Normandie, un jeu par département |
| 35 | Inventaire des zones humides — DDTM 35 | — |
| 22 | Pas de couche départementale : inventaires des SAGE publiés sur GéoBretagne (Baie de Saint-Brieuc, Argoat-Trégor-Goëlo, Baie de Lannion, Arguenon-Fresnaye, Rance-Frémur, Vilaine), filtrés sur le 22. Les SAGE Blavet et Aulne ne publient pas leur inventaire. | — |
| 53 | Pas d'inventaire départemental publié | Prélocalisation des zones humides probables — DREAL Pays de la Loire (SIGLOIRE) |

Une entité est rattachée à un département par son point représentatif
(`representative_point`), sans découpe à la limite.

## Traitements

- **Inventaires et prélocalisation 53** : réparation des géométries,
  simplification à 1 m, coordonnées arrondies au mètre. Attributs
  harmonisés en clés courtes : `t` type de milieu, `m` méthode, `q`
  qualité/fiabilité, `y` année de validation, `o` maître d'ouvrage (ou
  interprète en Normandie), `r` rôle fonctionnel, `k=deg` zone humide
  dégradée, `s` code source (libellés dans `index.json`), `d` département.
  Pour les inventaires bretons, le type vient du champ descriptif du SAGE
  quand il existe, sinon du code CORINE Biotopes traduit.
- **Milieux prédisposés (Normandie)** : raster vectorisé à 5 m (jusqu'à
  628 000 polygones par département). Codes `dn` regroupés selon la notice
  DREAL : `1`/`101` fort, `100`/`102` probabilité significative du modèle
  national PatriNat, `2` faible. Fusion par classe, suppression des îlots
  isolés de moins de 150 m² (6 pixels), simplification à 10 m. Écart de
  surface mesuré sur la Seine-Maritime : moins de 3,5 % par classe.

## Format des tuiles

Tuiles de 10 km × 10 km en Lambert 93 (`inv/tx_ty.json`, `pot/tx_ty.json`,
liste dans `index.json`). Chaque tuile vaut
`{"p": [props, …], "f": [[indice_props, polygones], …]}` (table d'attributs
par tuile, les combinaisons se répétant beaucoup) ;
un polygone est une liste d'anneaux, un anneau une liste plate
`[x0, y0, dx1, dy1, …]` en mètres entiers, `x0`/`y0` relatifs au coin de la
tuile. Ce codage divise la taille par environ 3 par rapport à du GeoJSON
WGS84. Les zones inventoriées sont rangées entières dans la tuile du centre
de leur emprise : la carte charge une tuile de marge autour de la vue. Les
milieux prédisposés, fusionnés en grands ensembles, sont découpés à la tuile.
