import { safeUrl } from './document'
import type { MediaAsset } from '../types/editor'

// Keep document image paths portable; resolve bundled assets only when rendering.
export const landscapeSrc = `${import.meta.env.BASE_URL}images/landscape.svg`
export const previewSrc = `${import.meta.env.BASE_URL}#/render`

export function imageSrc(value: string, assets: MediaAsset[] = []): string {
  if (value.startsWith('asset:'))
    return assets.find((asset) => asset.id === value.slice(6))?.dataUrl ?? landscapeSrc
  const source = safeUrl(value, true)
  return !source || source === '/images/landscape.svg' ? landscapeSrc : source
}
