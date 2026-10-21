import type { Device, NodeKind, NodeStyle, PageNode } from '../types/editor'

export function extraStyle(
  kind: NodeKind,
): Pick<
  NodeStyle,
  | 'width'
  | 'widthUnit'
  | 'maxWidth'
  | 'height'
  | 'minHeight'
  | 'borderWidth'
  | 'borderColor'
  | 'borderStyle'
  | 'fontWeight'
  | 'lineHeight'
  | 'justify'
  | 'wrap'
  | 'objectFit'
> {
  return {
    width: 0,
    widthUnit: 'px',
    maxWidth: 0,
    height: 0,
    minHeight: 0,
    borderWidth: 0,
    borderColor: '#dfe3d9',
    borderStyle: 'solid',
    fontWeight: kind === 'heading' ? 600 : 400,
    lineHeight: kind === 'heading' ? 1.35 : 1.6,
    justify: 'flex-start',
    wrap: false,
    objectFit: 'cover',
  }
}
export function mobileDefaults(kind: NodeKind, style: NodeStyle): Partial<NodeStyle> {
  return {
    ...(kind === 'heading' ? { fontSize: Math.min(style.fontSize, 36) } : {}),
    ...(kind === 'section'
      ? {
          layout: 'column' as const,
          padding: Math.min(style.padding, 24),
          gap: Math.min(style.gap, 24),
        }
      : {}),
  }
}
export function resolveStyle(node: PageNode, device: Device): NodeStyle {
  return {
    ...node.style,
    ...(device !== 'desktop' ? node.responsive.tablet : {}),
    ...(device === 'mobile' ? node.responsive.mobile : {}),
  }
}
export function deviceForWidth(width: number): Device {
  return width <= 600 ? 'mobile' : width <= 900 ? 'tablet' : 'desktop'
}
const numericLimits: Partial<Record<keyof NodeStyle, [number, number]>> = {
  fontSize: [8, 160],
  padding: [0, 160],
  margin: [0, 160],
  radius: [0, 160],
  gap: [0, 160],
  width: [0, 2400],
  maxWidth: [0, 2400],
  height: [0, 2400],
  minHeight: [0, 2400],
  borderWidth: [0, 20],
  fontWeight: [100, 900],
  lineHeight: [1, 3],
}
const enums: Partial<Record<keyof NodeStyle, readonly string[]>> = {
  fontFamily: ['sans', 'serif', 'mono'],
  align: ['left', 'center', 'right'],
  layout: ['row', 'column'],
  widthUnit: ['px', '%'],
  borderStyle: ['solid', 'dashed', 'dotted'],
  justify: ['flex-start', 'center', 'flex-end', 'space-between'],
  objectFit: ['cover', 'contain'],
}
export function validStyle(input: unknown, partial = false): boolean {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false
  const data = input as Record<string, unknown>
  const keys = [
    ...Object.keys(numericLimits),
    ...Object.keys(enums),
    'color',
    'background',
    'borderColor',
    'wrap',
  ]
  if (!partial && keys.some((key) => !(key in data))) return false
  return (
    Object.entries(data).every(([key, value]) => {
      if (!keys.includes(key)) return false
      const limits = numericLimits[key as keyof NodeStyle]
      if (limits)
        return (
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= limits[0] &&
          value <= limits[1]
        )
      const options = enums[key as keyof NodeStyle]
      if (options) return typeof value === 'string' && options.includes(value)
      if (key === 'wrap') return typeof value === 'boolean'
      return (
        typeof value === 'string' &&
        (/^#[0-9a-f]{6}$/i.test(value) || (key === 'background' && value === 'transparent'))
      )
    }) && !(data.widthUnit === '%' && typeof data.width === 'number' && data.width > 100)
  )
}
