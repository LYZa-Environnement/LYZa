#!/usr/bin/env node
/**
 * Produit public/plaquette/plaquette-lyza.pdf à partir de public/plaquette/index.html.
 *
 * À lancer à la main après une modification de la plaquette, puis committer le
 * PDF. Nécessite Playwright (non installé par défaut dans ce projet) :
 *   npx --yes playwright@1 install chromium   # une fois
 *   npm run plaquette
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const ici = path.dirname(fileURLToPath(import.meta.url))
const dossier = path.resolve(ici, '../public/plaquette')

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  try {
    // Installation globale (NODE_PATH) : seul require() la trouve.
    ;({ chromium } = createRequire(import.meta.url)('playwright'))
  } catch {
    chromium = null
  }
}
if (!chromium) {
  console.error('[plaquette] Playwright est introuvable. Installez-le : npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(path.join(dossier, 'index.html')).href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const sortie = path.join(dossier, 'plaquette-lyza.pdf')
await page.pdf({ path: sortie, format: 'A4', printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log(`[plaquette] ${path.relative(process.cwd(), sortie)} écrit.`)
