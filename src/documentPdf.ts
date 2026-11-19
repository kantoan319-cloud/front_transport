/** Génération des versions PDF des documents imprimables. */

import type { jsPDF } from 'jspdf'

const GREEN: [number, number, number] = [43, 58, 50]
const GOLD: [number, number, number] = [232, 163, 61]
const MUTED: [number, number, number] = [107, 119, 111]
const LINE: [number, number, number] = [224, 220, 208]

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
export async function downloadQrSheetPdf(items: { registration: string; image: string }[], filename = 'QR_codes_A4.pdf'): Promise<void> {
  if (!items.length) throw new Error('Aucun QR code à exporter.')
  const JsPdf = await loadJsPdf()
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 9
  const gap = 4
  const columns = 2
  const rowsPerPage = 3
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

    const qrSize = Math.min(cellWidth - 8, cellHeight - 16, 62)
    const qrX = x + (cellWidth - qrSize) / 2
    const qrY = y + 4
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
