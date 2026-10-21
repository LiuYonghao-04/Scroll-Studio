import type { MediaAsset } from '../types/editor'
import { MAX_IMAGE_BYTES } from '../core/media'

export async function readImage(file: File): Promise<MediaAsset> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('请选择 PNG、JPEG 或 WebP 图片。暂不接受 SVG 和动图。')
  if (file.size > 8_000_000) throw new Error('原始图片不能超过 8 MB，请先压缩后重试。')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('图片无法解码，请选择有效的图片文件。')
  }
  try {
    if (bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 24_000_000)
      throw new Error('图片尺寸过大，最长边需不超过 8192 px，总像素不超过 2400 万。')
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理图片。')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error('图片压缩失败。'))),
        'image/webp',
        0.88,
      ),
    )
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('处理后的图片仍超过 2 MB，请先缩小后重试。')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('图片读取失败。'))
      reader.onerror = () => reject(new Error('图片读取失败。'))
      reader.readAsDataURL(blob)
    })
    return {
      id: crypto.randomUUID(),
      name: file.name.slice(0, 150),
      mime: blob.type as MediaAsset['mime'],
      dataUrl,
      bytes: blob.size,
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    bitmap.close()
  }
}
