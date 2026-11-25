/** Génération des versions PDF des documents imprimables. */

import type { jsPDF } from 'jspdf'

const GREEN: [number, number, number] = [43, 58, 50]
const GOLD: [number, number, number] = [232, 163, 61]
const MUTED: [number, number, number] = [107, 119, 111]
const LINE: [number, number, number] = [224, 220, 208]

export type PdfLang = 'fr' | 'mg'

const pdfText = {
  fr: {
    brand: 'GESTION DE BUS CU/ABE',
    receiptTitle: 'REÇU DE PAIEMENT',
    receiptSubtitle: 'Commune Urbaine d’Antsirabe — Transport urbain',
    issued: 'Émis le',
    type: 'Type de paiement',
    plate: 'Immatriculation du bus',
    owner: 'Nom du propriétaire',
    method: 'Moyen de paiement',
    phone: 'Téléphone',
    external: 'Référence externe',
    status: 'Statut',
    designation: 'DÉSIGNATION',
    amountDetail: 'MONTANT / DÉTAIL',
    total: 'TOTAL',
    paid: 'PAYÉ',
    pending: 'EN ATTENTE',
    validatedBy: 'Validé par {{name}} le {{date}}',
    cashier: 'Signature du caissier',
    client: 'Signature du client',
    notice: 'Ce reçu atteste du paiement enregistré dans la plateforme Gestion de Bus CU/ABE. Conservez-le pour toute réclamation.',
    receiptFooter: 'Reçu {{ref}}',
    registerTitle: 'REGISTRE DES PAIEMENTS',
    registerSubtitle: "Commune Urbaine d'Antsirabe — Gestion de Bus CU/ABE",
    year: 'Année {{year}}',
    month: 'Mois de {{month}}',
    day: 'Journée du {{day}}',
    editedAt: 'Édité le {{date}} à {{time}}',
    operations: 'Opérations : {{count}}',
    collected: 'Encaissé : {{amount}} Ar',
    pendingLabel: 'En attente : {{count}}',
    colDate: 'Date et heure',
    colReference: 'Référence',
    colType: 'Type',
    colPlate: 'Immatriculation',
    colOwner: 'Propriétaire',
    colMethod: 'Moyen',
    colAmount: 'Montant (Ar)',
    colStatus: 'Statut',
    registerFooter: 'Antsirabe · registre édité le {{date}} à {{time}}',
    page: 'Page {{page}}',
  },
  mg: {
    brand: 'FITANTANANA BUS CU/ABE',
    receiptTitle: 'TARATASY FANAMARINANA FANDOAVAM-BOLA',
    receiptSubtitle: 'Tanànan’Antsirabe — Fitaterana an-tanàna',
    issued: 'Navoaka ny',
    type: 'Karazana fandoavam-bola',
    plate: 'Laharan’ny bus',
    owner: 'Anaran’ny tompony',
    method: 'Fomba fandoavana',
    phone: 'Telefaonina',
    external: 'Reference ivelany',
    status: 'Sata',
    designation: 'FANONDROANA',
    amountDetail: 'VOLA / ANTSIPIRIANY',
    total: 'FITAMBARANA',
    paid: 'VOALOA',
    pending: 'MIANDRY',
    validatedBy: 'Noamarina ny {{name}} tamin’ny {{date}}',
    cashier: 'Sonian’ny mpandoa vola',
    client: 'Sonian’ny mpanjifa',
    notice: 'Manamarina ny fandoavam-bola voarakitra ao amin’ny rafitra Fitantanana Bus CU/ABE ity taratasy ity. Tazony raha misy fitarainana.',
    receiptFooter: 'Taratasy {{ref}}',
    registerTitle: 'REJISITRY NY FANDOAVAM-BOLA',
    registerSubtitle: 'Tanànan’Antsirabe — Fitantanana Bus CU/ABE',
    year: 'Taona {{year}}',
    month: 'Volana {{month}}',
    day: 'Andro {{day}}',
    editedAt: 'Navoaka ny {{date}} tamin’ny {{time}}',
    operations: 'Hetsika: {{count}}',
    collected: 'Vola voaray: {{amount}} Ar',
    pendingLabel: 'Miandry: {{count}}',
    colDate: 'Daty sy ora',
    colReference: 'Reference',
    colType: 'Karazana',
    colPlate: 'Laharan’fiara',
    colOwner: 'Tompony',
    colMethod: 'Fomba',
    colAmount: 'Vola (Ar)',
    colStatus: 'Sata',
    registerFooter: 'Antsirabe · rejisitra navoaka ny {{date}} tamin’ny {{time}}',
    page: 'Pejy {{page}}',
  },
} as const

const valueMg: Record<string, string> = {
  Adhésion: 'Fidirana',
  Affectation: 'Fanendrena',
  Vignette: 'Vignette',
  Patente: 'Hetra-tambatra',
  Amende: 'Lamandy',
  Autre: 'Hafa',
  'Espèces': 'Vola eny an-tànana',
  Payé: 'Voaloa',
  Validé: 'Voamarina',
  'En attente': 'Miandry',
  'En cours': 'Eo am-panaovana',
  Résolu: 'Voavaha',
}

const pdfValue = (lang: PdfLang, value: unknown) => {
  const text = value == null || value === '' ? '—' : String(value)
  return lang === 'mg' ? (valueMg[text] ?? text) : text
}

const fill = (template: string, variables: Record<string, string | number>) => {
  let result = template
  for (const [name, replacement] of Object.entries(variables)) {
    result = result.replaceAll(`{{${name}}}`, String(replacement))
  }
  return result
}

const monthNamesMg = ['Janoary', 'Febroary', 'Martsa', 'Aprily', 'Mey', 'Jona', 'Jolay', 'Aogositra', 'Septambra', 'Oktobra', 'Novambra', 'Desambra']
const weekdayNamesMg = ['Alahady', 'Alatsinainy', 'Talata', 'Alarobia', 'Alakamisy', 'Zoma', 'Asabotsy']

async function loadJsPdf() {
  const { jsPDF: JsPdf } = await import('jspdf')
  return JsPdf
}

/** Convertit une image (asset local ou URL) en data URL utilisable par jsPDF. */
export async function imageToDataUrl(source: string): Promise<string | null> {
  try {
    const response = await fetch(source)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Image illisible.'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Rasterise un SVG en PNG : jsPDF ne sait pas dessiner les SVG directement.
 * Le rendu se fait dans le navigateur, sans dependance supplementaire.
 */
export async function vectorToPngDataUrl(
  source: string,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const image = new Image()
    image.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image illisible.'))
      image.src = source
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/** Convertit le logo vectoriel en PNG pret pour jsPDF. */
export async function logoForPdf(source: string): Promise<string | null> {
  // Vite peut livrer l'asset en URL (/src/assets/x.svg, assets/x-123.svg) ou
  // l'inliner en data URL (`data:image/svg+xml;base64,...`). Les deux cas
  // doivent etre rasterises : jsPDF n'accepte pas le SVG dans addImage.
  const isSvg =
    source.startsWith('data:image/svg+xml') || /\.svg(?:[?#]|$)/i.test(source)
  if (isSvg) {
    return vectorToPngDataUrl(source, 1120, 300)
  }
  const dataUrl = await imageToDataUrl(source)
  if (dataUrl?.startsWith('data:image/svg+xml')) {
    return vectorToPngDataUrl(dataUrl, 1120, 300)
  }
  return dataUrl
}

/** Rasterise une image en niveaux de gris (documents noir et blanc). */
export async function grayscaleDataUrl(source: string): Promise<string | null> {
  try {
    const dataUrl = await imageToDataUrl(source)
    if (!dataUrl) return null
    const image = new Image()
    image.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image illisible.'))
      image.src = dataUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || 320
    canvas.height = image.naturalHeight || 320
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const data = pixels.data
    for (let index = 0; index < data.length; index += 4) {
      const gray = Math.round(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2])
      data[index] = gray
      data[index + 1] = gray
      data[index + 2] = gray
    }
    context.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

let communeLogoPromise: Promise<string | null> | null = null

/** Logo de la Commune Urbaine d'Antsirabe, converti en gris pour les PDF. */
export function communeLogo(): Promise<string | null> {
  communeLogoPromise ??= grayscaleDataUrl('/brand/logo-commune.png')
  return communeLogoPromise
}



export async function downloadReceiptPdf(options: {
  width: 58 | 80
  title: string
  subtitle?: string
  logo?: string | null
  rows: { label: string; value: string }[]
  total: { label: string; value: string }
  note?: string
  footer?: string[]
  filename: string
}): Promise<void> {
  const { width, title, subtitle, logo, rows, total, note, footer, filename } = options
  const JsPdf = await loadJsPdf()
  const pageWidth = width
  const margin = width === 58 ? 3 : 5
  const contentWidth = pageWidth - margin * 2
  const doc = new JsPdf({ unit: 'mm', format: [pageWidth, 190], compress: true })
  doc.setFont('helvetica', 'normal')

  let y = margin + 2
  if (logo) {
    try {
      const height = width === 58 ? 12 : 16
      const imageWidth = Math.min(contentWidth, width === 58 ? 30 : 42)
      doc.addImage(logo, 'PNG', (pageWidth - imageWidth) / 2, y, imageWidth, height)
      y += height + 2
    } catch {
      // Le logo est optionnel : le document reste lisible sans lui.
    }
  }

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(width === 58 ? 8.5 : 10.5)
  doc.text(doc.splitTextToSize(title, contentWidth), pageWidth / 2, y, { align: 'center' })
  y += doc.getTextDimensions(doc.splitTextToSize(title, contentWidth)).h + 1
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(width === 58 ? 7 : 8.5)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(subtitle, contentWidth), pageWidth / 2, y, { align: 'center' })
    y += doc.getTextDimensions(doc.splitTextToSize(subtitle, contentWidth)).h + 1
  }

  doc.setDrawColor(...LINE)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, pageWidth - margin, y)
  doc.setLineDashPattern([], 0)
  y += 3

  for (const row of rows) {
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(width === 58 ? 6.8 : 8)
    const labelLines = doc.splitTextToSize(row.label, contentWidth)
    doc.text(labelLines, margin, y)
    y += labelLines.length * (width === 58 ? 3 : 3.6)

    doc.setTextColor(23, 35, 29)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(width === 58 ? 7.6 : 9.2)
    const valueLines = doc.splitTextToSize(row.value || ' ', contentWidth)
    doc.text(valueLines, pageWidth - margin, y, { align: 'right' })
    y += valueLines.length * (width === 58 ? 3.4 : 4.1) + 1.2
  }

  doc.setDrawColor(...LINE)
  doc.line(margin, y, pageWidth - margin, y)
  y += 4

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(width === 58 ? 10 : 12)
  doc.text(total.label, margin, y)
  doc.setTextColor(...GOLD)
  doc.text(total.value, pageWidth - margin, y, { align: 'right' })
  y += width === 58 ? 6 : 7

  if (note) {
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(width === 58 ? 6.6 : 7.8)
    const noteLines = doc.splitTextToSize(note, contentWidth)
    doc.text(noteLines, pageWidth / 2, y, { align: 'center' })
    y += noteLines.length * 3.4 + 2
  }

  if (footer?.length) {
    doc.setDrawColor(...LINE)
    doc.line(margin, y, pageWidth - margin, y)
    y += 3
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(width === 58 ? 6.2 : 7.4)
    for (const line of footer) {
      const lines = doc.splitTextToSize(line, contentWidth)
      doc.text(lines, pageWidth / 2, y, { align: 'center' })
      y += lines.length * 3.2 + 0.8
    }
  }

  doc.save(filename)
}

export async function downloadTablePdf(options: {
  filename: string
  title: string
  subtitle?: string
  summary?: string[]
  headers: string[]
  rows: string[][]
  orientation?: 'portrait' | 'landscape'
  columnStyles?: Record<number, { cellWidth?: number | 'auto' | 'wrap' }>
}): Promise<void> {
  const { filename, title, subtitle, summary, headers, rows, orientation = 'portrait', columnStyles } = options
  const JsPdf = await loadJsPdf()
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation, compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(title, 14, 18)

  let y = 24
  if (subtitle) {
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const lines = doc.splitTextToSize(subtitle, pageWidth - 28)
    doc.text(lines, 14, y)
    y += lines.length * 4.2 + 1
  }
  if (summary?.length) {
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    for (const line of summary) {
      doc.text(line, 14, y)
      y += 4.8
    }
    y += 1
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: y,
    margin: { top: 14, right: 14, bottom: 18, left: 14 },
    styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 2.2, textColor: [36, 48, 41] },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6 },
    alternateRowStyles: { fillColor: [247, 245, 239] },
    columnStyles,
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.6)
      doc.setTextColor(...MUTED)
      doc.text(`Antsirabe · généré le ${new Date().toLocaleString('fr-FR')}`, 14, pageHeight - 9)
      doc.text(`Page ${data.pageNumber}`, pageWidth - 14, pageHeight - 9, { align: 'right' })
    },
  })

  doc.save(filename)
}

export interface PdfSection {
  heading: string
  headers: string[]
  rows: string[][]
}

/** Rapport multi-sections (statistiques, synthèses) avec en-tête et pied de page. */
export async function downloadSectionsPdf(options: {
  filename: string
  title: string
  subtitle?: string
  summary?: string[]
  sections: PdfSection[]
  orientation?: 'portrait' | 'landscape'
  logo?: string | null
}): Promise<void> {
  const { filename, title, subtitle, summary, sections, orientation = 'portrait', logo } = options
  const JsPdf = await loadJsPdf()
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation, compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()

  const logoWidth = 34
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', pageWidth - 14 - logoWidth, 10, logoWidth, logoWidth * (150 / 560))
    } catch {
      // Le logo est optionnel : le rapport reste lisible sans lui.
    }
  }

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(doc.splitTextToSize(title, pageWidth - 28 - (logo ? logoWidth + 6 : 0)), 14, 18)

  let y = 24
  if (subtitle) {
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const lines = doc.splitTextToSize(subtitle, pageWidth - 28)
    doc.text(lines, 14, y)
    y += lines.length * 4.2 + 1
  }
  if (summary?.length) {
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    for (const line of summary) {
      doc.text(line, 14, y)
      y += 4.8
    }
  }

  for (const section of sections) {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (y > pageHeight - 40) {
      doc.addPage()
      y = 18
    }
    doc.setTextColor(...GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(section.heading, 14, y)
    y += 4

    autoTable(doc, {
      head: [section.headers],
      body: section.rows,
      startY: y,
      margin: { top: 14, right: 14, bottom: 18, left: 14 },
      styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 2.2, textColor: [36, 48, 41] },
      headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6 },
      alternateRowStyles: { fillColor: [247, 245, 239] },
      didDrawPage: (data) => {
        const height = doc.internal.pageSize.getHeight()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.6)
        doc.setTextColor(...MUTED)
        doc.text(`Antsirabe · généré le ${new Date().toLocaleString('fr-FR')}`, 14, height - 9)
        doc.text(`Page ${data.pageNumber}`, pageWidth - 14, height - 9, { align: 'right' })
      },
    })
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    y = (finalY ?? y) + 8
  }

  doc.save(filename)
}
export interface ReceiptPayload {
  reference: string
  type: string
  montant: number
  moyen: string
  statut: string
  telephone?: string | null
  referenceExterne?: string | null
  immatriculation?: string | null
  proprietaireNom?: string | null
  createdAt?: string | null
  validatedAt?: string | null
  validatedByName?: string | null
  logo?: string | null
}

const receiptDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

/** Reçu A4 noir et blanc, avec le logo de la commune en niveaux de gris. */
async function buildReceipt(receipt: ReceiptPayload, lang: PdfLang = 'fr') {
  const L = pdfText[lang]
  const JsPdf = await loadJsPdf()
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const left = 16
  const right = pageWidth - 16
  const width = right - left
  const paid = String(receipt.statut).toLowerCase().startsWith('pay') || String(receipt.statut) === 'Validé'

  doc.setDrawColor(0)
  doc.setLineWidth(0.6)
  doc.rect(10, 10, pageWidth - 20, 277)
  doc.setLineWidth(0.2)

  let y = 18
  const logo = receipt.logo ?? (await communeLogo())
  if (logo) {
    try {
      const logoWidth = 17
      const logoHeight = logoWidth * (136 / 108)
      doc.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight)
      y += logoHeight + 1
    } catch {
      // Le logo est optionnel : le reçu reste lisible sans lui.
    }
  }

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(L.brand, pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(70)
  doc.text(L.receiptSubtitle, pageWidth / 2, y, { align: 'center' })

  y += 10
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.line(left, y, right, y)
  y += 7
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(L.receiptTitle, pageWidth / 2, y, { align: 'center' })
  y += 3
  doc.setLineWidth(0.5)
  doc.line(left, y, right, y)
  doc.setLineWidth(0.2)
  y += 8

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60)
  doc.text(`N° ${receipt.reference}`, left, y)
  doc.text(`${L.issued} ${receiptDate(receipt.createdAt)}`, right, y, { align: 'right' })
  y += 8

  const rows: { label: string; value: string; required?: boolean }[] = [
    { label: L.type, value: pdfValue(lang, receipt.type), required: true },
    { label: L.plate, value: pdfValue(lang, receipt.immatriculation) },
    { label: L.owner, value: pdfValue(lang, receipt.proprietaireNom) },
    { label: L.method, value: pdfValue(lang, receipt.moyen), required: true },
    { label: L.phone, value: pdfValue(lang, receipt.telephone) },
    { label: L.external, value: pdfValue(lang, receipt.referenceExterne) },
    { label: L.status, value: pdfValue(lang, receipt.statut), required: true },
  ].filter((row) => row.required || row.value !== '—')

  doc.setDrawColor(0)
  doc.setFillColor(235, 235, 235)
  doc.rect(left, y - 4.5, width, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(L.designation, left + 3, y)
  doc.text(L.amountDetail, right - 3, y, { align: 'right' })
  y += 7.5

  for (const row of rows) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(70)
    doc.setFontSize(9.5)
    doc.text(row.label, left + 3, y)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(row.value, right - 3, y, { align: 'right' })
    y += 2
    doc.setDrawColor(190)
    doc.setLineWidth(0.15)
    doc.line(left, y, right, y)
    doc.setLineWidth(0.2)
    y += 6
  }

  y += 4
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.line(left, y, right, y)
  y += 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(L.total, left + 3, y)
  doc.setFontSize(14)
  doc.text(`${Number(receipt.montant || 0).toLocaleString('fr-FR')} Ar`, right - 3, y, { align: 'right' })
  y += 4
  doc.setLineWidth(0.5)
  doc.line(left, y, right, y)

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  const stamp = paid ? L.paid : (receipt.statut ? pdfValue(lang, receipt.statut).toUpperCase() : L.pending)
  const stampWidth = Math.max(46, doc.getTextWidth(stamp) + 18)
  doc.rect(right - stampWidth, y - 7, stampWidth, 12)
  doc.text(stamp, right - stampWidth / 2, y + 1.5, { align: 'center' })

  if (receipt.validatedByName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(70)
    doc.text(fill(L.validatedBy, { name: receipt.validatedByName, date: receiptDate(receipt.validatedAt) }), left, y - 4)
  }

  y += 30
  doc.setDrawColor(0)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.line(left, y, left + 62, y)
  doc.line(right - 62, y, right, y)
  y += 5
  doc.text(L.cashier, left, y)
  doc.text(L.client, right - 62, y)

  y += 14
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text(
    doc.splitTextToSize(L.notice, width),
    left,
    y,
  )

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(7.5)
  doc.setTextColor(90)
  doc.text(`Antsirabe · ${new Date().toLocaleString('fr-FR')}`, left, pageHeight - 13)
  doc.text(fill(L.receiptFooter, { ref: receipt.reference }), right, pageHeight - 13, { align: 'right' })

  return doc
}

export async function downloadReceiptA4(receipt: ReceiptPayload, filename?: string, lang: PdfLang = 'fr'): Promise<void> {
  const doc = await buildReceipt(receipt, lang)
  doc.save(filename ?? `Recu_${receipt.reference}.pdf`)
}

/** Génère le PDF puis ouvre la boîte d'impression du navigateur. */
export async function printReceipt(receipt: ReceiptPayload, lang: PdfLang = 'fr'): Promise<void> {
  const doc = await buildReceipt(receipt, lang)
  doc.autoPrint()
  const url = String(doc.output('bloburl'))
  const win = window.open(url, '_blank')
  if (!win) window.location.href = url
}

export type RegisterPeriod = 'day' | 'month' | 'year'

export interface RegisterRow {
  id: number | string
  reference: string
  type: string
  montant: number
  moyen: string
  statut: string
  telephone?: string | null
  immatriculation?: string | null
  proprietaireNom?: string | null
  createdAt?: string | null
  validatedAt?: string | null
}

export interface RegisterPayload {
  period: RegisterPeriod
  from: string
  to: string
  rows: RegisterRow[]
  summary: {
    total: number
    montant: number
    payes: number
    montantPaye: number
    enAttente: number
  }
  logo?: string | null
}

const shortDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function registerPeriodLabel(payload: RegisterPayload, lang: PdfLang): string {
  const L = pdfText[lang]
  const from = new Date(payload.from)
  const year = from.getUTCFullYear()
  const month = from.getUTCMonth()
  const day = from.getUTCDate()
  if (lang === 'mg') {
    if (payload.period === 'year') return fill(L.year, { year })
    if (payload.period === 'month') return fill(L.month, { month: `${monthNamesMg[month]} ${year}` })
    return fill(L.day, { day: `${weekdayNamesMg[from.getUTCDay()]} ${day} ${monthNamesMg[month]} ${year}` })
  }
  if (payload.period === 'year') {
    return fill(L.year, { year })
  }
  if (payload.period === 'month') {
    const label = from.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return fill(L.month, { month: label })
  }
  const label = from.toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  return fill(L.day, { day: label })
}

async function buildRegisterPdf(payload: RegisterPayload, lang: PdfLang = 'fr') {
  const L = pdfText[lang]
  const JsPdf = await loadJsPdf()
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const editedAt = new Date()

  const logo = payload.logo ?? (await communeLogo())
  let titleX = margin
  if (logo) {
    try {
      const logoWidth = 16
      doc.addImage(logo, 'PNG', margin, 10, logoWidth, logoWidth * (136 / 108))
      titleX = margin + logoWidth + 5
    } catch {
      // Le logo est optionnel : le registre reste lisible sans lui.
    }
  }

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(L.registerTitle, titleX, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(L.registerSubtitle, titleX, 24)
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(registerPeriodLabel(payload, lang), titleX, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.4)
  doc.setTextColor(...MUTED)
  doc.text(fill(L.editedAt, { date: editedAt.toLocaleDateString('fr-FR'), time: editedAt.toLocaleTimeString('fr-FR') }), pageWidth - margin, 18, { align: 'right' })
  doc.text(fill(L.operations, { count: payload.summary.total }), pageWidth - margin, 23, { align: 'right' })
  doc.text(fill(L.collected, { amount: Number(payload.summary.montantPaye).toLocaleString('fr-FR') }), pageWidth - margin, 28, { align: 'right' })
  doc.text(fill(L.pendingLabel, { count: payload.summary.enAttente }), pageWidth - margin, 33, { align: 'right' })

  doc.setDrawColor(...LINE)
  doc.line(margin, 36, pageWidth - margin, 36)

  autoTable(doc, {
    head: [[
      L.colDate, L.colReference, L.colType, L.colPlate, L.colOwner,
      L.colMethod, L.colAmount, L.colStatus,
    ]],
    body: payload.rows.map((row) => [
      shortDateTime(row.createdAt),
      row.reference ?? '—',
      pdfValue(lang, row.type),
      row.immatriculation ?? '—',
      row.proprietaireNom ?? '—',
      pdfValue(lang, row.moyen),
      Number(row.montant ?? 0).toLocaleString('fr-FR'),
      pdfValue(lang, row.statut),
    ]),
    startY: 40,
    margin: { top: 14, right: margin, bottom: 18, left: margin },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: [36, 48, 41] },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.2 },
    alternateRowStyles: { fillColor: [246, 244, 238] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 42 },
      3: { cellWidth: 25 },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24 },
    },
    foot: [[
      '', '', '', '', L.total, '',
      Number(payload.summary.montant).toLocaleString('fr-FR'), '',
    ]],
    footStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
    didDrawPage: (data) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.4)
      doc.setTextColor(...MUTED)
      doc.text(
        fill(L.registerFooter, { date: editedAt.toLocaleDateString('fr-FR'), time: editedAt.toLocaleTimeString('fr-FR') }),
        margin,
        pageHeight - 8,
      )
      doc.text(fill(L.page, { page: data.pageNumber }), pageWidth - margin, pageHeight - 8, { align: 'right' })
    },
  })

  return doc
}

export async function downloadRegisterPdf(payload: RegisterPayload, lang: PdfLang = 'fr'): Promise<void> {
  const doc = await buildRegisterPdf(payload, lang)
  doc.save(`Registre_paiements_${payload.period}_${payload.from.slice(0, 10)}.pdf`)
}

export async function printRegisterPdf(payload: RegisterPayload, lang: PdfLang = 'fr'): Promise<void> {
  const doc = await buildRegisterPdf(payload, lang)
  doc.autoPrint()
  const url = String(doc.output('bloburl'))
  const win = window.open(url, '_blank')
  if (!win) window.location.href = url
}

export async function downloadQrSheetPdf(items: { registration: string; image: string }[], filename = 'QR_codes_A4.pdf'): Promise<void> {  if (!items.length) throw new Error('Aucun QR code à exporter.')
  const JsPdf = await loadJsPdf()
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 9
  const gap = 4
  // 4 etiquettes par page A4 (2 x 2), numero du vehicule en bas a droite.
  const columns = 2
  const rowsPerPage = 2
  const cellWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns
  const cellHeight = (pageHeight - margin * 2 - gap * (rowsPerPage - 1)) / rowsPerPage
  const perPage = columns * rowsPerPage

  items.forEach((item, index) => {
    if (index > 0 && index % perPage === 0) doc.addPage()
    const position = index % perPage
    const column = position % columns
    const row = Math.floor(position / columns)
    const x = margin + column * (cellWidth + gap)
    const y = margin + row * (cellHeight + gap)

    doc.setDrawColor(190, 190, 190)
    doc.setLineDashPattern([1.2, 1.2], 0)
    doc.roundedRect(x, y, cellWidth, cellHeight, 2, 2)
    doc.setLineDashPattern([], 0)

    const qrSize = Math.min(cellWidth - 20, cellHeight - 26, 88)
    const qrX = x + (cellWidth - qrSize) / 2
    const qrY = y + 6
    try {
      doc.addImage(item.image, 'PNG', qrX, qrY, qrSize, qrSize)
    } catch {
      // Une image invalide est ignorée sans bloquer la feuille.
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...GREEN)
    doc.text(item.registration, x + cellWidth - 3, y + cellHeight - 3.5, { align: 'right' })
  })

  doc.save(filename)
}
