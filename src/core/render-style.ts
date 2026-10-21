import type { CSSProperties } from 'vue'
import type { Device, NodeStyle, PageNode } from '../types/editor'
import { resolveStyle } from './responsive'

const fonts = {
  sans: '"DM Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Songti SC", serif',
  mono: '"Courier New", monospace',
}
export function nodeStyle(node: PageNode, device: Device, horizontal = false): CSSProperties {
  const value = resolveStyle(node, device)
  return {
    color: value.color,
    background: value.background,
    fontSize: `${value.fontSize}px`,
    fontFamily: fonts[value.fontFamily],
    fontWeight: value.fontWeight,
    lineHeight: value.lineHeight,
    padding: `${value.padding}px`,
    margin: `${value.margin}px`,
    borderRadius: `${value.radius}px`,
    border: `${value.borderWidth}px ${value.borderStyle} ${value.borderColor}`,
    width: value.width
      ? `${value.width}${value.widthUnit}`
      : node.kind === 'button'
        ? 'fit-content'
        : 'auto',
    maxWidth: value.maxWidth ? `min(100%, ${value.maxWidth}px)` : '100%',
    height: value.height ? `${value.height}px` : 'auto',
    minHeight: value.minHeight ? `${value.minHeight}px` : undefined,
    flex: horizontal && !value.width ? '1 1 0' : '0 1 auto',
    textAlign: value.align,
    ...(node.kind === 'section'
      ? {
          display: 'flex',
          flexDirection: value.layout,
          flexWrap: value.wrap ? 'wrap' : 'nowrap',
          justifyContent: value.justify,
          gap: `${value.gap}px`,
          alignItems:
            value.layout === 'row'
              ? 'stretch'
              : value.align === 'center'
                ? 'center'
                : value.align === 'right'
                  ? 'flex-end'
                  : 'stretch',
        }
      : {}),
  }
}
export function imageStyle(style: NodeStyle): CSSProperties {
  return { height: style.height ? '100%' : 'auto', objectFit: style.objectFit }
}
