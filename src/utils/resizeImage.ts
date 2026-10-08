// Shrinks a photo before it leaves the phone: at most 1600 px on the long
// side, re-encoded as JPEG. Drawing it onto a canvas drops every EXIF tag,
// including the location, and `from-image` bakes the camera rotation in first.

export const MAX_PHOTO_SIDE = 1600
export const PHOTO_QUALITY = 0.8

/** Target size that keeps the aspect ratio and never enlarges. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
  if (!blob) throw new Error('Could not process the photo')
  return blob
}
