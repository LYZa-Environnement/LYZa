/*
 * Outils internes LYZa — stockage local.
 *
 * Tout reste dans le navigateur (IndexedDB) : rien n'est envoyé sur un
 * serveur. D'où l'export / import d'une sauvegarde JSON dans Paramètres, pour
 * changer d'ordinateur ou se prémunir d'un nettoyage du navigateur.
 */
;(() => {
  const L = window.LYZA
  const DB_NAME = 'lyza-outils'
  const STORE = 'kv'
  let dbPromise = null
  let memoire = null // repli si IndexedDB est indisponible

  function open() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve) => {
      let req
      try {
        req = indexedDB.open(DB_NAME, 1)
      } catch {
        memoire = new Map()
        resolve(null)
        return
      }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        memoire = new Map()
        resolve(null)
      }
    })
    return dbPromise
  }

  async function tx(mode, fn) {
    const db = await open()
    if (!db) return fn(null)
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const store = t.objectStore(STORE)
      let result
      Promise.resolve(fn(store)).then((r) => (result = r))
      t.oncomplete = () => resolve(result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  }

  function reqP(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function get(key) {
    return tx('readonly', (store) => (store ? reqP(store.get(key)) : L.clone(memoire.get(key))))
  }

  async function set(key, value) {
    return tx('readwrite', (store) => {
      if (store) store.put(L.clone(value), key)
      else memoire.set(key, L.clone(value))
    })
  }

  async function del(key) {
    return tx('readwrite', (store) => {
      if (store) store.delete(key)
      else memoire.delete(key)
    })
  }

  async function entries() {
    return tx('readonly', async (store) => {
      if (!store) return [...memoire.entries()].map(([k, v]) => [k, L.clone(v)])
      const [keys, values] = await Promise.all([reqP(store.getAllKeys()), reqP(store.getAll())])
      return keys.map((k, i) => [k, values[i]])
    })
  }

  // ---------- Accès métier ----------

  async function listDocs(kind) {
    const all = await entries()
    return all
      .filter(([k, v]) => k.startsWith('doc:') && (!kind || v.kind === kind))
      .map(([, v]) => v)
      .sort((a, b) => String(b.numero).localeCompare(String(a.numero)) || String(b.maj).localeCompare(String(a.maj)))
  }

  async function saveDoc(doc) {
    doc.maj = new Date().toISOString()
    await set('doc:' + doc.id, doc)
    return doc
  }

  async function deleteDoc(id) {
    await del('doc:' + id)
  }

  async function getDoc(id) {
    return get('doc:' + id)
  }

  /** Paramètres : défauts du code, complétés par ceux enregistrés. */
  async function parametres() {
    const saved = (await get('parametres')) || {}
    const def = L.clone(L.PARAMETRES)
    return {
      identite: { ...def.identite, ...(saved.identite || {}) },
      banque: mergeNonEmpty(def.banque, saved.banque || {}),
      signature: saved.signature ?? def.signature,
      documents: { ...def.documents, ...(saved.documents || {}) },
    }
  }

  function mergeNonEmpty(base, over) {
    const out = { ...base }
    for (const [k, v] of Object.entries(over)) if (v !== '' && v != null) out[k] = v
    return out
  }

  async function catalogue() {
    const saved = await get('catalogue')
    return saved && saved.length ? saved : L.clone(L.CATALOGUE)
  }

  async function clients() {
    return (await get('clients')) || []
  }

  /** Mémorise un client pour l'autocomplétion (clé : nom). */
  async function rememberClient(client) {
    if (!client || !client.nom || !client.nom.trim()) return
    const list = await clients()
    const i = list.findIndex((c) => c.nom.trim().toLowerCase() === client.nom.trim().toLowerCase())
    const value = L.clone(client)
    if (i >= 0) list[i] = { ...list[i], ...value }
    else list.push(value)
    list.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    await set('clients', list)
  }

  async function exportAll() {
    const all = await entries()
    return {
      format: 'lyza-outils',
      version: 1,
      date: new Date().toISOString(),
      donnees: Object.fromEntries(all),
    }
  }

  async function importAll(json, { remplacer = false } = {}) {
    if (!json || json.format !== 'lyza-outils' || !json.donnees) throw new Error("Ce fichier n'est pas une sauvegarde des outils LYZa.")
    if (remplacer) {
      for (const [k] of await entries()) await del(k)
    }
    let n = 0
    for (const [k, v] of Object.entries(json.donnees)) {
      await set(k, v)
      n++
    }
    return n
  }

  Object.assign(L, {
    db: { get, set, del, entries },
    listDocs,
    saveDoc,
    deleteDoc,
    getDoc,
    parametres,
    catalogue,
    clients,
    rememberClient,
    exportAll,
    importAll,
    stockageMemoire: () => memoire !== null,
  })
})()
