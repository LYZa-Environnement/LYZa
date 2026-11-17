#!/usr/bin/env bash
# Télécharge les données sources des zones humides (50, 14, 61, 76, 35, 22, 53)
# dans le dossier passé en argument (par défaut ./sources). Voir README.md.
set -euo pipefail
OUT="${1:-sources}"; mkdir -p "$OUT"/{deps,gb22}
ATOM="https://atom.geo-ide.developpement-durable.gouv.fr/atomArchive/GetResource?dataType=dataset&id="
get_zip(){ mkdir -p "$OUT/$1"; curl -fsSL -o "$OUT/$1/$1.zip" "$ATOM$2"; (cd "$OUT/$1" && unzip -qo "$1.zip"); }

# DREAL Normandie — inventaire régional des zones humides (r28)
get_zip norm_zh be433f7d-cb7a-426a-92c5-491a6a155a62
# DREAL Normandie — milieux prédisposés à la présence de zones humides (MPPZH)
get_zip mpzh50 eb0cd193-fd0f-4fde-aa01-e5fd4e6233b9
get_zip mpzh14 a4b9578f-b364-44bb-9587-f4ff51558c20
get_zip mpzh61 f8a19cdf-23b0-4e15-bd83-96be4edfe10a
get_zip mpzh76 6461740a-9843-4fbd-a280-c8efe1adecf3
# DDTM Ille-et-Vilaine — inventaire des zones humides (35)
get_zip zh35 eaba0c88-bce1-4bd5-b4eb-02fd27d8aa36
# DREAL Pays de la Loire — prélocalisation des zones humides probables (53)
mkdir -p "$OUT/preloc53"
curl -fsSL -o "$OUT/preloc53/preloc53.geojson" "https://catalogue.sigloire.fr/api/data/1fbd07ae-794b-4c34-b4b6-f97f7e7285d5?srs=EPSG:4326"
# Côtes-d'Armor — inventaires SAGE publiés sur GéoBretagne (pas de couche départementale)
gb(){ local ws=${1%%:*}; curl -fsSL -o "$OUT/gb22/${1#*:}.json" "https://geobretagne.fr/geoserver/$ws/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=$1&outputFormat=application/json&srsName=EPSG:2154${2:-}"; }
gb smbsb:izh_sage_bsb
gb guingamppaimpol:izh_sage_atg
gb lannion-tregor:zh_sage_baiedelannion
gb smap22:izh_sage_arguenon_fresnaye
gb rancefremur:zonehumidesagerfbb
# Le SAGE Vilaine complet dépasse ce que le serveur renvoie en une fois : emprise du 22 seulement.
gb iav:izh_sage_vilaine "&bbox=47.99,-3.70,48.90,-1.90,urn:ogc:def:crs:EPSG::4326"
# Contours départementaux (communes, geo.api.gouv.fr)
for d in 50 14 61 76 35 22 53; do
  curl -fsSL -o "$OUT/deps/$d.json" "https://geo.api.gouv.fr/departements/$d/communes?format=geojson&geometry=contour&fields=code"
done
