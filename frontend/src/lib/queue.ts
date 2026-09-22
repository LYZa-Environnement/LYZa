/**
 * Caps how many rubriques fetch their data at the same time.
 *
 * Each rubrique fans out to a dozen or so requests, and they concentrate on a
 * handful of hosts (georisques.gouv.fr, hubeau.eaufrance.fr, apicarto.ign.fr).
 * Browsers allow only ~6 connections per host, so when several rubriques start
 * together the surplus requests sit in the browser's own queue — observed live:
 * scrolling quickly to the bottom left 26 requests outstanding, and a rubrique
 * whose requests had not yet been issued still ran out its own timeout, so it
 * reported "donnée indisponible" for sources that were merely waiting in line.
 *
 * Two at a time keeps the pipes busy without starving anyone: a reader who
 * jumps straight to the last rubrique waits for at most one other to finish,
 * not for all five.
 */

const MAX_PARALLELE = 2

let enCours = 0
const attente: (() => void)[] = []

async function acquerir(): Promise<void> {
  if (enCours < MAX_PARALLELE) {
    enCours++
    return
  }
  await new Promise<void>((resolve) => attente.push(resolve))
  enCours++
}

function liberer(): void {
  enCours--
  attente.shift()?.()
}

export async function enFile<T>(tache: () => Promise<T>): Promise<T> {
  await acquerir()
  try {
    return await tache()
  } finally {
    liberer()
  }
}
