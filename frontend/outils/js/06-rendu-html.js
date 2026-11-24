/*
 * Outils internes LYZa — rendu HTML des documents (aperçu et impression PDF).
 */
;(() => {
  const L = window.LYZA
  const { h, inline } = L

  function cellHtml(text) {
    return String(text ?? '')
      .split('\n')
      .map((line) => inline(line))
      .join('<br>')
  }

  function renderBlocks(blocks, ctx) {
    const out = []
    for (const b of blocks) out.push(renderBlock(b, ctx))
    return out
  }

  function renderBlock(b, ctx) {
    switch (b.t) {
      case 'logo':
        return h('div', { class: 'doc-logo' }, h('img', { src: ctx.logo, alt: 'LYZa — Environnement, hydrogéologie' }))
      case 'title':
        return h('div', { class: 'doc-title' + (b.small ? ' doc-title--small' : '') + (b.keepNext ? ' keep-next' : '') }, b.text)
      case 'h': {
        ctx.n += 1
        return h('h2', { class: 'doc-h' + (b.keepNext ? ' keep-next' : '') }, h('span', { class: 'doc-h-num' }, `${ctx.n}.`), ' ', b.text)
      }
      case 'p':
        return h('p', {
          class: 'doc-p' + (b.space === 'tight' ? ' doc-p--tight' : '') + (b.keepNext ? ' keep-next' : ''),
          html: inline(b.text),
        })
      case 'ul':
        return h(
          'ul',
          { class: 'doc-ul' },
          (b.items || []).map((item) =>
            h(
              'li',
              { html: inline(item.text) },
              item.sub && item.sub.length ? h('ul', { class: 'doc-ul doc-ul--sub' }, item.sub.map((s) => h('li', { html: inline(s) }))) : null,
            ),
          ),
        )
      case 'table':
        return renderTable(b)
      case 'cols':
        return h(
          'div',
          { class: 'doc-cols' + (b.keep ? ' keep' : '') },
          b.cols.map((col, i) => h('div', { class: 'doc-col', style: { flexBasis: `${b.widths?.[i] ?? 50}%` } }, renderBlocks(col, ctx))),
        )
      case 'img':
        return h(
          'figure',
          { class: 'doc-fig' },
          h('img', { src: b.src, alt: b.caption || 'Figure' }),
          b.caption ? h('figcaption', { html: inline(b.caption) }) : null,
        )
      case 'sign':
        return h('div', { class: 'doc-sign' }, h('img', { src: b.src, alt: 'Signature' }))
      case 'space':
        return h('div', { style: { height: `${b.mm || 4}mm` } })
      default:
        return h('div')
    }
  }

  function renderTable(b) {
    const cols = b.widths || []
    const align = b.align || []
    const table = h('table', { class: `doc-table doc-table--${b.style || 'grid'}` + (b.size === 'small' ? ' doc-table--small' : '') })
    if (cols.length) table.append(h('colgroup', null, cols.map((w) => h('col', { style: { width: `${w}%` } }))))
    if (b.head) {
      table.append(h('thead', null, h('tr', null, b.head.map((c, i) => h('th', { style: { textAlign: b.style === 'plain' ? 'left' : align[i] === 'right' ? 'right' : align[i] || 'left' }, html: cellHtml(c) })))))
    }
    const body = h('tbody')
    for (const row of b.rows || []) {
      body.append(
        h(
          'tr',
          null,
          row.map((c, i) => h('td', { style: { textAlign: align[i] || 'left' }, html: cellHtml(c) })),
        ),
      )
    }
    for (const row of b.foot || []) {
      body.append(
        h(
          'tr',
          { class: 'doc-total' },
          row.map((c) => {
            const cell = typeof c === 'string' ? { text: c } : c
            return h('td', { colSpan: cell.span || 1, style: { textAlign: cell.align || 'left' }, html: cellHtml(cell.text) })
          }),
        ),
      )
    }
    table.append(body)
    return table
  }

  /**
   * Construit la feuille A4 d'un document.
   *
   * Le contenu est placé dans un tableau dont l'en-tête et le pied (vides)
   * se répètent sur chaque page imprimée : ils réservent les marges haute et
   * basse, et le pied de page légal (position fixe) s'imprime dans la marge
   * basse de chaque page. C'est la méthode qui marche à la fois dans Chrome,
   * Edge et Firefox.
   */
  function renderDoc(model, { logo }) {
    const ctx = { n: 0, logo }
    const sheet = h(
      'article',
      { class: 'doc' },
      h(
        'table',
        { class: 'doc-frame', role: 'presentation' },
        h('thead', null, h('tr', null, h('td', null, h('div', { class: 'doc-space-top' })))),
        h('tbody', null, h('tr', null, h('td', null, h('div', { class: 'doc-body' }, renderBlocks(model.blocks, ctx))))),
        h('tfoot', null, h('tr', null, h('td', null, h('div', { class: 'doc-space-bottom' })))),
      ),
      h('footer', { class: 'doc-footer' }, model.footer),
    )
    sheet.style.setProperty('--accent', model.accent || '#00BF8E')
    return sheet
  }

  Object.assign(L, { renderDoc })
})()
