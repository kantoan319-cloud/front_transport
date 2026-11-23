export async function photoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez un fichier image.')
  if (file.size > 12 * 1024 * 1024) throw new Error('Image trop volumineuse : 12 Mo maximum.')
  const bitmap = await createImageBitmap(file)
  try {
    const ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Lecture de l’image indisponible.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    bitmap.close()
  }
}
