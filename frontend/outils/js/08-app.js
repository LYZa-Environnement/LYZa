/*
 * Outils internes LYZa — interface (devis, factures, avis, catalogue, paramètres).
 */
;(() => {
  const L = window.LYZA
  const { h, fill } = L
  const LOGO = window.LYZA_BUILD?.logo || 'logo-lyza.png'

  const ONGLETS = [
    ['devis', 'Devis'],
    ['facture', 'Factures'],
    ['avis', 'Avis sommaires'],
    ['catalogue', 'Catalogue'],
    ['parametres', 'Paramètres'],
  ]
  const STATUTS = {
    devis: [
      ['brouillon', 'Brouillon'],
      ['envoyé', 'Envoyé'],
      ['accepté', 'Accepté'],
      ['refusé', 'Refusé'],
    ],
    facture: [
      ['brouillon', 'Brouillon'],
      ['émise', 'Émise'],
      ['payée', 'Payée'],
    ],
  }

  const state = { params: null, catalogue: null, clients: [], doc: null, kind: null }
  let main
  let saveLabel

  // ---------- Démarrage ----------

  async function start() {
    state.params = await L.parametres()
    state.catalogue = await L.catalogue()
    state.clients = await L.clients()
    const root = document.getElementById('app')
    saveLabel = h('span', { class: 'save-state', 'aria-live': 'polite' })
    main = h('main', { id: 'vue', class: 'vue' })
    fill(root, 
      h(
        'header',
        { class: 'bar' },
        h('a', { class: 'bar-brand', href: '#/devis' }, h('img', { src: LOGO, alt: 'LYZa' }), h('span', null, 'Outils internes')),
        h(
          'nav',
          { class: 'bar-nav', 'aria-label': 'Sections' },
          ONGLETS.map(([k, label]) => h('a', { href: `#/${k}`, 'data-k': k }, label)),
        ),
        saveLabel,
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: verrouiller, title: 'Oublier le mot de passe sur cet onglet' }, 'Verrouiller'),
      ),
      main,
    )
    if (L.stockageMemoire()) {
      L.toast("Le stockage du navigateur est indisponible : rien ne sera conservé après fermeture. Exportez une sauvegarde.", 'warn')
    }
    window.addEventListener('hashchange', route)
    route()
  }

  function verrouiller() {
    try {
      sessionStorage.removeItem('lyza-outils-cle')
    } catch {
      /* sans effet */
    }
    location.reload()
  }

  async function route() {
    const [, vue = 'devis', id] = (location.hash || '#/devis').split('/')
    document.querySelectorAll('.bar-nav a').forEach((a) => a.classList.toggle('active', a.dataset.k === vue))
    state.doc = null
    saveLabel.textContent = ''
    if (['devis', 'facture', 'avis'].includes(vue)) {
      if (id) await ouvrir(vue, decodeURIComponent(id))
      else await liste(vue)
    } else if (vue === 'catalogue') {
      vueCatalogue()
    } else if (vue === 'parametres') {
      vueParametres()
    } else {
      location.hash = '#/devis'
    }
    window.scrollTo(0, 0)
  }

  // ---------- Petits composants de formulaire ----------

  let onChange = () => {}

  function inp(obj, key, opts = {}) {
    const el = h('input', {
      type: opts.type || 'text',
      value: obj[key] ?? '',
      placeholder: opts.placeholder,
      list: opts.list,
      class: opts.class,
      inputmode: opts.inputmode,
      'aria-label': opts.label,
    })
    el.addEventListener('input', () => {
      obj[key] = el.value
      opts.onInput?.(el.value)
      onChange()
    })
    if (opts.onChange) el.addEventListener('change', () => opts.onChange(el.value))
    return el
  }

  function area(obj, key, opts = {}) {
    const el = h('textarea', { rows: opts.rows || 3, placeholder: opts.placeholder, class: opts.class, 'aria-label': opts.label })
    el.value = obj[key] ?? ''
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight + 2, 520) + 'px'
    }
    el.addEventListener('input', () => {
      obj[key] = el.value
      opts.onInput?.(el.value)
      fit()
      onChange()
    })
    requestAnimationFrame(fit)
    return el
  }

  function sel(obj, key, options, opts = {}) {
    const el = h(
      'select',
      { class: opts.class, 'aria-label': opts.label },
      options.map(([v, label]) => h('option', { value: v, selected: String(obj[key] ?? '') === String(v) }, label)),
    )
    el.addEventListener('change', () => {
      obj[key] = el.value
      opts.onInput?.(el.value)
      onChange()
    })
    return el
  }

  function chk(obj, key, label, opts = {}) {
    const el = h('input', { type: 'checkbox', checked: Boolean(obj[key]) })
    el.addEventListener('change', () => {
      obj[key] = el.checked
      opts.onInput?.(el.checked)
      onChange()
    })
    return h('label', { class: 'check' }, el, ' ', label)
  }

  function field(label, control, hint) {
    return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('small', { class: 'hint' }, hint) : null)
  }

  function row(...children) {
    return h('div', { class: 'row' }, children)
  }

  function card(title, ...children) {
    return h('section', { class: 'card' }, title ? h('h3', null, title) : null, children)
  }

  function btn(label, onclick, kind = '', attrs = {}) {
    return h('button', { type: 'button', class: `btn ${kind}`, onclick, ...attrs }, label)
  }

  // ---------- Listes ----------

  async function liste(kind) {
    state.kind = kind
    const docs = await L.listDocs(kind)
    const titre = { devis: 'Devis', facture: 'Factures', avis: 'Avis sommaires' }[kind]
    const filtre = h('input', { type: 'search', placeholder: 'Rechercher (client, site, numéro…)', class: 'search', 'aria-label': 'Rechercher' })
    const tbody = h('tbody')
    const actions = []
    if (kind === 'avis') {
      for (const [k, m] of Object.entries(L.MODELES_AVIS)) {
        actions.push(btn(`Nouvel avis : ${m.libelle.toLowerCase()}`, () => (location.hash = `#/avis/nouveau-${k}`), k === 'enfouissement' ? 'btn--primary' : ''))
      }
    } else {
      actions.push(btn(kind === 'devis' ? 'Nouveau devis' : 'Nouvelle facture', () => (location.hash = `#/${kind}/nouveau`), 'btn--primary'))
    }

    const head =
      kind === 'avis'
        ? ['Date', 'Site', 'Demandeur', 'Commune', 'Avis', 'Facturation', '']
        : kind === 'devis'
          ? ['N°', 'Date', 'Client', 'Nature', 'Montant HT', 'Statut', '']
          : ['N°', 'Date', 'Client', 'Objet', 'Montant', 'Statut', '']

    const draw = () => {
      const q = filtre.value.trim().toLowerCase()
      const rows = docs.filter((d) => !q || JSON.stringify([d.numero, d.client?.nom, d.nature, d.objet, d.demande]).toLowerCase().includes(q))
      fill(tbody, 
        ...rows.map((d) => {
          const open = () => (location.hash = `#/${kind}/${encodeURIComponent(d.id)}`)
          const cells =
            kind === 'avis'
              ? [
                  L.frDate(d.date),
                  L.siteAvis(d) || '—',
                  L.demandeurAvis(d) || '—',
                  (d.demande || []).find((r) => /commune/i.test(r.label))?.valeur || '—',
                  h('span', { class: `pill pill--${d.sens}` }, L.SENS_AVIS[d.sens]?.libelle || ''),
                  d.factureNumero ? `Facture ${d.factureNumero}` : d.aFacturer === false ? 'Non facturable' : h('span', { class: 'muted' }, 'À facturer'),
                ]
              : [
                  d.numero,
                  L.frDate(d.dateEmission),
                  d.client?.nom || '—',
                  kind === 'devis' ? d.nature || '—' : d.objet || d.nature || '—',
                  L.euros(L.totaux(d).ht),
                  h('span', { class: `pill pill--${L.safeName(d.statut)}` }, d.statut || 'brouillon', retard(d) ? ' · en retard' : ''),
                ]
          return h(
            'tr',
            { class: retard(d) ? 'late' : '' },
            cells.map((c, i) => h('td', { onclick: open, class: i === 0 ? 'strong' : '' }, c)),
            h(
              'td',
              { class: 'actions' },
              btn('Ouvrir', open, 'btn--small'),
              btn('Dupliquer', () => dupliquer(d), 'btn--small'),
              btn('Supprimer', () => supprimer(d), 'btn--small btn--danger'),
            ),
          )
        }),
      )
      if (!rows.length) tbody.append(h('tr', null, h('td', { colSpan: head.length, class: 'empty' }, docs.length ? 'Aucun résultat.' : 'Aucun document pour le moment.')))
    }
    filtre.addEventListener('input', draw)
    draw()

    fill(main, 
      h('div', { class: 'list-head' }, h('h1', null, titre), h('div', { class: 'list-actions' }, actions)),
      kind === 'facture' ? resumeFactures(docs) : null,
      kind === 'avis' ? h('p', { class: 'hint' }, 'Les avis « à facturer » s’importent dans une facture depuis l’onglet Factures (bouton « Importer des avis »).') : null,
      filtre,
      h('div', { class: 'table-wrap' }, h('table', { class: 'list' }, h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))), tbody)),
    )
  }

  function retard(d) {
    if (d.kind !== 'facture' || d.statut !== 'émise') return false
    const ech = d.echeance || L.addDays(d.dateEmission, state.params.documents.delaiPaiement)
    return ech < L.today()
  }

  function resumeFactures(docs) {
    const annee = L.today().slice(0, 4)
    const de = docs.filter((d) => String(d.dateEmission).startsWith(annee))
    const somme = (list) => list.reduce((s, d) => s + L.totaux(d).ht, 0)
    const payees = de.filter((d) => d.statut === 'payée')
    const attente = de.filter((d) => d.statut === 'émise')
    return h(
      'div',
      { class: 'stats' },
      h('div', null, h('span', null, `Encaissé en ${annee}`), h('strong', null, L.euros(somme(payees)))),
      h('div', null, h('span', null, 'En attente de paiement'), h('strong', null, L.euros(somme(attente)))),
      h('div', null, h('span', null, 'Factures en retard'), h('strong', null, String(docs.filter(retard).length))),
    )
  }

  async function dupliquer(d) {
    const copie = L.clone(d)
    copie.id = L.uid()
    if (d.kind === 'avis') {
      copie.date = L.today()
      copie.factureId = null
      copie.factureNumero = ''
      copie.numero = await numero('avis', copie.date)
    } else {
      copie.dateEmission = L.today()
      copie.statut = 'brouillon'
      copie.numeroAuto = true
      copie.numero = await numero(d.kind, copie.dateEmission, d.codeClient)
      delete copie.datePaiement
      delete copie.echeance
      if (copie.synthese) copie.synthese.lignes = []
    }
    await L.saveDoc(copie)
    location.hash = `#/${d.kind}/${encodeURIComponent(copie.id)}`
  }

  async function supprimer(d) {
    const nom = d.kind === 'avis' ? `l'avis « ${L.siteAvis(d) || d.numero} »` : `le document n° ${d.numero}`
    if (d.kind === 'facture' && d.statut !== 'brouillon') {
      if (!confirm(`La facture ${d.numero} est ${d.statut}. Une facture émise ne doit pas être supprimée : établissez plutôt un avoir. Supprimer quand même ?`)) return
    } else if (!confirm(`Supprimer ${nom} ?`)) return
    await L.deleteDoc(d.id)
    if (d.kind === 'facture') await libererAvis(d.id, new Set())
    L.toast('Supprimé.')
    route()
  }

  async function numero(kind, dateIso, suffixe = '') {
    const docs = await L.listDocs(kind)
    return L.numeroLibre(dateIso, docs.filter((x) => !state.doc || x.id !== state.doc.id).map((x) => x.numero), suffixe)
  }

  // ---------- Création ----------

  function clientVide() {
    return { type: 'professionnel', nom: '', contact: '', service: '', adresse: '', siren: '', email: '', reference: '', codeService: '' }
  }

  async function creer(kind, modele) {
    const p = state.params
    const t = L.today()
    if (kind === 'devis') {
      return {
        id: L.uid(),
        kind,
        numero: await numero('devis', t),
        numeroAuto: true,
        dateEmission: t,
        validiteJours: p.documents.validiteDevis,
        statut: 'brouillon',
        client: clientVide(),
        lignes: [],
        remise: { libelle: 'Remise', pourcentage: '' },
        nature: '',
        objet: '',
        prestations: '',
        hypotheses: '',
        delai: '',
        conditionsPaiement: L.DEVIS_DEFAUT.conditionsPaiement,
        mentions: L.DEVIS_DEFAUT.mentions,
        textesManuels: false,
      }
    }
    if (kind === 'facture') {
      return {
        id: L.uid(),
        kind,
        numero: await numero('facture', t),
        numeroAuto: true,
        codeClient: '',
        dateEmission: t,
        datePrestation: '',
        echeance: '',
        devisRef: '',
        statut: 'brouillon',
        client: clientVide(),
        nature: '',
        objet: '',
        synthese: { actif: false, intro: '', lignes: [] },
        lignes: [],
        remise: { libelle: 'Remise', pourcentage: '' },
        conditionsPaiement: '',
        chorus: true,
        notes: '',
      }
    }
    const m = L.MODELES_AVIS[modele] || L.MODELES_AVIS.enfouissement
    return {
      id: L.uid(),
      kind: 'avis',
      modele: modele in L.MODELES_AVIS ? modele : 'enfouissement',
      numero: await numero('avis', t),
      date: t,
      lieu: p.documents.lieu,
      redacteur: p.identite.signataire,
      titre: m.titre,
      objet: m.objet,
      objetCourt: m.objetCourt,
      demande: L.clone(m.demande),
      visite: false,
      cadre: m.cadre,
      limites: L.LIMITES_SANS_VISITE,
      documents: L.clone(L.SOURCES_AVIS),
      carte: null,
      latitude: '',
      longitude: '',
      lieuDit: '',
      analyse: L.clone(m.analyse),
      prescriptions: m.prescriptions,
      sens: 'favorable',
      formulation: '',
      reserves: '',
      conclusion: m.conclusion,
      aFacturer: Boolean(m.catalogue),
      factureId: null,
      factureNumero: '',
    }
  }

  async function factureDepuisDevis(devis) {
    const f = await creer('facture')
    Object.assign(f, {
      client: L.clone(devis.client),
      lignes: L.clone(devis.lignes).map((l) => ({ ...l, id: L.uid() })),
      remise: L.clone(devis.remise),
      devisRef: devis.numero,
      nature: devis.nature,
      objet: `Prestation de services — ${devis.nature || 'voir devis de référence'}.`,
    })
    await L.saveDoc(f)
    location.hash = `#/facture/${encodeURIComponent(f.id)}`
  }

  // ---------- Éditeur ----------

  async function ouvrir(kind, id) {
    let doc
    if (id.startsWith('nouveau')) {
      doc = await creer(kind, id.split('-')[1])
      await L.saveDoc(doc)
      history.replaceState(null, '', `#/${kind}/${encodeURIComponent(doc.id)}`)
    } else {
      doc = await L.getDoc(id)
    }
    if (!doc) {
      L.toast('Document introuvable.', 'warn')
      location.hash = `#/${kind}`
      return
    }
    state.doc = doc
    state.kind = kind
    editeur()
  }

  let previewHost
  let formHost

  function editeur() {
    const doc = state.doc
    formHost = h('div', { class: 'form' })
    previewHost = h('div', { class: 'preview-sheet' })
    const previewBox = h('div', { class: 'preview' }, h('div', { class: 'preview-scale' }, previewHost))
    const outils = [
      btn('← Retour', () => (location.hash = `#/${doc.kind}`), 'btn--ghost'),
      btn('Imprimer / PDF', imprimer, 'btn--primary'),
      btn('Word (.docx)', exporterWord),
    ]
    if (doc.kind === 'devis') outils.push(btn('Créer la facture', () => factureDepuisDevis(doc)))
    fill(main, 
      h('div', { class: 'editor-bar' }, outils, h('span', { class: 'editor-title' }, titreDoc(doc))),
      h('div', { class: 'editor' }, formHost, previewBox),
    )
    onChange = () => {
      sauverPlusTard()
      apercuPlusTard()
    }
    construireFormulaire()
    apercu()
    new ResizeObserver(ajusterApercu).observe(previewBox)
  }

  function titreDoc(doc) {
    if (doc.kind === 'avis') return `Avis — ${L.siteAvis(doc) || 'nouveau'}`
    return `${doc.kind === 'devis' ? 'Devis' : 'Facture'} n° ${doc.numero}`
  }

  function construireFormulaire() {
    const y = window.scrollY
    const doc = state.doc
    const sections = doc.kind === 'devis' ? formDevis(doc) : doc.kind === 'facture' ? formFacture(doc) : formAvis(doc)
    fill(formHost, ...sections)
    window.scrollTo(0, y)
  }

  const sauverPlusTard = L.debounce(sauver, 500)
  async function sauver() {
    const doc = state.doc
    if (!doc) return
    await L.saveDoc(doc)
    if (doc.client?.nom) {
      await L.rememberClient(doc.client)
      state.clients = await L.clients()
    }
    if (doc.kind === 'facture') await synchroniserAvis(doc)
    saveLabel.textContent = 'Enregistré ✓'
    const t = document.querySelector('.editor-title')
    if (t) t.textContent = titreDoc(doc)
  }

  const apercuPlusTard = L.debounce(apercu, 180)
  function apercu() {
    if (!state.doc || !previewHost) return
    fill(previewHost, L.renderDoc(modele(state.doc), { logo: LOGO }))
    ajusterApercu()
  }

  function ajusterApercu() {
    const box = document.querySelector('.preview')
    const scale = document.querySelector('.preview-scale')
    if (!box || !scale || !previewHost) return
    const sheetW = previewHost.offsetWidth || 794
    const k = Math.min(1, (box.clientWidth - 24) / sheetW)
    scale.style.transform = `scale(${k})`
    scale.style.height = `${previewHost.offsetHeight * k}px`
  }

  function modele(doc) {
    const m = L.construire[doc.kind](doc, state.params)
    m.logo = LOGO
    return m
  }

  /**
   * Prépare l'impression du document ouvert. Appelé par le bouton et aussi
   * sur « beforeprint », pour que Ctrl+P donne le document et non l'interface.
   * Le défilement est remis en haut : sinon Chrome peut omettre le pied de
   * page (position fixe) sur les pages imprimées.
   */
  let defilementAvantImpression = null
  function preparerImpression() {
    const root = document.getElementById('print-root')
    if (!state.doc || !previewHost) {
      document.body.classList.remove('imprime-doc')
      return null
    }
    const m = modele(state.doc)
    fill(root, L.renderDoc(m, { logo: LOGO }))
    document.body.classList.add('imprime-doc')
    if (defilementAvantImpression === null) defilementAvantImpression = window.scrollY
    window.scrollTo(0, 0)
    return m
  }

  window.addEventListener('beforeprint', () => {
    if (!document.body.classList.contains('imprime-doc')) preparerImpression()
  })
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('imprime-doc')
    if (defilementAvantImpression !== null) window.scrollTo(0, defilementAvantImpression)
    defilementAvantImpression = null
  })

  async function imprimer() {
    await sauver()
    const m = preparerImpression()
    if (!m) return
    const root = document.getElementById('print-root')
    await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))))
    const ancien = document.title
    document.title = m.fileName
    window.print()
    document.title = ancien
  }

  async function exporterWord() {
    await sauver()
    try {
      const m = modele(state.doc)
      const blob = await L.docx(m)
      L.download(`${m.fileName}.docx`, blob)
    } catch (e) {
      console.error(e)
      L.toast("L'export Word a échoué : " + e.message, 'warn')
    }
  }

  // ---------- Blocs partagés devis / facture ----------

  function blocClient(doc, { administration = false } = {}) {
    const c = doc.client
    const listId = 'clients-connus'
    const datalist = h('datalist', { id: listId }, state.clients.map((x) => h('option', { value: x.nom })))
    const nom = inp(c, 'nom', {
      list: listId,
      placeholder: 'Nom, raison sociale ou administration',
      onChange: (v) => {
        const connu = state.clients.find((x) => x.nom === v)
        if (connu) {
          for (const [k, val] of Object.entries(connu)) if (!c[k] && val) c[k] = val
          construireFormulaire()
          onChange()
        }
      },
    })
    const champs = [
      datalist,
      row(field('Type de client', sel(c, 'type', Object.entries(L.TYPES_CLIENT), { onInput: () => construireFormulaire() })), field('Nom', nom)),
      row(field('Service ou établissement', inp(c, 'service')), field('À l’attention de', inp(c, 'contact'))),
      field('Adresse', area(c, 'adresse', { rows: 2 })),
      row(
        c.type !== 'particulier' ? field('SIREN', inp(c, 'siren', { inputmode: 'numeric' }), 'Mention obligatoire sur les factures à partir du 1er septembre 2027.') : null,
        field('Courriel', inp(c, 'email', { type: 'email' })),
      ),
      row(
        field(c.type === 'administration' ? "N° d'engagement / bon de commande" : 'Référence du client', inp(c, 'reference')),
        administration && c.type === 'administration' ? field('Code service (Chorus Pro)', inp(c, 'codeService')) : null,
      ),
    ]
    return card('Client', champs)
  }

  function blocLignes(doc) {
    const wrap = h('div', { class: 'lignes' })
    const totalBox = h('div', { class: 'totaux' })
    const majTotaux = () => {
      const t = L.totaux(doc)
      fill(totalBox, 
        t.remise > 0 ? h('div', null, 'Sous-total : ', h('strong', null, L.euros(t.brut))) : null,
        t.remise > 0 ? h('div', null, `Remise (${L.qty(t.pct)} %) : `, h('strong', null, '− ' + L.euros(t.remise))) : null,
        h('div', { class: 'total-ht' }, 'Total HT : ', h('strong', null, L.euros(t.ht))),
      )
      wrap.querySelectorAll('[data-total]').forEach((o) => {
        const l = doc.lignes.find((x) => x.id === o.dataset.total)
        if (l) o.textContent = L.money(L.parseNumber(l.quantite) * L.parseNumber(l.prixUnitaire))
      })
    }
    const draw = () => {
      fill(wrap, 
        h('div', { class: 'ligne ligne--head' }, h('span', null, 'Désignation'), h('span', null, 'Unité'), h('span', null, 'Qté'), h('span', null, 'PU € HT'), h('span', null, 'Total'), h('span')),
        ...doc.lignes.map((l, i) =>
          h(
            'div',
            { class: 'ligne' },
            area(l, 'designation', { rows: 1, label: 'Désignation', class: 'ligne-des' }),
            inp(l, 'unite', { label: 'Unité' }),
            inp(l, 'quantite', { label: 'Quantité', inputmode: 'decimal', onInput: majTotaux }),
            inp(l, 'prixUnitaire', { label: 'Prix unitaire', inputmode: 'decimal', onInput: majTotaux }),
            h('output', { 'data-total': l.id }, ''),
            h(
              'span',
              { class: 'ligne-btns' },
              btn('↑', () => deplacer(doc.lignes, i, -1, draw), 'btn--icon', { title: 'Monter', disabled: i === 0 }),
              btn('↓', () => deplacer(doc.lignes, i, 1, draw), 'btn--icon', { title: 'Descendre', disabled: i === doc.lignes.length - 1 }),
              btn('✕', () => {
                doc.lignes.splice(i, 1)
                if (doc.kind === 'devis' && !doc.textesManuels) appliquerSections(doc)
                construireFormulaire()
                onChange()
              }, 'btn--icon btn--danger', { title: 'Retirer la ligne' }),
            ),
          ),
        ),
      )
      majTotaux()
    }
    draw()

    const choix = h(
      'select',
      { 'aria-label': 'Prestation du catalogue' },
      h('option', { value: '' }, 'Choisir une prestation du catalogue…'),
      Object.entries(L.CATEGORIES).map(([cat, label]) => {
        const items = state.catalogue.filter((x) => (x.categorie || 'autre') === cat)
        return items.length
          ? h(
              'optgroup',
              { label },
              items.map((x) => h('option', { value: x.code }, `${x.designation.replace(/\*\*/g, '')} — ${L.euros(x.prix)} / ${x.unite.toLowerCase()}`)),
            )
          : null
      }),
    )
    const ajouterChoix = () => {
      if (choix.value) ajouterPrestations(doc, [choix.value])
    }
    choix.addEventListener('change', ajouterChoix)

    return card(
      'Prestations et prix',
      h('div', { class: 'picker' }, choix),
      h(
        'div',
        { class: 'forfaits' },
        h('span', { class: 'hint' }, 'Ensembles : '),
        L.FORFAITS.map((f) => btn(f.libelle, () => ajouterPrestations(doc, f.codes), 'btn--small')),
      ),
      wrap,
      h(
        'div',
        { class: 'lignes-actions' },
        btn('+ Ligne libre', () => {
          doc.lignes.push({ id: L.uid(), code: '', designation: '', unite: 'Unité', quantite: 1, prixUnitaire: 0 })
          construireFormulaire()
          onChange()
        }, 'btn--small'),
        h(
          'div',
          { class: 'remise' },
          field('Libellé de la remise', inp(doc.remise, 'libelle', { placeholder: 'Remise partenaire' })),
          field('Remise (%)', inp(doc.remise, 'pourcentage', { inputmode: 'decimal', onInput: majTotaux, placeholder: '0' })),
        ),
      ),
      totalBox,
    )
  }

  function deplacer(list, i, d, redraw) {
    const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    redraw()
    onChange()
  }

  function ajouterPrestations(doc, codes) {
    for (const code of codes) {
      const item = state.catalogue.find((x) => x.code === code)
      if (!item) continue
      const existante = doc.lignes.find((l) => l.code === code)
      if (existante && doc.kind === 'facture' && code === 'AVIS-URG') continue
      doc.lignes.push({ id: L.uid(), code, designation: item.designation, unite: item.unite, quantite: 1, prixUnitaire: item.prix })
    }
    if (doc.kind === 'devis') {
      if (!doc.textesManuels) appliquerSections(doc)
      else L.toast('Les textes du devis ont été modifiés à la main : utilisez « Recomposer depuis le catalogue » pour les mettre à jour.', 'warn')
    } else if (!doc.nature) {
      const first = state.catalogue.find((x) => x.code === codes[0])
      if (first?.nature) doc.nature = first.nature
    }
    construireFormulaire()
    onChange()
  }

  function appliquerSections(doc) {
    const s = L.sectionsDepuisCatalogue(
      doc.lignes.map((l) => l.code).filter(Boolean),
      state.catalogue,
    )
    Object.assign(doc, s)
  }

  function blocNumero(doc, kind) {
    const recalc = async () => {
      doc.numero = await numero(kind, doc.dateEmission, doc.codeClient)
      doc.numeroAuto = true
      construireFormulaire()
      onChange()
    }
    const dateInput = inp(doc, 'dateEmission', {
      type: 'date',
      onInput: () => {
        if (doc.numeroAuto) recalc()
      },
    })
    return [
      row(
        field(kind === 'devis' ? 'Devis n°' : 'Facture n°', inp(doc, 'numero', { onInput: () => (doc.numeroAuto = false) })),
        field("Date d'émission", dateInput),
        kind === 'facture'
          ? field('Code client (suffixe du n°)', inp(doc, 'codeClient', { placeholder: 'ex. DDPP50', onChange: recalc }), 'Facultatif : 20260713_DDPP50')
          : field('Validité (jours)', inp(doc, 'validiteJours', { inputmode: 'numeric' })),
      ),
      h('div', { class: 'inline-actions' }, btn('Numéro automatique', recalc, 'btn--small btn--ghost')),
    ]
  }

  // ---------- Devis ----------

  function formDevis(doc) {
    const manuel = () => (doc.textesManuels = true)
    return [
      card(
        'Devis',
        ...blocNumero(doc, 'devis'),
        row(field('Statut', sel(doc, 'statut', STATUTS.devis))),
      ),
      blocClient(doc),
      blocLignes(doc),
      card(
        'Textes du devis',
        h(
          'p',
          { class: 'hint' },
          'Ces sections se remplissent à partir des prestations choisies. Vous pouvez les retoucher ; « Recomposer » les régénère depuis le catalogue. Une ligne = une puce ; deux espaces en début de ligne = une sous-puce ; **texte** = gras.',
        ),
        h(
          'div',
          { class: 'inline-actions' },
          btn('Recomposer depuis le catalogue', () => {
            if (doc.textesManuels && !confirm('Remplacer les textes modifiés à la main par ceux du catalogue ?')) return
            appliquerSections(doc)
            doc.textesManuels = false
            construireFormulaire()
            onChange()
          }, 'btn--small'),
        ),
        field("Nature de l'opération (titre du devis)", inp(doc, 'nature', { onInput: manuel })),
        field('Objet du devis', area(doc, 'objet', { rows: 2, onInput: manuel })),
        field('Prestations incluses', area(doc, 'prestations', { rows: 6, onInput: manuel })),
        field('Hypothèses et limites de mission', area(doc, 'hypotheses', { rows: 6, onInput: manuel }), 'La durée de validité du devis est ajoutée automatiquement.'),
        field("Délai d'exécution", area(doc, 'delai', { rows: 3, onInput: manuel })),
        field('Conditions de paiement', area(doc, 'conditionsPaiement', { rows: 2 })),
        field('Mentions administratives', area(doc, 'mentions', { rows: 4 }), 'La forme juridique et le SIRET sont ajoutés automatiquement.'),
      ),
    ]
  }

  // ---------- Facture ----------

  function formFacture(doc) {
    const c = doc.client
    const echeanceAuto = L.addDays(doc.dateEmission, state.params.documents.delaiPaiement)
    return [
      card(
        'Facture',
        ...blocNumero(doc, 'facture'),
        row(
          field('Date ou période de la prestation', inp(doc, 'datePrestation', { placeholder: 'ex. du 25/06/2026 au 10/07/2026' })),
          field('Devis de référence', inp(doc, 'devisRef')),
        ),
        row(
          field('Échéance', inp(doc, 'echeance', { type: 'date' }), `Par défaut : ${L.frDate(echeanceAuto)} (${state.params.documents.delaiPaiement} jours).`),
          field(
            'Statut',
            sel(doc, 'statut', STATUTS.facture, {
              onInput: async (v) => {
                if (v !== 'brouillon') await verifierChronologie(doc)
                if (v === 'payée' && !doc.datePaiement) doc.datePaiement = L.today()
                construireFormulaire()
              },
            }),
          ),
          doc.statut === 'payée' ? field('Payée le', inp(doc, 'datePaiement', { type: 'date' })) : null,
        ),
      ),
      blocClient(doc, { administration: true }),
      card(
        'Objet',
        field('Titre (après « Facture : »)', inp(doc, 'nature', { placeholder: "ex. Avis d'urgence sommaire hydrogéologique pour site d'enfouissement" })),
        field('Objet', area(doc, 'objet', { rows: 2 })),
      ),
      blocSynthese(doc),
      blocLignes(doc),
      card(
        'Conditions et mentions',
        field(
          'Conditions de paiement',
          area(doc, 'conditionsPaiement', { rows: 3, placeholder: L.conditionsFacture(c.type, L.frDate(doc.echeance || echeanceAuto)) }),
          'Laissez vide pour le texte type, adapté au type de client (pénalités de retard, indemnité de 40 € pour les professionnels et les administrations).',
        ),
        c.type === 'administration' ? chk(doc, 'chorus', 'Facture déposée sur Chorus Pro (obligatoire pour les clients publics)') : null,
        field('Note libre (facultatif)', area(doc, 'notes', { rows: 2 })),
      ),
    ]
  }

  async function verifierChronologie(doc) {
    const autres = (await L.listDocs('facture')).filter((f) => f.id !== doc.id && f.statut !== 'brouillon')
    const plusRecente = autres.find((f) => f.dateEmission > doc.dateEmission)
    if (plusRecente) {
      L.toast(`Attention : la facture ${plusRecente.numero} est datée après celle-ci. Les factures doivent suivre l'ordre chronologique.`, 'warn')
    }
    if (autres.some((f) => f.numero === doc.numero)) L.toast(`Le numéro ${doc.numero} est déjà utilisé.`, 'warn')
  }

  function blocSynthese(doc) {
    const s = doc.synthese
    const rows = s.lignes.map((r, i) =>
      h(
        'div',
        { class: 'synth' },
        inp(r, 'date', { type: 'date', label: 'Date' }),
        inp(r, 'site', { label: 'Site', placeholder: 'Site' }),
        inp(r, 'demandeur', { label: 'Demandeur', placeholder: 'Demandeur' }),
        inp(r, 'fait', { label: 'Fait', placeholder: 'Oui' }),
        inp(r, 'commentaire', { label: 'Commentaire', placeholder: 'Favorable' }),
        btn('✕', () => {
          s.lignes.splice(i, 1)
          majQuantiteAvis(doc)
          construireFormulaire()
          onChange()
        }, 'btn--icon btn--danger', { title: 'Retirer' }),
      ),
    )
    return card(
      'Synthèse des avis (facultatif)',
      chk(s, 'actif', 'Joindre à la facture un tableau des avis émis', { onInput: () => construireFormulaire() }),
      s.actif
        ? [
            field('Phrase d’introduction', inp(s, 'intro', { placeholder: 'Ci-après la synthèse des avis émis dans le cadre des missions confiées :' })),
            h('div', { class: 'synth synth--head' }, ['Date', 'Site', 'Demandeur', 'Fait', 'Commentaire', ''].map((x) => h('span', null, x))),
            rows,
            h(
              'div',
              { class: 'inline-actions' },
              btn('Importer des avis', () => importerAvis(doc), 'btn--small btn--primary'),
              btn('+ Ligne', () => {
                s.lignes.push({ date: L.today(), site: '', demandeur: '', fait: 'Oui', commentaire: 'Favorable' })
                construireFormulaire()
                onChange()
              }, 'btn--small'),
            ),
          ]
        : null,
    )
  }

  function majQuantiteAvis(doc) {
    const n = doc.synthese.lignes.length
    const ligne = doc.lignes.find((l) => l.code === 'AVIS-URG')
    if (ligne) ligne.quantite = n
    else if (n) {
      const item = state.catalogue.find((x) => x.code === 'AVIS-URG')
      if (item) doc.lignes.push({ id: L.uid(), code: item.code, designation: item.designation, unite: item.unite, quantite: n, prixUnitaire: item.prix })
    }
  }

  async function importerAvis(doc) {
    const tous = (await L.listDocs('avis')).filter((a) => a.aFacturer !== false && (!a.factureId || a.factureId === doc.id))
    const deja = new Set(doc.synthese.lignes.map((r) => r.avisId).filter(Boolean))
    const candidats = tous.filter((a) => !deja.has(a.id)).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    if (!candidats.length) {
      L.toast('Aucun avis à facturer.', 'warn')
      return
    }
    const coches = new Set(candidats.map((a) => a.id))
    const dialog = h(
      'dialog',
      { class: 'modal' },
      h('h3', null, 'Avis à facturer'),
      h('p', { class: 'hint' }, 'Cochez les avis à ajouter au tableau de synthèse. La quantité de la ligne « Avis d’urgence » suit le nombre d’avis.'),
      h(
        'div',
        { class: 'modal-list' },
        candidats.map((a) => {
          const cb = h('input', { type: 'checkbox', checked: true })
          cb.addEventListener('change', () => (cb.checked ? coches.add(a.id) : coches.delete(a.id)))
          return h('label', { class: 'check' }, cb, ` ${L.frDate(a.date)} — ${L.siteAvis(a) || 'site ?'} — ${L.demandeurAvis(a) || 'demandeur ?'} (${L.SENS_AVIS[a.sens]?.libelle || ''})`)
        }),
      ),
      h(
        'div',
        { class: 'inline-actions' },
        btn('Ajouter', () => {
          for (const a of candidats.filter((x) => coches.has(x.id))) {
            doc.synthese.lignes.push({
              avisId: a.id,
              date: a.date,
              site: L.siteAvis(a),
              demandeur: L.demandeurAvis(a),
              fait: 'Oui',
              commentaire: L.SENS_AVIS[a.sens]?.libelle || '',
            })
          }
          doc.synthese.actif = true
          if (!doc.nature) doc.nature = "Avis d'urgence sommaire hydrogéologique pour site d'enfouissement"
          if (!doc.objet)
            doc.objet =
              "Prestation de services intellectuelles / avis technique sommaire — Avis d'urgence sommaire hydrogéologique pour site d'enfouissement de cadavres d'animaux."
          if (!doc.datePrestation && doc.synthese.lignes.length) {
            const dates = doc.synthese.lignes.map((r) => r.date).filter(Boolean).sort()
            doc.datePrestation = dates[0] === dates.at(-1) ? L.frDate(dates[0]) : `du ${L.frDate(dates[0])} au ${L.frDate(dates.at(-1))}`
          }
          majQuantiteAvis(doc)
          dialog.close()
          dialog.remove()
          construireFormulaire()
          onChange()
        }, 'btn--primary'),
        btn('Annuler', () => {
          dialog.close()
          dialog.remove()
        }, 'btn--ghost'),
      ),
    )
    document.body.append(dialog)
    dialog.showModal()
  }

  /** Reporte le numéro de facture sur les avis importés (et le retire des avis enlevés). */
  async function synchroniserAvis(f) {
    const ids = new Set((f.synthese?.lignes || []).map((r) => r.avisId).filter(Boolean))
    for (const id of ids) {
      const a = await L.getDoc(id)
      if (a && (a.factureId !== f.id || a.factureNumero !== f.numero)) {
        a.factureId = f.id
        a.factureNumero = f.numero
        await L.saveDoc(a)
      }
    }
    await libererAvis(f.id, ids)
  }

  async function libererAvis(factureId, garder) {
    for (const a of await L.listDocs('avis')) {
      if (a.factureId === factureId && !garder.has(a.id)) {
        a.factureId = null
        a.factureNumero = ''
        await L.saveDoc(a)
      }
    }
  }

  // ---------- Avis ----------

  function formAvis(doc) {
    const m = L.MODELES_AVIS[doc.modele] || L.MODELES_AVIS.libre
    const val = (label) => doc.demande.find((r) => r.label === label)

    const demandeRows = doc.demande.map((r, i) =>
      h(
        'div',
        { class: 'kv' },
        inp(r, 'label', { label: 'Élément' }),
        inp(r, 'valeur', { label: 'Information' }),
        btn('✕', () => {
          doc.demande.splice(i, 1)
          construireFormulaire()
          onChange()
        }, 'btn--icon btn--danger', { title: 'Retirer' }),
      ),
    )

    const docsRows = doc.documents.map((d, i) =>
      h(
        'div',
        { class: 'src' },
        (() => {
          const cb = h('input', { type: 'checkbox', checked: Boolean(d.coche), 'aria-label': 'Consulté' })
          cb.addEventListener('change', () => {
            d.coche = cb.checked
            onChange()
          })
          return cb
        })(),
        inp(d, 'label', { label: 'Document' }),
        inp(d, 'url', { label: 'Adresse', placeholder: 'https://…' }),
        btn('✕', () => {
          doc.documents.splice(i, 1)
          construireFormulaire()
          onChange()
        }, 'btn--icon btn--danger', { title: 'Retirer' }),
      ),
    )

    const analyseRows = doc.analyse.map((r, i) =>
      h(
        'div',
        { class: 'ana' },
        inp(r, 'point', { label: 'Point examiné' }),
        area(r, 'constat', { rows: 2, label: 'Constat', placeholder: 'Constat' }),
        sel(r, 'risque', L.RISQUES.map((x) => [x, x || 'Risque…']), { label: 'Appréciation' }),
        inp(r, 'precision', { label: 'Précision', placeholder: 'Précision (ex. hors périmètre)' }),
        btn('✕', () => {
          doc.analyse.splice(i, 1)
          construireFormulaire()
          onChange()
        }, 'btn--icon btn--danger', { title: 'Retirer' }),
      ),
    )

    const carteInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'carte-file' })
    carteInput.addEventListener('change', async () => {
      const file = carteInput.files?.[0]
      if (!file) return
      try {
        doc.carte = { ...(await L.readImage(file, { maxSide: 1800, quality: 0.82 })), legende: doc.carte?.legende || '' }
        construireFormulaire()
        onChange()
      } catch (e) {
        L.toast(e.message, 'warn')
      }
    })

    const lat = String(doc.latitude || '').replace(',', '.')
    const lon = String(doc.longitude || '').replace(',', '.')
    const coordsOk = lat && lon && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon))

    const formulationAuto = L.phraseAvis(doc)

    return [
      card(
        'Avis',
        row(
          field(
            'Modèle',
            sel(doc, 'modele', Object.entries(L.MODELES_AVIS).map(([k, x]) => [k, x.libelle]), {
              onInput: (k) => {
                const nm = L.MODELES_AVIS[k]
                if (confirm('Reprendre les textes types de ce modèle (objet, demande, cadre, analyse, prescriptions, conclusion) ?')) {
                  Object.assign(doc, {
                    titre: nm.titre,
                    objet: nm.objet,
                    objetCourt: nm.objetCourt,
                    demande: L.clone(nm.demande),
                    cadre: doc.visite ? nm.cadreVisite : nm.cadre,
                    analyse: L.clone(nm.analyse),
                    prescriptions: nm.prescriptions,
                    conclusion: nm.conclusion,
                    aFacturer: Boolean(nm.catalogue),
                  })
                }
                construireFormulaire()
              },
            }),
          ),
          field("Date de l'avis", inp(doc, 'date', { type: 'date' })),
        ),
        row(field('Fait à', inp(doc, 'lieu')), field('Rédacteur', inp(doc, 'redacteur'))),
        field('Titre', inp(doc, 'titre')),
        field('Objet', area(doc, 'objet', { rows: 3 })),
      ),
      card(
        'Identification de la demande',
        h('p', { class: 'hint' }, "La ligne « Exploitation ou site » sert de nom à l'avis et alimente la synthèse de facturation."),
        demandeRows,
        h(
          'div',
          { class: 'inline-actions' },
          btn('+ Ligne', () => {
            doc.demande.push({ label: '', valeur: '' })
            construireFormulaire()
          }, 'btn--small'),
          val('Date et heure de la demande') && !val('Date et heure de la demande').valeur
            ? btn('Maintenant', () => {
                const d = new Date()
                val('Date et heure de la demande').valeur = `${L.frDate(L.isoDate(d))} – ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
                construireFormulaire()
                onChange()
              }, 'btn--small btn--ghost')
            : null,
        ),
      ),
      card(
        "Cadre et limites de l'avis",
        chk(doc, 'visite', 'Une visite de terrain a été réalisée', {
          onInput: (v) => {
            const avant = v ? m.cadre : m.cadreVisite
            if (!doc.cadre || doc.cadre === avant) doc.cadre = v ? m.cadreVisite : m.cadre
            construireFormulaire()
          },
        }),
        field('Cadre', area(doc, 'cadre', { rows: 4 })),
        doc.visite ? null : field('Limitations liées à l’absence de visite', area(doc, 'limites', { rows: 6 }), 'Une ligne par puce.'),
      ),
      card(
        'Documents et informations consultés',
        docsRows,
        h(
          'div',
          { class: 'inline-actions' },
          btn('+ Document', () => {
            doc.documents.push({ label: '', url: '', coche: true })
            construireFormulaire()
          }, 'btn--small'),
        ),
      ),
      card(
        "Localisation du site d'étude",
        row(field('Latitude', inp(doc, 'latitude', { inputmode: 'decimal', placeholder: '48.62' })), field('Longitude', inp(doc, 'longitude', { inputmode: 'decimal', placeholder: '-1.39' }))),
        field('Lieu-dit ou adresse (facultatif)', inp(doc, 'lieuDit')),
        coordsOk
          ? h(
              'p',
              { class: 'inline-actions' },
              h('a', { class: 'btn btn--small', target: '_blank', rel: 'noopener', href: `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15&l0=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2::GEOPORTAIL:OGC:WMTS(1)&permalink=yes` }, 'Ouvrir Géoportail'),
              h('a', { class: 'btn btn--small', target: '_blank', rel: 'noopener', href: `https://infoterre.brgm.fr/viewer/MainTileForward.do?lat=${lat}&lon=${lon}&z=14` }, 'Ouvrir InfoTerre'),
              h('a', { class: 'btn btn--small', target: '_blank', rel: 'noopener', href: `https://carto.atlasante.fr/` }, 'Ouvrir AtlaSanté'),
            )
          : h('p', { class: 'hint' }, 'Renseignez les coordonnées pour ouvrir directement Géoportail et InfoTerre sur le site.'),
        carteInput,
        doc.carte?.src
          ? [
              h('img', { class: 'carte-mini', src: doc.carte.src, alt: 'Figure de localisation' }),
              field('Légende de la figure', inp(doc.carte, 'legende', { placeholder: 'Figure 1 : localisation du site (fond IGN)' })),
              h(
                'div',
                { class: 'inline-actions' },
                h('label', { class: 'btn btn--small', for: 'carte-file' }, 'Remplacer la figure'),
                btn('Retirer la figure', () => {
                  doc.carte = null
                  construireFormulaire()
                  onChange()
                }, 'btn--small btn--danger'),
              ),
            ]
          : h('label', { class: 'drop', for: 'carte-file' }, 'Importer une capture de carte (PNG ou JPEG). Elle est réduite automatiquement.'),
      ),
      card(
        'Analyse hydrogéologique sommaire',
        analyseRows,
        h(
          'div',
          { class: 'inline-actions' },
          btn('+ Point examiné', () => {
            doc.analyse.push({ point: '', constat: '', risque: '', precision: '' })
            construireFormulaire()
          }, 'btn--small'),
        ),
      ),
      card('Prescriptions minimales', field('Une ligne par prescription', area(doc, 'prescriptions', { rows: 8 }))),
      card(
        "Formulation de l'avis",
        h(
          'div',
          { class: 'radios', role: 'radiogroup', 'aria-label': "Sens de l'avis" },
          Object.entries(L.SENS_AVIS).map(([k, s]) => {
            const r = h('input', { type: 'radio', name: 'sens', value: k, checked: doc.sens === k })
            r.addEventListener('change', () => {
              doc.sens = k
              construireFormulaire()
              onChange()
            })
            return h('label', { class: `check pill pill--${k}` }, r, ' ', s.libelle)
          }),
        ),
        field('Objet court (fin de la phrase d’avis)', inp(doc, 'objetCourt', { placeholder: m.objetCourt })),
        field(
          'Formulation',
          area(doc, 'formulation', { rows: 3, placeholder: formulationAuto.replace(/\*\*/g, '') }),
          'Laissez vide pour la phrase automatique, qui suit le sens de l’avis.',
        ),
        field('Réserves et conditions impératives', area(doc, 'reserves', { rows: 2, placeholder: 'Cf. prescriptions présentées en section précédente.' })),
        field('Conclusion opérationnelle', area(doc, 'conclusion', { rows: 5 })),
        h(
          'div',
          { class: 'inline-actions' },
          m.conclusion
            ? btn('Conclusion type', () => {
                doc.conclusion =
                  doc.sens === 'defavorable'
                    ? "Au regard des éléments disponibles, le site proposé ne réunit pas les conditions permettant d'envisager l'opération sans risque pour les eaux souterraines et superficielles. Il est recommandé de rechercher un autre site ou de recourir à une autre solution de collecte ou de traitement."
                    : m.conclusion
                construireFormulaire()
                onChange()
              }, 'btn--small btn--ghost')
            : null,
        ),
      ),
      card(
        'Facturation',
        chk(doc, 'aFacturer', 'Avis à facturer', { onInput: () => construireFormulaire() }),
        h('p', { class: 'hint' }, doc.factureNumero ? `Facturé dans la facture n° ${doc.factureNumero}.` : 'Pas encore facturé.'),
      ),
    ]
  }

  // ---------- Catalogue ----------

  function vueCatalogue() {
    const cat = state.catalogue
    let ouvert = null
    const host = h('div', { class: 'cat' })
    const persist = L.debounce(async () => {
      await L.db.set('catalogue', cat)
      saveLabel.textContent = 'Catalogue enregistré ✓'
    }, 400)
    onChange = persist

    const draw = () => {
      fill(host, 
        ...Object.entries(L.CATEGORIES).map(([k, label]) => {
          const items = cat.filter((x) => (x.categorie || 'autre') === k)
          if (!items.length) return null
          return h(
            'section',
            { class: 'card' },
            h('h3', null, label),
            items.map((item) => {
              const isOpen = ouvert === item
              const lineEdit = (key) => {
                const holder = { v: (item[key] || []).join('\n') }
                return area(holder, 'v', { rows: 5, onInput: (v) => (item[key] = v.split('\n').filter((x) => x.trim())) })
              }
              return h(
                'div',
                { class: 'cat-item' + (isOpen ? ' open' : '') },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'cat-row',
                    'aria-expanded': String(isOpen),
                    onclick: () => {
                      ouvert = isOpen ? null : item
                      draw()
                    },
                  },
                  h('span', { class: 'cat-code' }, item.code),
                  h('span', { class: 'cat-des', html: L.inline(item.designation) }),
                  h('span', { class: 'cat-prix' }, `${L.euros(item.prix)} / ${String(item.unite).toLowerCase()}`),
                ),
                isOpen
                  ? h(
                      'div',
                      { class: 'cat-edit' },
                      row(
                        field('Code', inp(item, 'code')),
                        field('Catégorie', sel(item, 'categorie', Object.entries(L.CATEGORIES))),
                        field('Unité', inp(item, 'unite')),
                        field('Prix HT (€)', inp(item, 'prix', { inputmode: 'decimal', onInput: (v) => (item.prix = L.parseNumber(v)) })),
                      ),
                      field('Désignation (ligne du tableau de prix)', inp(item, 'designation')),
                      row(field("Nature de l'opération", inp(item, 'nature')), field('Objet (« Le présent devis porte sur … »)', inp(item, 'objet'))),
                      field('Prestations incluses', lineEdit('prestations'), 'Une ligne par puce ; deux espaces en début de ligne pour une sous-puce.'),
                      field('Hypothèses et limites', lineEdit('hypotheses')),
                      field("Délai d'exécution", area(item, 'delai', { rows: 2 })),
                      h(
                        'div',
                        { class: 'inline-actions' },
                        btn('Supprimer cette prestation', async () => {
                          if (!confirm(`Supprimer « ${item.designation.replace(/\*\*/g, '')} » du catalogue ?`)) return
                          cat.splice(cat.indexOf(item), 1)
                          ouvert = null
                          await L.db.set('catalogue', cat)
                          draw()
                        }, 'btn--small btn--danger'),
                      ),
                    )
                  : null,
              )
            }),
          )
        }),
      )
    }
    draw()

    fill(main, 
      h(
        'div',
        { class: 'list-head' },
        h('h1', null, 'Catalogue des prestations'),
        h(
          'div',
          { class: 'list-actions' },
          btn('Nouvelle prestation', async () => {
            const item = { code: `PRESTA-${cat.length + 1}`, categorie: 'autre', designation: 'Nouvelle prestation', unite: 'Forfait', prix: 0, nature: '', objet: '', prestations: [], hypotheses: [], delai: '' }
            cat.push(item)
            ouvert = item
            await L.db.set('catalogue', cat)
            draw()
          }, 'btn--primary'),
          btn('Revenir au catalogue d’origine', async () => {
            if (!confirm('Remplacer le catalogue par les prestations et prix d’origine (business plan) ? Vos modifications seront perdues.')) return
            await L.db.del('catalogue')
            state.catalogue = await L.catalogue()
            vueCatalogue()
          }, 'btn--ghost'),
        ),
      ),
      h('p', { class: 'hint' }, 'Les modifications valent pour les prochains devis et factures ; les documents déjà créés gardent leurs lignes.'),
      host,
    )
  }

  // ---------- Paramètres ----------

  async function vueParametres() {
    const p = state.params
    const persist = L.debounce(async () => {
      await L.db.set('parametres', p)
      saveLabel.textContent = 'Paramètres enregistrés ✓'
    }, 400)
    onChange = persist

    const sigInput = h('input', { type: 'file', accept: 'image/png,image/jpeg', class: 'visually-hidden', id: 'sig-file' })
    sigInput.addEventListener('change', async () => {
      const file = sigInput.files?.[0]
      if (!file) return
      p.signature = await L.readImage(file, { maxSide: 600, keepPng: true })
      await L.db.set('parametres', p)
      vueParametres()
    })

    const importInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'import-file' })
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0]
      if (!file) return
      try {
        const json = JSON.parse(await file.text())
        const remplacer = confirm('Remplacer toutes les données actuelles par la sauvegarde ?\n\nOK : remplacer — Annuler : fusionner (les documents de même identifiant sont écrasés).')
        const n = await L.importAll(json, { remplacer })
        state.params = await L.parametres()
        state.catalogue = await L.catalogue()
        state.clients = await L.clients()
        L.toast(`${n} éléments importés.`)
        vueParametres()
      } catch (e) {
        L.toast(e.message, 'warn')
      }
    })

    const derniere = await L.db.get('derniereSauvegarde')
    const i = p.identite
    const b = p.banque
    const d = p.documents

    fill(main, 
      h('div', { class: 'list-head' }, h('h1', null, 'Paramètres')),
      h(
        'div',
        { class: 'params' },
        card(
          'Identité (en-têtes et pied de page)',
          row(field('Nom et prénom (légal)', inp(i, 'nom')), field('Signataire', inp(i, 'signataire'))),
          row(field('Nom commercial', inp(i, 'marque')), field('Forme juridique', inp(i, 'forme'))),
          row(field('SIRET', inp(i, 'siret')), field('Téléphone', inp(i, 'telephone'))),
          row(field('Adresse', inp(i, 'adresse')), field('Code postal', inp(i, 'codePostal')), field('Commune', inp(i, 'ville'))),
          row(field('Courriel', inp(i, 'courriel', { type: 'email' })), field('Site', inp(i, 'site'))),
        ),
        card(
          'Coordonnées bancaires',
          h('p', { class: 'hint' }, 'Conservées dans ce navigateur uniquement (et dans vos sauvegardes). Elles ne sont jamais écrites dans le dépôt GitHub.'),
          row(field('Titulaire', inp(b, 'titulaire')), field('Banque', inp(b, 'banque'))),
          row(field('IBAN', inp(b, 'iban', { placeholder: 'FR76 …' })), field('BIC', inp(b, 'bic'))),
        ),
        card(
          'Signature',
          sigInput,
          p.signature?.src ? h('img', { class: 'sig-preview', src: p.signature.src, alt: 'Signature' }) : h('p', { class: 'hint' }, 'Aucune signature : les documents portent seulement « Signature : ».'),
          h(
            'div',
            { class: 'inline-actions' },
            h('label', { class: 'btn btn--small', for: 'sig-file' }, p.signature ? 'Remplacer' : 'Importer une signature (PNG transparent de préférence)'),
            p.signature
              ? btn('Retirer', async () => {
                  p.signature = null
                  await L.db.set('parametres', p)
                  vueParametres()
                }, 'btn--small btn--danger')
              : null,
          ),
        ),
        card(
          'Documents',
          chk(d, 'logo', 'Afficher le logo LYZa en tête des documents'),
          row(
            field('Couleur des titres', inp(d, 'couleur', { type: 'color' })),
            field('Lieu de signature', inp(d, 'lieu')),
          ),
          row(
            field('Validité des devis (jours)', inp(d, 'validiteDevis', { inputmode: 'numeric', onInput: (v) => (d.validiteDevis = L.parseNumber(v)) })),
            field('Délai de paiement des factures (jours)', inp(d, 'delaiPaiement', { inputmode: 'numeric', onInput: (v) => (d.delaiPaiement = L.parseNumber(v)) })),
          ),
          field('Mention TVA', inp(d, 'tva')),
        ),
        card(
          'Sauvegarde',
          h(
            'p',
            null,
            "Les devis, factures, avis, clients et paramètres sont enregistrés dans ce navigateur, sur cet appareil. Exportez régulièrement une sauvegarde : elle permet aussi de passer d'un ordinateur à l'autre. ",
            h('strong', null, derniere ? `Dernière sauvegarde : ${new Date(derniere).toLocaleString('fr-FR')}.` : 'Aucune sauvegarde exportée pour le moment.'),
          ),
          importInput,
          h(
            'div',
            { class: 'inline-actions' },
            btn('Exporter une sauvegarde', async () => {
              const data = await L.exportAll()
              L.download(`LYZa_outils_sauvegarde_${L.compactDate(L.today())}.json`, new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
              await L.db.set('derniereSauvegarde', new Date().toISOString())
              vueParametres()
            }, 'btn--primary'),
            h('label', { class: 'btn', for: 'import-file' }, 'Importer une sauvegarde'),
          ),
        ),
      ),
    )
  }

  // ---------- Lancement ----------

  // Les scripts sont en fin de page : #app existe déjà. (La page déchiffrée est
  // écrite par document.write, où DOMContentLoaded n'est pas garanti.)
  if (document.getElementById('app')) start()
  else document.addEventListener('DOMContentLoaded', start)

  L.app = { state }
})()
