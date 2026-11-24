/** Étiquette QR téléchargeable : QR code + immatriculation + mention d'usage. */

export type StickerLang = 'fr' | 'mg'

const stickerText = {
  fr: {
    loadError: 'Le QR code ne peut pas être exporté.',
    exportError: 'Export de l’image impossible.',
    caption: 'Scannez pour consulter la fiche',
  },
  mg: {
    loadError: 'Tsy afaka avoaka ny QR code.',
    exportError: 'Tsy afaka avoaka ny sary.',
    caption: 'Scantéo hijery ny fiche',
  },
} as const

function loadImage(source: string, message: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(message))
    image.src = source
  })
}

export async function stickerBlob(qrImage: string, registration: string, lang: StickerLang = 'fr'): Promise<Blob> {
  const text = stickerText[lang]
  const image = await loadImage(qrImage, text.loadError)
  const width = 260
  const height = 320
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error(text.exportError)

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 40, 20, 180, 180)

  context.textAlign = 'right'
  context.fillStyle = '#111111'
  let size = 34
  do {
    context.font = `bold ${size}px "Segoe UI", Arial, sans-serif`
    size -= 2
  } while (context.measureText(registration).width > 210 && size > 12)
  context.fillText(registration, width - 20, 248)

  context.textAlign = 'center'
  context.font = '15px "Segoe UI", Arial, sans-serif'
  context.fillStyle = '#555555'
  context.fillText(text.caption, width / 2, 285)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(text.exportError))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function stickerFilename(registration: string): string {
  return `QR_${registration.replace(/[^\w-]+/g, '_')}.png`
}
