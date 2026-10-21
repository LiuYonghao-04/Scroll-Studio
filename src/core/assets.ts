import { safeUrl } from './document'

// Keep document image paths portable; resolve bundled assets only when rendering.
export const landscapeSrc = `${import.meta.env.BASE_URL}images/landscape.svg`
export const previewSrc = `${import.meta.env.BASE_URL}#/render`

export function imageSrc(value: string): string {
  const source = safeUrl(value, true)
  return !source || source === '/images/landscape.svg' ? landscapeSrc : source
}
