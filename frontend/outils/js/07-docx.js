/*
 * Outils internes LYZa — export Word (.docx) sans bibliothèque.
 *
 * Un .docx est une archive ZIP de fichiers XML (WordprocessingML). Ce module
 * écrit ces fichiers à partir des mêmes blocs que l'aperçu, puis les assemble
 * dans une archive non compressée (méthode « stored », lue par Word,
 * LibreOffice et Google Docs).
 */
;(() => {
  const L = window.LYZA

  // ---------- ZIP (méthode stored) ----------

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()

  function crc32(bytes) {
    let c = 0xffffffff
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }

  function zip(files) {
    const enc = new TextEncoder()
    const now = new Date()
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
    const chunks = []
    const central = []
    let offset = 0
    for (const f of files) {
      const name = enc.encode(f.name)
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data
      const crc = crc32(data)
      const local = new DataView(new ArrayBuffer(30))
      local.setUint32(0, 0x04034b50, true)
      local.setUint16(4, 20, true)
      local.setUint16(6, 0x0800, true) // noms en UTF-8
      local.setUint16(8, 0, true) // stored
      local.setUint16(10, dosTime, true)
      local.setUint16(12, dosDate, true)
      local.setUint32(14, crc, true)
      local.setUint32(18, data.length, true)
      local.setUint32(22, data.length, true)
      local.setUint16(26, name.length, true)
      local.setUint16(28, 0, true)
      chunks.push(new Uint8Array(local.buffer), name, data)

      const cd = new DataView(new ArrayBuffer(46))
      cd.setUint32(0, 0x02014b50, true)
      cd.setUint16(4, 20, true)
      cd.setUint16(6, 20, true)
      cd.setUint16(8, 0x0800, true)
      cd.setUint16(10, 0, true)
      cd.setUint16(12, dosTime, true)
      cd.setUint16(14, dosDate, true)
      cd.setUint32(16, crc, true)
      cd.setUint32(20, data.length, true)
      cd.setUint32(24, data.length, true)
      cd.setUint16(28, name.length, true)
      cd.setUint32(42, offset, true)
      central.push(new Uint8Array(cd.buffer), name)
      offset += 30 + name.length + data.length
    }
    const centralSize = central.reduce((s, c) => s + c.length, 0)
    const end = new DataView(new ArrayBuffer(22))
    end.setUint32(0, 0x06054b50, true)
    end.setUint16(8, files.length, true)
    end.setUint16(10, files.length, true)
    end.setUint32(12, centralSize, true)
    end.setUint32(16, offset, true)
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  }

  // ---------- WordprocessingML ----------

  const NS =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

  const PAGE = { w: 11906, h: 16838, top: 1134, bottom: 1134, left: 1134, right: 1418, footer: 400 }
  const CONTENT_W = PAGE.w - PAGE.left - PAGE.right // en twips (1/20 pt)
  const EMU_PER_TWIP = 635
  const EMU_PER_MM = 36000

  function x(text) {
    return String(text ?? '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  class Writer {
    constructor(model) {
      this.model = model
      this.accent = String(model.accent || '#00BF8E').replace('#', '').toUpperCase()
      this.rels = []
      this.media = []
      this.n = 0
      this.drawingId = 1
    }

    rel(type, target, external) {
      const id = `rId${this.rels.length + 10}`
      this.rels.push({ id, type, target, external })
      return id
    }

    async image(src) {
      const { bytes, ext } = await L.imageBytes(src)
      const name = `image${this.media.length + 1}.${ext === 'png' ? 'png' : 'jpeg'}`
      this.media.push({ name, bytes })
      return this.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', `media/${name}`)
    }

    runs(text, { bold = false, size, color, caps = false } = {}) {
      const parts = []
      for (const r of L.runs(text)) {
        const props = [
          r.b || bold ? '<w:b/>' : '',
          caps ? '<w:caps/>' : '',
          r.link ? '<w:color w:val="0563C1"/><w:u w:val="single"/>' : color ? `<w:color w:val="${color}"/>` : '',
          size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : '',
        ].join('')
        const lines = r.text.split('\n')
        const body = lines.map((line, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${x(line)}</w:t>`).join('')
        const run = `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${body}</w:r>`
        if (r.link) {
          const id = this.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', r.link, true)
          parts.push(`<w:hyperlink r:id="${id}">${run}</w:hyperlink>`)
        } else {
          parts.push(run)
        }
      }
      return parts.join('')
    }

    para(text, { style, align, after, before, keepNext, keepLines, bold, size, color, caps, numId, ilvl } = {}) {
      const ppr = [
        style ? `<w:pStyle w:val="${style}"/>` : '',
        keepNext ? '<w:keepNext/>' : '',
        keepLines ? '<w:keepLines/>' : '',
        numId ? `<w:numPr><w:ilvl w:val="${ilvl || 0}"/><w:numId w:val="${numId}"/></w:numPr>` : '',
        after != null || before != null ? `<w:spacing${before != null ? ` w:before="${before}"` : ''}${after != null ? ` w:after="${after}"` : ''}/>` : '',
        align ? `<w:jc w:val="${align === 'right' ? 'right' : align === 'center' ? 'center' : 'left'}"/>` : '',
      ].join('')
      return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${this.runs(text, { bold, size, color, caps })}</w:p>`
    }

    async drawing(src, wEmu, hEmu) {
      const rid = await this.image(src)
      const id = this.drawingId++
      return (
        `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${id}" name="Image ${id}"/>` +
        `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
      )
    }

    async blocks(list, width) {
      const out = []
      for (const b of list) out.push(await this.block(b, width))
      return out.join('')
    }

    async block(b, width) {
      switch (b.t) {
        case 'logo': {
          const { w, h } = await L.imageSize(this.model.logo)
          const hEmu = 18 * EMU_PER_MM
          const wEmu = Math.round(hEmu * (w / h || 1.8))
          return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr>${await this.drawing(this.model.logo, wEmu, hEmu)}</w:p>`
        }
        case 'title':
          return this.para(b.text, { style: b.small ? 'TitreSection' : 'TitreDoc', keepNext: true })
        case 'h':
          this.n += 1
          return this.para(`${this.n}. ${b.text}`, { style: 'Heading1', keepNext: true })
        case 'p':
          return this.para(b.text, { after: b.space === 'tight' ? 0 : undefined, keepNext: b.keepNext })
        case 'ul':
          return (b.items || [])
            .map((item) => {
              const main = this.para(item.text, { style: 'ListParagraph', numId: 1, ilvl: 0 })
              const subs = (item.sub || []).map((s) => this.para(s, { style: 'ListParagraph', numId: 1, ilvl: 1 })).join('')
              return main + subs
            })
            .join('')
        case 'table':
          return this.table(b, width)
        case 'cols':
          return this.cols(b, width)
        case 'img': {
          const ratio = b.w && b.h ? b.h / b.w : 0.75
          let wEmu = width * EMU_PER_TWIP
          let hEmu = Math.round(wEmu * ratio)
          const maxH = 190 * EMU_PER_MM
          if (hEmu > maxH) {
            hEmu = maxH
            wEmu = Math.round(hEmu / ratio)
          }
          const pic = `<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>${await this.drawing(b.src, Math.round(wEmu), hEmu)}</w:p>`
          return pic + (b.caption ? this.para(b.caption, { style: 'Legende' }) : '')
        }
        case 'sign': {
          const hEmu = 12 * EMU_PER_MM
          const wEmu = Math.round(hEmu * ((b.w && b.h ? b.w / b.h : 2.5) || 2.5))
          return `<w:p>${await this.drawing(b.src, wEmu, hEmu)}</w:p>`
        }
        case 'space':
          return `<w:p><w:pPr><w:spacing w:after="${Math.round((b.mm || 4) * 56.7)}"/></w:pPr></w:p>`
        default:
          return ''
      }
    }

    borders(style) {
      const line = (sz, color = '1C1C1C') => `w:val="single" w:sz="${sz}" w:space="0" w:color="${color}"`
      if (style === 'plain') return '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      if (style === 'box')
        return `<w:tblBorders><w:top ${line(8)}/><w:left ${line(8)}/><w:bottom ${line(8)}/><w:right ${line(8)}/><w:insideH ${line(4, '8A8A8A')}/><w:insideV w:val="nil"/></w:tblBorders>`
      return `<w:tblBorders><w:top ${line(10)}/><w:left ${line(10)}/><w:bottom ${line(10)}/><w:right ${line(10)}/><w:insideH ${line(6)}/><w:insideV ${line(6)}/></w:tblBorders>`
    }

    cellXml(content, widthTw, { span = 1, align, bold, size, shade } = {}) {
      const tcPr = [
        `<w:tcW w:w="${Math.round(widthTw)}" w:type="dxa"/>`,
        span > 1 ? `<w:gridSpan w:val="${span}"/>` : '',
        shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '',
      ].join('')
      const paras = String(content ?? '')
        .split('\n')
        .map((line) => this.para(line, { align, after: 40, bold, size }))
        .join('')
      return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${paras || '<w:p/>'}</w:tc>`
    }

    table(b, width) {
      const widths = (b.widths || (b.head || b.rows[0] || []).map(() => 100 / (b.head || b.rows[0]).length)).map((p) => (p / 100) * width)
      const align = b.align || []
      const size = b.size === 'small' ? 16 : 18
      const grid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join('')}</w:tblGrid>`
      const rows = []
      if (b.head) {
        rows.push(
          `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${b.head
            .map((c, i) => this.cellXml(c, widths[i], { align: b.style === 'plain' ? 'left' : align[i], bold: true, size }))
            .join('')}</w:tr>`,
        )
      }
      for (const row of b.rows || []) {
        rows.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((c, i) => this.cellXml(c, widths[i], { align: align[i], size })).join('')}</w:tr>`)
      }
      for (const row of b.foot || []) {
        let col = 0
        const cells = row.map((c) => {
          const cell = typeof c === 'string' ? { text: c } : c
          const span = cell.span || 1
          const w = widths.slice(col, col + span).reduce((s, v) => s + v, 0)
          col += span
          return this.cellXml(cell.text, w, { span, align: cell.align, size })
        })
        rows.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join('')}</w:tr>`)
      }
      const tblPr = `<w:tblPr><w:tblW w:w="${Math.round(width)}" w:type="dxa"/>${this.borders(b.style)}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>`
      // Paragraphe vide après chaque tableau : Word refuse deux tableaux accolés.
      return `<w:tbl>${tblPr}${grid}${rows.join('')}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`
    }

    async cols(b, width) {
      const widths = b.cols.map((_, i) => ((b.widths?.[i] ?? 100 / b.cols.length) / 100) * width)
      const cells = []
      for (let i = 0; i < b.cols.length; i++) {
        const inner = await this.blocks(b.cols[i], widths[i] - 240)
        cells.push(`<w:tc><w:tcPr><w:tcW w:w="${Math.round(widths[i])}" w:type="dxa"/></w:tcPr>${inner || '<w:p/>'}${inner.endsWith('</w:p>') ? '' : '<w:p/>'}</w:tc>`)
      }
      const tblPr = `<w:tblPr><w:tblW w:w="${Math.round(width)}" w:type="dxa"/>${this.borders('plain')}<w:tblLayout w:type="fixed"/></w:tblPr>`
      const grid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join('')}</w:tblGrid>`
      return `<w:tbl>${tblPr}${grid}<w:tr>${b.keep ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}${cells.join('')}</w:tr></w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`
    }

    styles() {
      const a = this.accent
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana" w:eastAsia="Verdana" w:cs="Verdana"/><w:color w:val="1C1C1C"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="110" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:caps/><w:color w:val="${a}"/><w:spacing w:val="8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TitreDoc"><w:name w:val="Titre du document"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="160" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:caps/><w:color w:val="${a}"/><w:spacing w:val="8"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TitreSection"><w:name w:val="Titre de section"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:caps/><w:color w:val="${a}"/><w:spacing w:val="8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Legende"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="605E5C"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="82887E"/><w:sz w:val="13"/><w:szCs w:val="13"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`
    }

    numbering() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/></w:rPr></w:lvl>
<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1134" w:hanging="283"/></w:pPr><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/></w:rPr></w:lvl>
</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`
    }

    footer() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}>
<w:p><w:pPr><w:pStyle w:val="Footer"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="B7B2AA"/></w:pBdr></w:pPr><w:r><w:t xml:space="preserve">${x(this.model.footer)}</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> / </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>
</w:ftr>`
    }

    async build() {
      const body = await this.blocks(this.model.blocks, CONTENT_W)
      const footerId = this.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', 'footer1.xml')
      const sect = `<w:sectPr><w:footerReference w:type="default" r:id="${footerId}"/><w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/><w:pgMar w:top="${PAGE.top}" w:right="${PAGE.right}" w:bottom="${PAGE.bottom}" w:left="${PAGE.left}" w:header="567" w:footer="${PAGE.footer}" w:gutter="0"/></w:sectPr>`
      const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`

      const docRels = [
        { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
        { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', target: 'numbering.xml' },
        ...this.rels,
      ]
      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRels
        .map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${x(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`)
        .join('')}</Relationships>`

      const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
      const files = [
        {
          name: '[Content_Types].xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
        },
        {
          name: '_rels/.rels',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
        },
        {
          name: 'docProps/core.xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(this.model.title)}</dc:title><dc:creator>LYZa</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
        },
        { name: 'word/document.xml', data: document },
        { name: 'word/styles.xml', data: this.styles() },
        { name: 'word/numbering.xml', data: this.numbering() },
        { name: 'word/footer1.xml', data: this.footer() },
        { name: 'word/_rels/document.xml.rels', data: relsXml },
        ...this.media.map((m) => ({ name: `word/media/${m.name}`, data: m.bytes })),
      ]
      return zip(files)
    }
  }

  /** Produit le .docx d'un modèle de document (voir 05-modele.js). */
  async function docx(model) {
    return new Writer(model).build()
  }

  Object.assign(L, { docx, zip, crc32 })
})()
