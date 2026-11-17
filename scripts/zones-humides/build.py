"""Construit les tuiles « zones humides » de LYZa Cartes.

Entrée : le dossier rempli par download.sh (sources DREAL / DDT(M) / SAGE).
Sortie : frontend/public/data/zh/ — index.json + deux couches en tuiles de
10 km × 10 km en Lambert 93 :

  inv/  zones humides inventoriées (Normandie 50/14/61/76, 35, 22)
  pot/  zones humides probables : milieux prédisposés DREAL Normandie
        (50/14/61/76) et prélocalisation DREAL Pays de la Loire (53)

Format d'une tuile (JSON compact, décodé par lyza-cartes.html) :
  {"p": [props, ...], "f": [[indice_props, [polygone, ...]], ...]}
  polygone = [anneau, ...]; anneau = [x0, y0, dx1, dy1, dx2, dy2, ...]
  en mètres entiers Lambert 93, x0/y0 relatifs à l'origine de la tuile.
Les zones inventoriées (et la prélocalisation 53) sont rangées entières,
sans découpe, dans la tuile qui contient le centre de leur emprise : le
client charge une tuile de marge autour de la vue pour les afficher même
quand elles débordent. Les milieux prédisposés (fusionnés par classe) sont
découpés à la tuile.

Usage :  python build.py SOURCES_DIR OUTPUT_DIR
Prérequis : pip install shapely pyproj ; mapshaper (npm) dans le PATH.
"""

import json
import math
import os
import re
import subprocess
import sys
from collections import defaultdict

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import box, shape

TILE = 10_000  # m
TO_L93 = Transformer.from_crs(4326, 2154, always_xy=True)

SOURCES = {
    'n28': {'label': 'Inventaire régional des zones humides', 'org': 'DREAL Normandie',
            'url': 'https://www.data.gouv.fr/datasets/zones-humides-normandie'},
    'd35': {'label': 'Inventaire des zones humides d’Ille-et-Vilaine', 'org': 'DDTM 35',
            'url': 'https://www.data.gouv.fr/datasets/inventaire-des-zones-humides-dans-le-departement-dille-et-vilaine'},
    'bsb': {'label': 'Inventaire SAGE Baie de Saint-Brieuc', 'org': 'EPTB Baie de Saint-Brieuc (GéoBretagne)',
            'url': 'https://geobretagne.fr/geonetwork/srv/fre/catalog.search#/search?any=izh_sage_bsb'},
    'atg': {'label': 'Inventaire SAGE Argoat-Trégor-Goëlo', 'org': 'SMEGA / SMJGB (GéoBretagne)',
            'url': 'https://geobretagne.fr/geonetwork/srv/fre/catalog.search#/search?any=izh_sage_atg'},
    'bdl': {'label': 'Inventaire SAGE Baie de Lannion', 'org': 'Lannion-Trégor Communauté (GéoBretagne)',
            'url': 'https://geobretagne.fr/geonetwork/srv/fre/catalog.search#/search?any=zh_sage_baiedelannion'},
    'abf': {'label': 'Inventaire SAGE Arguenon – Baie de la Fresnaye', 'org': 'SMAP (GéoBretagne)',
            'url': 'https://geobretagne.fr/geonetwork/srv/fre/catalog.search#/search?any=izh_sage_arguenon_fresnaye'},
    'rfb': {'label': 'Inventaire SAGE Rance Frémur Baie de Beaussais', 'org': 'EPTB Rance Frémur (GéoBretagne)',
            'url': 'https://geobretagne.fr/geonetwork/srv/fre/catalog.search#/search?any=zonehumidesagerfbb'},
    'vil': {'label': 'Inventaire SAGE Vilaine', 'org': 'EPTB Vilaine (GéoBretagne)',
            'url': 'https://geobretagne.fr/geonetwork/srv/fre/catalog.search#/search?any=izh_sage_vilaine'},
    'mpp': {'label': 'Milieux prédisposés à la présence de zones humides', 'org': 'DREAL Normandie',
            'url': 'https://www.donnees.normandie.developpement-durable.gouv.fr/pdf/ZH/Notice_ZH.pdf'},
    'p53': {'label': 'Prélocalisation des zones humides probables en Mayenne', 'org': 'DREAL Pays de la Loire',
            'url': 'https://www.data.gouv.fr/datasets/prelocalisation-des-zones-humides-probables-en-mayenne-1'},
}

# Libellés CORINE Biotopes (préfixe le plus long qui correspond).
CORINE = {
    '13': 'Estuaires', '14': 'Vasières', '15': 'Prés salés, marais salés', '16.3': 'Dépressions humides dunaires',
    '22': 'Eaux douces stagnantes (mares, étangs)', '24': 'Eaux courantes',
    '31': 'Landes', '31.1': 'Landes humides', '37': 'Prairies humides et mégaphorbiaies', '37.1': 'Mégaphorbiaies',
    '37.2': 'Prairies humides eutrophes', '37.3': 'Prairies humides oligotrophes', '37.7': 'Lisières humides à grandes herbes',
    '38': 'Prairies mésophiles', '41': 'Forêts caducifoliées', '42': 'Forêts de conifères', '43': 'Forêts mixtes',
    '44': 'Forêts et fourrés très humides', '44.1': 'Saulaies riveraines', '44.3': 'Forêts riveraines (aulnaies-frênaies)',
    '44.9': 'Bois marécageux (aulnaies, saulaies)', '51': 'Tourbières hautes', '53': 'Roselières et cariçaies',
    '54': 'Bas-marais et tourbières de transition', '81': 'Prairies améliorées', '82': 'Cultures',
    '83': 'Vergers, plantations', '83.321': 'Peupleraies', '84': 'Haies, alignements, bosquets', '85': 'Parcs et jardins',
    '86': 'Zones urbanisées ou industrielles', '87': 'Friches', '89': 'Lagunes et bassins artificiels',
}

PRELOC_TYPE = {'1': 'Plan d’eau', '2': 'Peupleraie', '3': 'Culture en continuité de plusieurs ZH', '4': 'Prairie humide',
               '5': 'Friche et mégaphorbiaie', '6': 'Bois en continuité de plusieurs ZH', '7': 'Roselière',
               '8': 'Vasière, schorre', '9': 'Marais', '10': 'Zone anthropisée, bassin technique, zone drainée'}
PRELOC_CONF = {'1': 'Fiabilité forte', '2': 'Fiabilité moyenne', '3': 'Mauvaise situation topographique',
               '4': 'Mauvais faciès mais situation logique'}

# Codes "dn" des milieux prédisposés (notice DREAL Normandie) : 1/2 = MPPZH
# fort/faible ; +100 quand le modèle national PatriNat donne aussi une
# probabilité significative ; 100 seul = probabilité PatriNat seule.
MPP_CLASS = '(dn==1||dn==101)?"fort":(dn==2?"faible":"signif")'


def clean(v):
    if v is None:
        return ''
    s = str(v).strip()
    if 'Ã' in s:
        try:
            s = s.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return '' if s.upper() in ('NR', 'NON RENSEIGNÉ', 'NON RENSEIGNE', '-1', 'NONE', 'NULL') else s


def corine(code):
    code = clean(code).split(';')[0].strip()
    if not code:
        return ''
    best = ''
    for k in CORINE:
        if (code == k or code.startswith(k + '.') or code.startswith(k)) and len(k) > len(best):
            best = k
    return f'{CORINE[best]} ({code})' if best else f'CORINE {code}'


def year(*values):
    for v in values:
        m = re.search(r'(19|20)\d\d', clean(v))
        if m:
            return m.group(0)
    return ''


def first(props, *keys):
    for k in keys:
        v = clean(props.get(k))
        if v:
            return v
    return ''


def to_l93(geom):
    return shapely.transform(geom, lambda c: np.column_stack(TO_L93.transform(c[:, 0], c[:, 1])))


def load_deps(src):
    deps = {}
    for d in ('50', '14', '61', '76', '35', '22', '53'):
        gj = json.load(open(os.path.join(src, 'deps', f'{d}.json'), encoding='utf-8'))
        deps[d] = shapely.make_valid(to_l93(shapely.union_all([shape(f['geometry']) for f in gj['features']])))
        shapely.prepare(deps[d])
    return deps


def dept_of(geom, deps, allowed):
    pt = geom.representative_point()
    for d in allowed:
        if deps[d].contains(pt):
            return d
    return None


def iter_shp(path, cache):
    """Shapefile → GeoJSON Lambert 93 via mapshaper (tolère les anneaux
    dégénérés que contient l'inventaire normand), puis lecture."""
    if not os.path.exists(cache):
        subprocess.run(['mapshaper-xl', '8gb', '-i', path, 'encoding=utf8', '-o', cache, 'format=geojson', 'precision=0.1'],
                       check=True)
    yield from iter_geojson(cache)


def iter_geojson(path):
    gj = json.load(open(path, encoding='utf-8'))
    for f in gj['features']:
        if f.get('geometry'):
            yield shape(f['geometry']), f.get('properties') or {}


def izh_props(p):
    """Champs du standard régional breton (Forum des Marais Atlantiques)."""
    low = {k.lower(): v for k, v in p.items()}
    t = first(p, 'D_TYPE', 'TYPE_SAGE', 'typologi_1', 'typologie') or first(low, 'izh_typezh')
    if not t:
        t = corine(first(low, 'izh_corin1', 'izh_codcor'))
    out = {'t': t, 'y': year(low.get('izh_valdat'), low.get('izh_findat')), 'o': first(low, 'izh_mouv')}
    role = first(p, 'D_ROLE')
    if role:
        out['r'] = role
    return out


class Builder:
    def __init__(self, out):
        self.out = out
        self.tiles = {'inv': defaultdict(list), 'pot': defaultdict(list)}
        self.counts = defaultdict(int)

    @staticmethod
    def encode(geom, ox, oy):
        polys = []
        for poly in getattr(geom, 'geoms', [geom]):
            if poly.geom_type != 'Polygon' or poly.is_empty:
                continue
            rings = []
            for ring in [poly.exterior, *poly.interiors]:
                pts = np.rint(np.asarray(ring.coords)[:-1] - (ox, oy)).astype(np.int64)
                if len(pts) == 0:
                    continue
                keep = np.ones(len(pts), bool)
                keep[1:] = np.any(pts[1:] != pts[:-1], axis=1)
                pts = pts[keep]
                if len(pts) < 3:
                    continue
                flat = np.concatenate([pts[:1], np.diff(pts, axis=0)]).ravel().tolist()
                rings.append(flat)
            if rings:
                polys.append(rings)
        return polys

    def add_whole(self, layer, geom, props):
        """Entité entière, dans la tuile du centre de son emprise."""
        minx, miny, maxx, maxy = geom.bounds
        props = {k: v for k, v in props.items() if v}
        tx, ty = math.floor((minx + maxx) / 2 / TILE), math.floor((miny + maxy) / 2 / TILE)
        polys = self.encode(geom, tx * TILE, ty * TILE)
        if polys:
            self.tiles[layer][(tx, ty)].append([props, polys])
            self.counts[(layer, props.get('s'), props.get('d'))] += 1

    def add_clipped(self, layer, geom, props):
        """Découpe à la tuile, polygone par polygone : seuls ceux qui
        chevauchent une limite de tuile passent par une intersection."""
        merged = defaultdict(list)
        for part in getattr(geom, 'geoms', [geom]):
            if part.is_empty:
                continue
            if not part.is_valid:
                part = polygonal(shapely.make_valid(part))
                if part is None:
                    continue
            minx, miny, maxx, maxy = part.bounds
            tx0, tx1 = math.floor(minx / TILE), math.floor(maxx / TILE)
            ty0, ty1 = math.floor(miny / TILE), math.floor(maxy / TILE)
            for tx in range(tx0, tx1 + 1):
                for ty in range(ty0, ty1 + 1):
                    if tx0 == tx1 and ty0 == ty1:
                        piece = part
                    else:
                        piece = polygonal(shapely.intersection(part, box(tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE)))
                        if piece is None or piece.is_empty:
                            continue
                    merged[(tx, ty)].extend(self.encode(piece, tx * TILE, ty * TILE))
        for key, polys in merged.items():
            if polys:
                self.tiles[layer][key].append([props, polys])

    def write(self):
        index = {'tile': TILE, 'crs': 'EPSG:2154', 'sources': SOURCES, 'layers': {}, 'counts': []}
        for layer, tiles in self.tiles.items():
            d = os.path.join(self.out, layer)
            os.makedirs(d, exist_ok=True)
            for old in os.listdir(d):
                os.remove(os.path.join(d, old))
            index['layers'][layer] = sorted([tx, ty] for tx, ty in tiles)
            for (tx, ty), feats in tiles.items():
                # Table d'attributs par tuile : les combinaisons se répètent beaucoup.
                table, slots, out = [], {}, []
                for props, polys in feats:
                    k = json.dumps(props, sort_keys=True, ensure_ascii=False)
                    if k not in slots:
                        slots[k] = len(table)
                        table.append(props)
                    out.append([slots[k], polys])
                with open(os.path.join(d, f'{tx}_{ty}.json'), 'w', encoding='utf-8') as fh:
                    json.dump({'p': table, 'f': out}, fh, ensure_ascii=False, separators=(',', ':'))
        index['counts'] = [{'layer': l, 'source': s, 'dep': d, 'n': n} for (l, s, d), n in sorted(self.counts.items(), key=str)]
        with open(os.path.join(self.out, 'index.json'), 'w', encoding='utf-8') as fh:
            json.dump(index, fh, ensure_ascii=False, separators=(',', ':'))


def polygonal(geom):
    """Ne garde que les parties surfaciques (sans opération d'overlay)."""
    if geom.geom_type in ('Polygon', 'MultiPolygon'):
        return geom
    polys = []
    for g in getattr(geom, 'geoms', []):
        g = polygonal(g)
        if g is not None and not g.is_empty:
            polys.extend(getattr(g, 'geoms', [g]))
    return shapely.MultiPolygon(polys) if polys else None


def prepare(geom, tol):
    geom = polygonal(geom)
    if geom is None or geom.is_empty:
        return None
    try:
        geom = shapely.make_valid(geom)
    except shapely.errors.GEOSException:
        geom = geom.buffer(0)
    geom = polygonal(geom)
    if geom is None or geom.is_empty:
        return None
    if tol:
        geom = polygonal(geom.simplify(tol, preserve_topology=True))
    return geom if geom is not None and not geom.is_empty else None


def main(src, out):
    deps = load_deps(src)
    b = Builder(out)

    # --- Normandie : inventaire régional (50, 14, 61, 76 ; l'Eure est exclue)
    for geom, p in iter_shp(os.path.join(src, 'norm_zh/dataset/drealnorm_zh_s_r28.shp'), os.path.join(src, 'norm_zh.json')):
        g = prepare(geom, 1.0)
        if g is None:
            continue
        d = dept_of(g, deps, ('50', '14', '61', '76'))
        if not d:
            continue
        leg = clean(p.get('leg_simpl'))
        b.add_whole('inv', g, {'s': 'n28', 'd': d, 't': leg, 'm': clean(p.get('diag')), 'q': clean(p.get('qualite')),
                               'o': clean(p.get('interpr')), 'k': 'deg' if 'dégrad' in leg.lower() else ''})

    # --- Ille-et-Vilaine : DDTM
    for geom, p in iter_shp(os.path.join(src, 'zh35/dataset/L_ZONE_HUMIDE_S_035.shp'), os.path.join(src, 'zh35.json')):
        g = prepare(geom, 1.0)
        if g is None or dept_of(g, deps, ('35',)) != '35':
            continue
        b.add_whole('inv', g, {'s': 'd35', 'd': '35', **izh_props(p)})

    # --- Côtes-d'Armor : inventaires SAGE
    for code, fname in (('bsb', 'izh_sage_bsb'), ('atg', 'izh_sage_atg'), ('bdl', 'zh_sage_baiedelannion'),
                        ('abf', 'izh_sage_arguenon_fresnaye'), ('rfb', 'zonehumidesagerfbb'), ('vil', 'izh_sage_vilaine')):
        for geom, p in iter_geojson(os.path.join(src, 'gb22', f'{fname}.json')):
            g = prepare(geom, 1.0)
            if g is None or dept_of(g, deps, ('22',)) != '22':
                continue
            b.add_whole('inv', g, {'s': code, 'd': '22', **izh_props(p)})

    # --- Mayenne : prélocalisation (pas d'inventaire départemental publié)
    for geom, p in iter_geojson(os.path.join(src, 'preloc53/preloc53.geojson')):
        g = prepare(to_l93(geom), 1.0)
        if g is None:
            continue
        b.add_whole('pot', g, {'s': 'p53', 'd': '53', 'c': 'preloc', 't': PRELOC_TYPE.get(clean(p.get('type_zh')), ''),
                               'q': PRELOC_CONF.get(clean(p.get('ind_conf')), '')})

    # --- Normandie : milieux prédisposés, fusionnés par classe puis généralisés
    #     (îlots isolés < 150 m² — 6 pixels de 5 m — retirés, simplification
    #     10 m ; écart de surface mesuré sur la Seine-Maritime < 3,5 % par classe).
    for d in ('50', '14', '61', '76'):
        tmp = os.path.join(src, f'mpp_{d}.json')
        if not os.path.exists(tmp):
            subprocess.run(['mapshaper-xl', '8gb', '-i', os.path.join(src, f'mpzh{d}/dataset/drealnorm_mppzh_s_0{d}.shp'),
                            '-each', f'c = {MPP_CLASS}', '-dissolve2', 'c', '-filter-islands', 'min-area=150',
                            '-simplify', 'interval=10', 'keep-shapes', '-o', tmp, 'format=geojson', 'precision=1'],
                           check=True)
        for geom, p in iter_geojson(tmp):
            b.add_clipped('pot', geom, {'s': 'mpp', 'd': d, 'c': p['c']})
            b.counts[('pot', 'mpp', d)] += 1

    b.write()
    for (l, s, d), c in sorted(b.counts.items(), key=str):
        print(f'{l:4} {s:4} {d}: {c}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
