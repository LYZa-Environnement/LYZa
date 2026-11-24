/*
 * Outils internes LYZa — construction des documents.
 *
 * Chaque document (devis, facture, avis) est décrit une seule fois sous forme
 * d'une liste de blocs (titre, paragraphe, liste, tableau, image...). Cette
 * description sert ensuite aux deux sorties : l'aperçu imprimable (PDF) et
 * l'export Word (.docx). Ainsi les deux restent identiques.
 *
 * Balisage des textes : **gras** ; les adresses http(s) deviennent des liens.
 */
;(() => {
  const L = window.LYZA
  const { frDate, money, qty, round2, parseNumber, bulletsFromText } = L

  // ---------- Calculs ----------

  function totaux(doc) {
    const lignes = (doc.lignes || []).map((l) => {
      const q = parseNumber(l.quantite)
      const pu = parseNumber(l.prixUnitaire)
      return { ...l, q, pu, total: round2(q * pu) }
    })
    const brut = round2(lignes.reduce((s, l) => s + l.total, 0))
    const pct = parseNumber(doc.remise?.pourcentage)
    const remise = pct > 0 ? round2((brut * pct) / 100) : 0
    const ht = round2(brut - remise)
    return { lignes, brut, remise, pct, ht, ttc: ht }
  }

  // ---------- Morceaux communs ----------

  function adresseLignes(identite) {
    return `${identite.adresse}, ${identite.codePostal} ${identite.ville}`
  }

  function piedDePage(p) {
    const i = p.identite
    return [
      `${i.nom} — ${i.forme}`,
      `SIRET : ${i.siret}`,
      `Adresse professionnelle : ${adresseLignes(i)}`,
      `Courriel : ${i.courriel}`,
      `Tél. : ${i.telephone}`,
    ].join(' — ')
  }

  function clientLignes(c) {
    if (!c) return []
    const out = []
    if (c.nom) out.push(`**${c.nom}**`)
    if (c.service) out.push(c.service)
    if (c.contact) out.push(`À l’attention de ${c.contact}`)
    for (const line of String(c.adresse || '').split('\n')) if (line.trim()) out.push(line.trim())
    if (c.siren && c.type !== 'particulier') out.push(`SIREN : ${c.siren}`)
    if (c.email) out.push(c.email)
    return out
  }

  function tableauPrix(doc) {
    const t = totaux(doc)
    const rows = t.lignes.map((l) => [l.designation, l.unite, qty(l.q), money(l.pu), money(l.total)])
    const foot = []
    if (t.remise > 0) {
      foot.push([{ text: '**Sous-total € HT**', span: 4 }, { text: `**${money(t.brut)}**`, align: 'right' }])
      foot.push([
        { text: `${doc.remise.libelle || 'Remise'} (${qty(t.pct)} %)`, span: 4 },
        { text: `− ${money(t.remise)}`, align: 'right' },
      ])
    }
    return { t, rows, foot }
  }

  function enteteLogo(p) {
    return p.documents.logo ? [{ t: 'logo' }] : []
  }

  // ---------- Devis ----------

  /**
   * Fusionne les puces de plusieurs prestations du catalogue : les doublons
   * disparaissent et les sous-puces d'un même intitulé (« Réalisation
   * d'analyses environnementales : ») sont regroupées.
   */
  function fusionnerPuces(listes) {
    const items = []
    for (const liste of listes) {
      for (const item of bulletsFromText((liste || []).join('\n'))) {
        const existing = items.find((x) => x.text === item.text)
        if (existing) {
          for (const s of item.sub || []) {
            existing.sub = existing.sub || []
            if (!existing.sub.includes(s)) existing.sub.push(s)
          }
        } else {
          items.push(L.clone(item))
        }
      }
    }
    return ponctuer(items)
  }

  /**
   * Ponctuation des listes à la française, comme dans les devis existants :
   * chaque puce finit par « ; », la toute dernière par un point, et un
   * intitulé suivi de sous-puces par « : ».
   */
  function ponctuer(items) {
    const fin = (s, mark) => s.replace(/\s*[;.:,]\s*$/, '') + mark
    items.forEach((item, k) => {
      const dernier = k === items.length - 1
      if (item.sub && item.sub.length) {
        item.text = fin(item.text, ' :')
        item.sub = item.sub.map((s, j) => fin(s, dernier && j === item.sub.length - 1 ? '.' : ' ;'))
      } else {
        item.text = fin(item.text, dernier ? '.' : ' ;')
      }
    })
    return items
  }

  /** Sections du devis recalculées depuis les prestations du catalogue retenues. */
  function sectionsDepuisCatalogue(codes, catalogue) {
    const items = codes.map((c) => catalogue.find((x) => x.code === c)).filter(Boolean)
    const uniques = [...new Map(items.map((i) => [i.code, i])).values()]
    const objets = [...new Set(uniques.map((i) => i.objet).filter(Boolean))]
    const natures = [...new Set(uniques.map((i) => i.nature).filter(Boolean))]
    const delais = [...new Set(uniques.map((i) => i.delai).filter(Boolean))]
    return {
      nature: natures[0] || '',
      objet: objets.length ? `Le présent devis porte sur ${joinFr(objets)}.` : '',
      prestations: L.bulletsToText(fusionnerPuces(uniques.map((i) => i.prestations))),
      hypotheses: L.bulletsToText(fusionnerPuces(uniques.map((i) => i.hypotheses))),
      delai: delais.join('\n'),
    }
  }

  function joinFr(list) {
    if (list.length <= 1) return list.join('')
    return list.slice(0, -1).join(', ') + ' et ' + list[list.length - 1]
  }

  function devis(doc, p) {
    const i = p.identite
    const validite = Number(doc.validiteJours || p.documents.validiteDevis || 90)
    const finValidite = frDate(L.addDays(doc.dateEmission, validite))
    const nature = doc.nature || 'Prestation'
    const { t, rows, foot } = tableauPrix(doc)

    const hypotheses = ponctuer([
      ...bulletsFromText(doc.hypotheses),
      { text: `Devis valable ${validite} jours à compter de sa date d'émission, soit jusqu'au ${finValidite}` },
    ])

    const mentions = ponctuer([
      { text: `Forme juridique du prestataire : ${i.forme}` },
      { text: `SIRET : ${i.siret}` },
      ...bulletsFromText(doc.mentions),
    ])

    const blocks = [
      ...enteteLogo(p),
      {
        t: 'cols',
        widths: [44, 56],
        cols: [
          [
            {
              t: 'table',
              style: 'box',
              rows: [
                [`Nom / Prénom : ${i.nom}`],
                [`Forme juridique : ${i.forme}`],
                [`SIRET : ${i.siret}`],
                [`Adresse professionnelle : ${adresseLignes(i)}`],
                [`Téléphone : ${i.telephone}`],
                [`Courriel : ${i.courriel}`],
              ],
              size: 'small',
            },
          ],
          [
            { t: 'title', text: `Devis : ${nature}` },
            { t: 'p', text: `**Devis n° :** ${doc.numero}` },
            { t: 'p', text: `**Date d'émission :** ${frDate(doc.dateEmission)}` },
            { t: 'p', text: `**Nature de l'opération :** ${nature}` },
            ...(clientLignes(doc.client).length
              ? [{ t: 'p', text: '**Client :**', space: 'tight' }, ...clientLignes(doc.client).map((x) => ({ t: 'p', text: x, space: 'tight' }))]
              : []),
            ...(doc.client?.reference ? [{ t: 'p', text: `**Votre référence :** ${doc.client.reference}` }] : []),
          ],
        ],
      },
      { t: 'h', text: 'Objet du devis' },
      { t: 'p', text: doc.objet || '' },
      { t: 'h', text: 'Prestations incluses' },
      { t: 'ul', items: bulletsFromText(doc.prestations) },
      { t: 'h', text: 'Hypothèses et limites de mission' },
      { t: 'ul', items: hypotheses },
      { t: 'h', text: 'Prix de la prestation' },
      {
        t: 'table',
        style: 'grid',
        head: ['Désignation', 'Unité', 'Quantité', 'Prix unitaire € HT', 'Total € HT'],
        widths: [43, 13, 12, 15, 17],
        align: ['left', 'center', 'center', 'right', 'right'],
        rows,
        foot: [...foot, [{ text: '**Total € HT**', span: 4 }, { text: `**${money(t.ht)}**`, align: 'right' }]],
      },
      { t: 'p', text: `**${p.documents.tva}**` },
      { t: 'h', text: "Délai d'exécution" },
      ...String(doc.delai || '')
        .split('\n')
        .filter((x) => x.trim())
        .map((x) => ({ t: 'p', text: x })),
      { t: 'h', text: 'Conditions de paiement' },
      { t: 'p', text: doc.conditionsPaiement || L.DEVIS_DEFAUT.conditionsPaiement },
      { t: 'h', text: 'Mentions administratives et réglementaires' },
      { t: 'ul', items: mentions },
      { t: 'h', text: 'Acceptation du devis' },
      {
        t: 'p',
        text: 'Pour acceptation du présent devis, merci de retourner le document signé avec la mention manuscrite ou électronique « Bon pour accord ».',
        keepNext: true,
      },
      {
        t: 'cols',
        widths: [50, 50],
        keep: true,
        cols: [
          [
            { t: 'p', text: `**Pour ${i.marque}**` },
            { t: 'p', text: `Nom : ${i.signataire}` },
            { t: 'p', text: `Date : ${frDate(doc.dateEmission)}` },
            { t: 'p', text: 'Signature :' },
            ...(p.signature ? [{ t: 'sign', ...p.signature }] : []),
          ],
          [
            { t: 'p', text: '**Pour le client**' },
            { t: 'p', text: `Nom : ${doc.client?.contact || doc.client?.nom || ''}` },
            { t: 'p', text: 'Date :' },
            { t: 'p', text: 'Signature, précédée de la mention « Bon pour accord » :' },
          ],
        ],
      },
    ]

    return {
      title: `Devis ${doc.numero}`,
      fileName: L.safeName(`DEVIS_${doc.numero}_${doc.client?.nom || ''}`),
      accent: p.documents.couleur,
      footer: piedDePage(p),
      blocks,
    }
  }

  // ---------- Facture ----------

  function facture(doc, p) {
    const i = p.identite
    const b = p.banque
    const c = doc.client || {}
    const { t, rows, foot } = tableauPrix(doc)
    const echeance = frDate(doc.echeance || L.addDays(doc.dateEmission, p.documents.delaiPaiement || 30))

    const refs = []
    if (c.reference) refs.push(`numéro d'engagement ou bon de commande : ${c.reference}`)
    if (c.codeService) refs.push(`code service : ${c.codeService}`)
    if (c.type === 'administration' && doc.chorus) refs.push('facture déposée sur Chorus Pro')

    const enTete = [`**Facture n° :** ${doc.numero}`, `**Date d'émission :** ${frDate(doc.dateEmission)}`]
    if (doc.devisRef) enTete.push(`**Devis de référence :** ${doc.devisRef}`)

    const blocks = [
      ...enteteLogo(p),
      { t: 'title', text: `Facture : ${doc.nature || doc.objet || 'Prestation de services'}` },
      {
        t: 'table',
        style: 'plain',
        head: ['Prestataire', 'Client'],
        widths: [50, 50],
        rows: [
          [
            [i.nom, i.forme, `SIRET : ${i.siret}`, adresseLignes(i), `Tél. : ${i.telephone}`, `Courriel : ${i.courriel}`].join('\n'),
            clientLignes(c).join('\n') || ' ',
          ],
        ],
      },
      { t: 'p', text: enTete.join(' — ') },
      ...(doc.datePrestation ? [{ t: 'p', text: `**Date ou période de la prestation :** ${doc.datePrestation}` }] : []),
      { t: 'p', text: `**Objet :** ${doc.objet || ''}` },
    ]

    if (doc.synthese?.actif && doc.synthese.lignes?.length) {
      blocks.push({ t: 'p', text: doc.synthese.intro || 'Ci-après la synthèse des avis émis dans le cadre des missions confiées :' })
      blocks.push({
        t: 'table',
        style: 'grid',
        head: ['Date', 'Site', 'Demandeur', 'Fait', 'Commentaire'],
        widths: [14, 26, 22, 10, 28],
        align: ['center', 'center', 'center', 'center', 'center'],
        rows: doc.synthese.lignes.map((r) => [frDate(r.date) || r.date, r.site, r.demandeur, r.fait || 'Oui', r.commentaire]),
        size: 'small',
      })
    }

    blocks.push(
      { t: 'p', text: 'Vous trouverez ci-dessous le tableau de prix.' },
      {
        t: 'table',
        style: 'grid',
        head: ['Désignation', 'Unité', 'Quantité', 'Prix unitaire € HT', 'Total € HT'],
        widths: [43, 13, 12, 15, 17],
        align: ['left', 'center', 'center', 'right', 'right'],
        rows,
        foot: [
          ...foot,
          [{ text: '**Total HT**', span: 4 }, { text: `**${money(t.ht)}**`, align: 'right' }],
          [{ text: 'TVA', span: 4 }, { text: money(0), align: 'right' }],
          [{ text: '**Total à payer**', span: 4 }, { text: `**${money(t.ttc)} €**`, align: 'right' }],
        ],
      },
      { t: 'p', text: `**Conditions de paiement :** ${doc.conditionsPaiement || L.conditionsFacture(c.type, echeance)}` },
      { t: 'p', text: `**Mention TVA :** ${p.documents.tva}.` },
      { t: 'p', text: "**Nature de l'opération :** prestation de services." },
    )
    if (refs.length) blocks.push({ t: 'p', text: `**Références :** ${refs.join(' ; ')}.` })
    if (doc.notes) blocks.push({ t: 'p', text: doc.notes })
    if (doc.statut === 'payée' && doc.datePaiement) blocks.push({ t: 'p', text: `**Facture acquittée le ${frDate(doc.datePaiement)}.**` })

    blocks.push(
      { t: 'p', text: `Fait à ${p.documents.lieu}, le ${frDate(doc.dateEmission)}.`, keepNext: true },
      { t: 'p', text: i.signataire, space: 'tight', keepNext: true },
      { t: 'p', text: i.marque, keepNext: Boolean(p.signature) },
      ...(p.signature ? [{ t: 'sign', ...p.signature }] : []),
      { t: 'title', text: 'Coordonnées bancaires / RIB', small: true, keepNext: true },
      {
        t: 'table',
        style: 'grid',
        widths: [32, 68],
        rows: [
          ['**Titulaire du compte**', b.titulaire || i.nom],
          ['**Banque**', b.banque || '…'],
          ['**IBAN**', b.iban || '… (à renseigner dans Paramètres)'],
          ['**BIC / SWIFT**', b.bic || '…'],
          ['**Référence à rappeler**', `Facture n° ${doc.numero}`],
        ],
      },
      { t: 'p', text: '**Merci d’indiquer la référence de facture lors du virement afin de faciliter le rapprochement comptable.**' },
    )

    return {
      title: `Facture ${doc.numero}`,
      fileName: L.safeName(`Facture_${doc.numero}`),
      accent: p.documents.couleur,
      footer: piedDePage(p),
      blocks,
    }
  }

  // ---------- Avis sommaire ----------

  function phraseAvis(doc) {
    const modele = L.MODELES_AVIS[doc.modele] || L.MODELES_AVIS.libre
    const sens = L.SENS_AVIS[doc.sens] || L.SENS_AVIS.favorable
    return `Au regard des éléments disponibles à la date du présent avis, le site proposé ${sens.phrase} pour ${doc.objetCourt || modele.objetCourt}.`
  }

  function avis(doc, p) {
    const i = p.identite
    const sources = (doc.documents || []).filter((d) => d.coche && d.label)
    const blocks = [
      ...enteteLogo(p),
      { t: 'h', text: doc.titre || "Avis sommaire d'urgence hydrogéologique" },
      { t: 'p', text: `**Objet :** ${doc.objet || ''}` },
      { t: 'h', text: 'Identification de la demande' },
      {
        t: 'table',
        style: 'grid',
        head: ['Élément', 'Informations'],
        widths: [36, 64],
        rows: (doc.demande || []).filter((r) => r.label).map((r) => [r.label, r.valeur || '']),
      },
      { t: 'h', text: "Cadre et limites de l'avis" },
      { t: 'p', text: doc.cadre || '' },
    ]
    if (!doc.visite && String(doc.limites || '').trim()) {
      blocks.push({ t: 'p', text: 'En l’absence de visite sur site, les limitations suivantes s’appliquent :' })
      blocks.push({ t: 'ul', items: bulletsFromText(doc.limites) })
    }
    blocks.push(
      { t: 'h', text: 'Documents et informations consultés' },
      { t: 'ul', items: sources.map((s) => ({ text: s.url ? `${s.label} : ${s.url}` : `${s.label}.` })) },
      { t: 'h', text: "Localisation du site d'étude" },
    )
    if (doc.carte?.src) {
      blocks.push({ t: 'p', text: "Le site d'étude est localisé sur la figure suivante.", keepNext: true })
      blocks.push({ t: 'img', src: doc.carte.src, w: doc.carte.w, h: doc.carte.h, caption: doc.carte.legende || '' })
    }
    const coords = [doc.lieuDit, doc.latitude && doc.longitude ? `coordonnées ${doc.latitude}, ${doc.longitude} (WGS84)` : '']
      .filter(Boolean)
      .join(' — ')
    if (coords) blocks.push({ t: 'p', text: `Localisation : ${coords}.` })
    if (!doc.carte?.src && !coords) blocks.push({ t: 'p', text: 'Localisation à compléter.' })

    blocks.push(
      { t: 'h', text: 'Analyse hydrogéologique sommaire' },
      {
        t: 'p',
        text: 'Le tableau ci-après présente une synthèse des principaux éléments hydrogéologiques examinés pour apprécier la vulnérabilité du site proposé et les risques potentiels pour les eaux souterraines et superficielles.',
        keepNext: true,
      },
      {
        t: 'table',
        style: 'grid',
        head: ['Point examiné', 'Constat', 'Appréciation du risque'],
        widths: [18, 60, 22],
        rows: (doc.analyse || [])
          .filter((r) => r.point && (r.constat || r.risque))
          .map((r) => [r.point, r.constat, [r.risque, r.precision ? `(${r.precision})` : ''].filter(Boolean).join('\n')]),
      },
      { t: 'h', text: 'Prescriptions minimales' },
    )
    const prescriptions = bulletsFromText(doc.prescriptions)
    if (prescriptions.length) {
      blocks.push({ t: 'p', text: 'Voici les prescriptions minimales à respecter :' })
      blocks.push({ t: 'ul', items: prescriptions })
    } else {
      blocks.push({ t: 'p', text: 'Sans objet.' })
    }
    blocks.push(
      { t: 'h', text: "Formulation de l'avis" },
      { t: 'p', text: `**Avis hydrogéologique sommaire :** ${doc.formulation || phraseAvis(doc)}` },
      {
        t: 'p',
        text: `**Réserves et conditions impératives :** ${doc.reserves || 'Cf. prescriptions présentées en section précédente.'}`,
      },
      { t: 'h', text: 'Conclusion opérationnelle' },
      ...String(doc.conclusion || '')
        .split('\n')
        .filter((x) => x.trim())
        .map((x) => ({ t: 'p', text: x })),
      { t: 'h', text: 'Signature', keepNext: true },
      { t: 'p', text: `Fait à ${doc.lieu || p.documents.lieu}, le ${frDate(doc.date)}.`, keepNext: true },
      { t: 'p', text: `Nom du rédacteur : ${doc.redacteur || i.signataire}`, keepNext: true },
      { t: 'p', text: 'Signature :', keepNext: Boolean(p.signature) },
      ...(p.signature ? [{ t: 'sign', ...p.signature }] : []),
    )

    const site = doc.site || (doc.demande || []).find((r) => /site|exploitation/i.test(r.label))?.valeur || ''
    return {
      title: `Avis ${site}`.trim(),
      fileName: L.safeName(`Avis_${site || doc.numero}`),
      accent: p.documents.couleur,
      footer: piedDePage(p),
      blocks,
    }
  }

  /** Site / exploitation de l'avis (pour la synthèse de facturation). */
  function siteAvis(doc) {
    return (doc.demande || []).find((r) => /site|exploitation/i.test(r.label))?.valeur || ''
  }
  function demandeurAvis(doc) {
    return (doc.demande || []).find((r) => /^demandeur/i.test(r.label))?.valeur || ''
  }

  // ---------- Numérotation ----------

  /**
   * Numéro du type AAAAMMJJ (comme les documents existants), complété par
   * « -2 », « -3 »… si un document du même jour existe déjà. Un suffixe libre
   * (code client) peut être ajouté : 20260713_DDPP50.
   */
  function numeroLibre(dateIso, existants, suffixe = '') {
    const base = L.compactDate(dateIso) + (suffixe ? `_${L.safeName(suffixe).toUpperCase()}` : '')
    const pris = new Set(existants)
    if (!pris.has(base)) return base
    let n = 2
    while (pris.has(`${base}-${n}`)) n++
    return `${base}-${n}`
  }

  Object.assign(L, {
    totaux,
    sectionsDepuisCatalogue,
    fusionnerPuces,
    ponctuer,
    construire: { devis, facture, avis },
    phraseAvis,
    siteAvis,
    demandeurAvis,
    numeroLibre,
    piedDePage,
  })
})()
