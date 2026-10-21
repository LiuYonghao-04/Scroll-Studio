import type { MediaAsset, PageDocument } from '../types/editor'

export const MAX_MEDIA_BYTES = 8_000_000
export const MAX_IMAGE_BYTES = 2_000_000
export const MAX_DOCUMENT_BYTES = 16_000_000
export function validAsset(input: unknown): input is MediaAsset {
  if (typeof input !== 'object' || input === null) return false
  const asset = input as Record<string, unknown>
  if (
    typeof asset.id !== 'string' ||
    !/^[\w-]{1,100}$/.test(asset.id) ||
    typeof asset.name !== 'string' ||
    asset.name.length > 150 ||
    typeof asset.dataUrl !== 'string' ||
    typeof asset.bytes !== 'number' ||
    !Number.isInteger(asset.bytes) ||
    asset.bytes < 1 ||
    asset.bytes > MAX_IMAGE_BYTES ||
    typeof asset.width !== 'number' ||
    typeof asset.height !== 'number' ||
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    asset.width < 1 ||
    asset.height < 1 ||
    asset.width > 8192 ||
    asset.height > 8192 ||
    asset.width * asset.height > 24_000_000
  )
    return false
  const match = asset.dataUrl.match(/^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || match[1] !== asset.mime || match[3]!.length % 4 !== 0) return false
  const encoded = match[3]!
  if (
    (encoded.length * 3) / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0) !==
    asset.bytes
  )
    return false
  const head = atob(encoded.slice(0, 32))
  return asset.mime === 'image/png'
    ? head.startsWith('\x89PNG\r\n\x1a\n')
    : asset.mime === 'image/jpeg'
      ? head.startsWith('\xff\xd8\xff')
      : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP'
}
export function assetReferences(doc: PageDocument, id: string): number {
  let count = 0
  const visit = (nodes: PageDocument['nodes']) =>
    nodes.forEach((node) => {
      if (node.src === `asset:${id}`) count++
      visit(node.children)
    })
  visit(doc.nodes)
  return count
}
