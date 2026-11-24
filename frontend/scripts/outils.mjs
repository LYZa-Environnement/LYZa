#!/usr/bin/env node
/**
 * Build des outils internes (devis, factures, avis sommaires).
 *
 * 1. Assemble frontend/outils/ (HTML, CSS, scripts, logo) en une seule page.
 * 2. La chiffre (AES-256-GCM, clé dérivée du mot de passe par PBKDF2-SHA256)
 *    et écrit dist/outils/index.html : une page qui ne contient que le
 *    formulaire de mot de passe et le contenu chiffré.
 *
 * Le site est public (GitHub Pages) : sans chiffrement, n'importe qui pourrait
 * lire le code et les coordonnées bancaires. Le mot de passe vient du secret
 * GitHub LYZA_OUTILS_MDP ; s'il manque, la page publiée indique seulement que
 * l'outil n'est pas configuré. Rien n'est jamais publié en clair.
 *
 * Variables d'environnement (secrets GitHub) :
 *   LYZA_OUTILS_MDP   mot de passe (obligatoire pour publier l'outil)
 *   LYZA_IBAN, LYZA_BIC, LYZA_BANQUE, LYZA_TITULAIRE
 *                     coordonnées bancaires pré-remplies (facultatives,
 *                     intégrées seulement dans la page chiffrée)
 *
 * Usage :
 *   node scripts/outils.mjs                 build normal (chiffré)
 *   node scripts/outils.mjs --clair         page en clair, pour essayer en local
 *   node scripts/outils.mjs --sortie <dir>  dossier de sortie (défaut dist/outils)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.resolve(ici, '..')
const source = path.join(racine, 'outils')
const args = process.argv.slice(2)
const clair = args.includes('--clair')
const iSortie = args.indexOf('--sortie')
const sortie = path.resolve(racine, iSortie >= 0 ? args[iSortie + 1] : 'dist/outils')
const ITERATIONS = 600_000

function echapperScript(code) {
  return code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
}

async function assembler({ avecBanque }) {
  let html = await readFile(path.join(source, 'index.html'), 'utf8')
  const css = await readFile(path.join(source, 'outils.css'), 'utf8')
  html = html.replace(/<link rel="stylesheet" href="outils\.css" \/>/, () => `<style>\n${css}\n</style>`)

  const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n?/g)]
  if (!scripts.length) throw new Error('Aucun script trouvé dans outils/index.html')
  const codes = []
  for (const m of scripts) codes.push(`// ---- ${m[1]} ----\n` + (await readFile(path.join(source, m[1]), 'utf8')))

  const logo = await readFile(path.join(source, 'logo-lyza.png'))
  const build = {
    logo: `data:image/png;base64,${logo.toString('base64')}`,
    version: (process.env.GITHUB_SHA || 'local').slice(0, 7),
    date: new Date().toISOString(),
  }
  if (avecBanque) {
    const banque = {
      iban: process.env.LYZA_IBAN || '',
      bic: process.env.LYZA_BIC || '',
      banque: process.env.LYZA_BANQUE || '',
      titulaire: process.env.LYZA_TITULAIRE || '',
    }
    if (Object.values(banque).some(Boolean)) build.banque = banque
  }
  const json = JSON.stringify(build).replace(/</g, '\\u003c')
  const bloc = `<script>window.LYZA_BUILD = ${json};</script>\n    <script>\n${echapperScript(codes.join('\n'))}\n    </script>\n`

  let premier = true
  html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, () => {
    if (!premier) return ''
    premier = false
    return bloc
  })
  // Le commentaire « ne jamais publier ce dossier » ne concerne que la source.
  return html.replace(/<!-- Source des outils internes[\s\S]*?-->\n\s*/, '')
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

async function chiffrer(html, motDePasse) {
  const { subtle } = webcrypto
  const sel = webcrypto.getRandomValues(new Uint8Array(16))
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const base = await subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey'])
  const cle = await subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const donnees = gzipSync(Buffer.from(html, 'utf8'), { level: 9 })
  const chiffre = await subtle.encrypt({ name: 'AES-GCM', iv }, cle, donnees)
  return { v: 1, n: ITERATIONS, s: b64(sel), i: b64(iv), c: b64(new Uint8Array(chiffre)) }
}

function pagePorte(paquet) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>LYZa — Outils internes</title>
<link rel="icon" href="data:," />
<style>
  :root { color-scheme: light; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f4ef; color: #1c2a33; }
  form { width: min(22rem, 90vw); padding: 2rem 1.8rem; background: #fff; border: 1px solid #d9d6cc; border-radius: 14px; box-shadow: 0 8px 30px rgba(2, 42, 71, 0.08); }
  h1 { margin: 0 0 0.2rem; font-size: 1.6rem; color: #022a47; letter-spacing: 0.02em; }
  h1 span { color: #4b6035; }
  p { margin: 0 0 1.2rem; color: #5f6b70; font-size: 0.92rem; }
  label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem; }
  input[type=password] { width: 100%; box-sizing: border-box; padding: 0.65rem 0.7rem; border: 1px solid #c9c5b9; border-radius: 8px; font: inherit; }
  input:focus-visible, button:focus-visible { outline: 2px solid #57a6cf; outline-offset: 1px; }
  .garder { display: flex; gap: 0.4rem; align-items: center; margin: 0.8rem 0 1.1rem; font-weight: 400; font-size: 0.85rem; color: #5f6b70; }
  button { width: 100%; padding: 0.7rem; border: 0; border-radius: 8px; background: #022a47; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: progress; }
  .erreur { min-height: 1.2rem; margin: 0.8rem 0 0; color: #b4412f; font-size: 0.88rem; }
</style>
</head>
<body>
<form id="porte" autocomplete="on">
  <h1>LYZ<span>a</span></h1>
  <p>Outils internes — accès réservé.</p>
  <input type="text" name="username" value="lyza" autocomplete="username" hidden />
  <label for="mdp">Mot de passe</label>
  <input id="mdp" type="password" autocomplete="current-password" required autofocus />
  <label class="garder"><input id="garder" type="checkbox" checked /> Rester déverrouillé dans cet onglet</label>
  <button type="submit">Déverrouiller</button>
  <p class="erreur" id="erreur" role="alert"></p>
</form>
<script>
(() => {
  const P = ${JSON.stringify(paquet)};
  const CLE = 'lyza-outils-cle';
  const octets = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const texte = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));

  async function ouvrir(cle) {
    const brut = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: octets(P.i) }, cle, octets(P.c));
    const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('gzip'));
    const html = await new Response(flux).text();
    document.open();
    document.write(html);
    document.close();
  }

  async function deriver(mdp) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: octets(P.s), iterations: P.n, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt'],
    );
  }

  const form = document.getElementById('porte');
  const erreur = document.getElementById('erreur');
  const bouton = form.querySelector('button');

  if (!window.crypto || !crypto.subtle || !window.DecompressionStream) {
    erreur.textContent = 'Navigateur trop ancien : utilisez une version récente de Firefox, Chrome, Edge ou Safari.';
    bouton.disabled = true;
    return;
  }

  (async () => {
    let memo = null;
    try { memo = sessionStorage.getItem(CLE); } catch (e) {}
    if (!memo) return;
    try {
      const cle = await crypto.subtle.importKey('raw', octets(memo), 'AES-GCM', false, ['decrypt']);
      await ouvrir(cle);
    } catch (e) {
      try { sessionStorage.removeItem(CLE); } catch (e2) {}
    }
  })();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    erreur.textContent = '';
    bouton.disabled = true;
    bouton.textContent = 'Déverrouillage…';
    try {
      const cle = await deriver(document.getElementById('mdp').value);
      if (document.getElementById('garder').checked) {
        try { sessionStorage.setItem(CLE, texte(await crypto.subtle.exportKey('raw', cle))); } catch (e) {}
      }
      await ouvrir(cle);
    } catch (e) {
      erreur.textContent = 'Mot de passe incorrect.';
      bouton.disabled = false;
      bouton.textContent = 'Déverrouiller';
    }
  });
})();
</script>
</body>
</html>
`
}

function pageNonConfiguree() {
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" /><title>LYZa — Outils internes</title></head>
<body style="font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f5f4ef; color: #1c2a33">
<p style="max-width: 30rem; padding: 1.5rem; text-align: center">Les outils internes ne sont pas encore configurés : le secret <code>LYZA_OUTILS_MDP</code> n'est pas défini dans le dépôt GitHub.</p>
</body></html>
`
}

async function main() {
  await mkdir(sortie, { recursive: true })
  const fichier = path.join(sortie, 'index.html')
  const motDePasse = process.env.LYZA_OUTILS_MDP || ''

  if (clair) {
    if (process.env.GITHUB_ACTIONS === 'true') throw new Error('--clair est interdit dans GitHub Actions : la page serait publiée sans protection.')
    await writeFile(fichier, await assembler({ avecBanque: false }))
    console.warn(`[outils] Page EN CLAIR écrite dans ${path.relative(racine, fichier)} — pour un essai local uniquement, ne pas publier.`)
    return
  }

  if (!motDePasse) {
    await writeFile(fichier, pageNonConfiguree())
    console.warn('[outils] LYZA_OUTILS_MDP absent : page « non configurée » écrite, outils non publiés.')
    return
  }
  if (motDePasse.length < 12) console.warn('[outils] Mot de passe court : préférez une phrase de passe de 4 mots ou plus.')

  const html = await assembler({ avecBanque: true })
  const paquet = await chiffrer(html, motDePasse)
  await writeFile(fichier, pagePorte(paquet))
  console.log(`[outils] Page chiffrée écrite dans ${path.relative(racine, fichier)} (${Math.round(html.length / 1024)} Ko en clair).`)
}

main().catch((e) => {
  console.error('[outils]', e.message)
  process.exit(1)
})
