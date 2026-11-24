/*
 * Outils internes LYZa — fonctions utilitaires partagées.
 *
 * Les fichiers de ce dossier sont de simples scripts (pas de module ni de
 * dépendance) : le script de build les concatène dans une seule page, puis la
 * chiffre. Chacun s'enveloppe dans une fonction et publie ce qu'il expose sur
 * l'objet global LYZA.
 */
;(() => {
  const L = (window.LYZA = window.LYZA || {})

  /** Crée un élément DOM : h('div', { class: 'x', onclick: fn }, enfant, ...) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag)
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue
        if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value)
        } else if (key === 'class') {
          el.className = value
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(el.style, value)
        } else if (key === 'html') {
          el.innerHTML = value
        } else if (key in el && typeof value !== 'string') {
          el[key] = value
        } else {
          el.setAttribute(key, value === true ? '' : value)
        }
      }
    }
    appendChildren(el, children)
    return el
  }

  function appendChildren(el, children) {
    for (const child of children.flat(Infinity)) {
      if (child === undefined || child === null || child === false) continue
      el.append(child instanceof Node ? child : document.createTextNode(String(child)))
    }
  }

  /** Remplace le contenu d'un élément (les valeurs nulles sont ignorées). */
  function fill(el, ...children) {
    el.replaceChildren()
    appendChildren(el, children)
    return el
  }

  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  /**
   * Découpe un texte portant un balisage minimal en segments :
   * **gras**, et les adresses http(s) deviennent des liens.
   * Retourne [{ text, b, link }].
   */
  function runs(text) {
    const out = []
    const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g)
    for (const part of parts) {
      if (!part) continue
      const bold = part.startsWith('**') && part.endsWith('**') && part.length > 4
      const body = bold ? part.slice(2, -2) : part
      const pieces = body.split(/(https?:\/\/[^\s<>)]+[^\s<>).,;:!?])/g)
      for (const piece of pieces) {
        if (!piece) continue
        if (/^https?:\/\//.test(piece)) out.push({ text: piece, b: bold, link: piece })
        else out.push({ text: piece, b: bold })
      }
    }
    return out
  }

  /** Convertit le balisage minimal en HTML sûr. */
  function inline(text) {
    return runs(text)
      .map((r) => {
        let s = esc(r.text)
        if (r.link) s = `<a href="${esc(r.link)}">${s}</a>`
        if (r.b) s = `<strong>${s}</strong>`
        return s
      })
      .join('')
  }

  /**
   * Transforme un texte « une puce par ligne » en liste.
   * Une ligne commençant par deux espaces, une tabulation ou « -- » est une
   * sous-puce de la précédente. Les tirets et puces en tête sont ignorés.
   */
  function bulletsFromText(text) {
    const items = []
    for (const raw of String(text ?? '').split('\n')) {
      if (!raw.trim()) continue
      const sub = /^(\s{2,}|\t|\s*--\s)/.test(raw)
      const clean = raw.replace(/^\s*(--|[-•*◦])\s*/, '').trim()
      if (sub && items.length) {
        const parent = items[items.length - 1]
        parent.sub = parent.sub || []
        parent.sub.push(clean)
      } else {
        items.push({ text: clean })
      }
    }
    return items
  }

  function bulletsToText(items) {
    return items
      .map((item) => {
        if (typeof item === 'string') return item
        return [item.text, ...(item.sub || []).map((s) => '  - ' + s)].join('\n')
      })
      .join('\n')
  }

  // ---------- Nombres et dates ----------

  const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  /** 1292 -> "1 292,00" (espace insécable fine remplacée par une espace simple pour Word). */
  function money(value) {
    return nf.format(round2(value)).replace(/ | /g, ' ')
  }
  function euros(value) {
    return money(value) + ' €'
  }
  function qty(value) {
    const n = Number(value) || 0
    return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
  }
  function round2(value) {
    return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100
  }
  function parseNumber(value) {
    if (typeof value === 'number') return value
    const n = parseFloat(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  /** Date du jour au format ISO local AAAA-MM-JJ. */
  function today() {
    const d = new Date()
    return isoDate(d)
  }
  function isoDate(d) {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  function addDays(iso, days) {
    const d = parseIso(iso)
    d.setDate(d.getDate() + Number(days || 0))
    return isoDate(d)
  }
  function parseIso(iso) {
    const [y, m, d] = String(iso || today()).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  /** "2026-07-13" -> "13/07/2026" */
  function frDate(iso) {
    if (!iso) return ''
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso)
  }
  /** "2026-07-13" -> "20260713" */
  function compactDate(iso) {
    return String(iso || today()).replace(/-/g, '').slice(0, 8)
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
  }

  function debounce(fn, ms) {
    let timer
    return (...args) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), ms)
    }
  }

  /** Nom de fichier sûr : accents retirés, espaces en tirets bas. */
  function safeName(text) {
    return String(text ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60)
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob)
    const a = h('a', { href: url, download: name })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  /** Lit un fichier image et le réduit (JPEG pour les photos, PNG si transparence). */
  function readImage(file, { maxSide = 1800, quality = 0.85, keepPng = false } = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error)
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('Image illisible'))
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
          const w = Math.round(img.width * scale)
          const hgt = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = hgt
          const ctx = canvas.getContext('2d')
          const png = keepPng || file.type === 'image/png'
          if (!png) {
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, hgt)
          }
          ctx.drawImage(img, 0, 0, w, hgt)
          const src = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality)
          resolve({ src, w, h: hgt })
        }
        img.src = reader.result
      }
      reader.readAsDataURL(file)
    })
  }

  /** Dimensions naturelles d'une image (data URI ou adresse). */
  function imageSize(src) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = src
    })
  }

  /** Convertit une image (data URI ou adresse relative) en octets PNG/JPEG. */
  async function imageBytes(src) {
    if (src.startsWith('data:')) {
      const [head, data] = src.split(',')
      const bin = atob(data)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { bytes, ext: head.includes('png') ? 'png' : 'jpeg' }
    }
    const res = await fetch(src)
    const buf = new Uint8Array(await res.arrayBuffer())
    return { bytes: buf, ext: /\.png$/i.test(src) ? 'png' : 'jpeg' }
  }

  function toast(message, kind = 'ok') {
    let host = document.getElementById('toasts')
    if (!host) {
      host = h('div', { id: 'toasts', 'aria-live': 'polite' })
      document.body.append(host)
    }
    const el = h('div', { class: `toast toast--${kind}` }, message)
    host.append(el)
    setTimeout(() => el.classList.add('toast--out'), 3200)
    setTimeout(() => el.remove(), 3800)
  }

  Object.assign(L, {
    h,
    fill,
    esc,
    runs,
    inline,
    bulletsFromText,
    bulletsToText,
    money,
    euros,
    qty,
    round2,
    parseNumber,
    today,
    isoDate,
    addDays,
    parseIso,
    frDate,
    compactDate,
    uid,
    clone,
    debounce,
    safeName,
    download,
    readImage,
    imageSize,
    imageBytes,
    toast,
  })
})()
