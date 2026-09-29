/**
 * Extracting an inventory to a spreadsheet.
 *
 * A reader who has found fifteen classified installations around a site is
 * usually building a report, not just reading a page. Retyping the list is
 * where errors get introduced, so the same rows the rubrique shows can be
 * downloaded as they stand.
 *
 * CSV rather than a fancier format: it opens in any spreadsheet without a
 * library, and this platform ships no server to render anything else.
 */

import type { LigneTableau } from '../types/site'

const COLONNES = ['Référence', 'Nom du site', 'Activités', 'Distance (m)', 'Direction'] as const

/** Escapes one field. Semicolons separate the columns because that is what a
 * French locale spreadsheet expects, and these labels are full of commas. */
function champ(valeur: string | number | null): string {
  if (valeur === null || valeur === undefined) return ''
  const texte = String(valeur)
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

export function versCsv(lignes: LigneTableau[]): string {
  const corps = lignes.map((ligne) =>
    [champ(ligne.reference), champ(ligne.nom), champ(ligne.activites), champ(ligne.distanceM === null ? '' : Math.round(ligne.distanceM)), champ(ligne.direction)].join(';'),
  )
  // A BOM, so Excel opens the file as UTF-8 instead of mangling every accent.
  return `﻿${COLONNES.join(';')}\r\n${corps.join('\r\n')}\r\n`
}

/** Turns a block title into a usable file name — "Détail des installations
 * classées" becomes "detail-des-installations-classees". */
export function nomFichier(titre: string, suffixe: string): string {
  const base = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'extraction'}-${suffixe}.csv`
}

export function telechargerCsv(lignes: LigneTableau[], nom: string): void {
  const blob = new Blob([versCsv(lignes)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  // Revoked on the next tick, not immediately: Safari cancels a download whose
  // object URL disappears in the same turn of the event loop.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
