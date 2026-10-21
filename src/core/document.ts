import { nodeKinds, type PageDocument, type PageNode, type NodeKind } from '../types/editor'
import { createAnimation, defaultTimeline, validAnimation, validTimeline } from './motion'
import { extraStyle, mobileDefaults, validStyle } from './responsive'
import { MAX_DOCUMENT_BYTES, MAX_MEDIA_BYTES, validAsset } from './media'

export const nodeLabels: Record<NodeKind, string> = {
  section: '容器',
  heading: '标题',
  text: '段落',
  image: '图片',
  button: '按钮',
}
export function createNode(kind: NodeKind): PageNode {
  const node: PageNode = {
    id: crypto.randomUUID(),
    kind,
    name: nodeLabels[kind],
    content: {
      section: '',
      heading: '让想法，自由生长。',
      text: '每一个值得讲述的故事，都从一个小小的灵感开始。用你的视角，创造不一样的网页。',
      image: '抽象绿色山丘与日光',
      button: '探索更多 →',
    }[kind],
    src: kind === 'image' ? '/images/landscape.svg' : '',
    href: '#',
    style: {
      color: '#26352b',
      background: kind === 'button' ? '#c9ee97' : kind === 'section' ? '#f1f3eb' : 'transparent',
      fontSize: kind === 'heading' ? 56 : 16,
      fontFamily: 'sans',
      padding: kind === 'section' ? 48 : kind === 'button' ? 16 : 0,
      margin: 0,
      radius: kind === 'section' ? 0 : 8,
      gap: 24,
      align: 'left',
      layout: 'column',
      ...extraStyle(kind),
    },
    responsive: { tablet: {}, mobile: {} },
    animation: createAnimation(),
    children: [],
  }
  node.responsive.mobile = mobileDefaults(kind, node.style)
  return node
}
export function newDocument(starter = false): PageDocument {
  const doc: PageDocument = {
    version: 3,
    id: crypto.randomUUID(),
    name: starter ? '我的第一个灵感' : '未命名页面',
    updatedAt: new Date().toISOString(),
    nodes: [],
    timeline: defaultTimeline(),
    assets: [],
  }
  if (starter) {
    const section = createNode('section')
    section.name = '首屏 · Hero'
    const eyebrow = createNode('text')
    eyebrow.content = 'INDEPENDENT STUDIO / 2026'
    eyebrow.style.fontSize = 12
    eyebrow.style.fontFamily = 'mono'
    const heading = createNode('heading')
    heading.content = '好的设计，\n让人停下，又向前。'
    const text = createNode('text')
    text.content =
      '这是你的第一张画布。选择一个元素，调整它的样子，\n或者从左侧拖入组件，让下一次滚动更有意思。'
    const button = createNode('button')
    const picture = createNode('image')
    picture.style.radius = 10
    section.children = [eyebrow, heading, text, button, picture]
    doc.nodes = [section]
  }
  return doc
}
export function clone<T>(value: T): T {
  // Documents contain JSON values. Copy structure while retaining immutable image strings.
  if (Array.isArray(value)) return value.map((item: unknown) => clone(item)) as T
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]: [string, unknown]) => [key, clone(item)]),
    ) as T
  return value
}
export function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  )
}
export function findNode(nodes: PageNode[], id: string): PageNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
}
export function findLocation(
  nodes: PageNode[],
  id: string,
): { siblings: PageNode[]; index: number } | undefined {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (node.id === id) return { siblings: nodes, index: i }
    const found = findLocation(node.children, id)
    if (found) return found
  }
}
export function safeUrl(value: string, image = false): string {
  const clean = value.trim()
  // Browsers normalize a leading /\ into //; reject it before accepting local paths.
  if (clean.startsWith('#') || /^\/(?![\\/])/.test(clean)) return clean
  try {
    const url = new URL(clean)
    return ['https:', 'http:', ...(!image ? ['mailto:', 'tel:'] : [])].includes(url.protocol)
      ? clean
      : ''
  } catch {
    return ''
  }
}
// Treat local storage, imports and preview messages as untrusted data.
export function parseDocument(input: unknown): PageDocument {
  if (typeof input === 'string' && new Blob([input]).size > MAX_DOCUMENT_BYTES)
    throw new Error('页面备份不能超过 16 MB。')
  const data: unknown = typeof input === 'string' ? JSON.parse(input) : input
  const object = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
  const finite = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  const str = (v: unknown) => typeof v === 'string' && v.length <= 100000
  const color = (v: unknown) => typeof v === 'string' && /^(#[0-9a-f]{6}|transparent)$/i.test(v)
  const ids = new Set<string>()
  const assetIds = new Set<string>()
  if (object(data) && data.version === 3) {
    if (!Array.isArray(data.assets) || data.assets.length > 20)
      throw new Error('素材数据无效，单个作品最多 20 张本地图片。')
    let bytes = 0
    for (const asset of data.assets) {
      if (!validAsset(asset) || assetIds.has(asset.id))
        throw new Error('图片素材格式无效或存在重复 ID。')
      assetIds.add(asset.id)
      bytes += asset.bytes
    }
    if (bytes > MAX_MEDIA_BYTES) throw new Error('单个作品的本地图片总量不能超过 8 MB。')
  }
  let count = 0
  const validNode = (v: unknown, depth: number): boolean => {
    if (
      !object(v) ||
      depth > 12 ||
      ++count > 500 ||
      !str(v.id) ||
      ids.has(v.id as string) ||
      !nodeKinds.includes(v.kind as NodeKind)
    )
      return false
    ids.add(v.id as string)
    const s = v.style
    const a = v.animation
    return (
      ['name', 'content', 'src', 'href'].every((k) => str(v[k])) &&
      object(s) &&
      object(a) &&
      color(s.color) &&
      color(s.background) &&
      finite(s.fontSize, 8, 160) &&
      finite(s.padding, 0, 160) &&
      finite(s.margin, 0, 160) &&
      finite(s.radius, 0, 160) &&
      finite(s.gap, 0, 160) &&
      ['sans', 'serif', 'mono'].includes(String(s.fontFamily)) &&
      ['left', 'center', 'right'].includes(String(s.align)) &&
      ['row', 'column'].includes(String(s.layout)) &&
      (!(typeof v.src === 'string' && v.src.startsWith('asset:')) ||
        (v.kind === 'image' && assetIds.has(v.src.slice(6)))) &&
      (!(object(data) && data.version === 3) ||
        (validStyle(s) &&
          object(v.responsive) &&
          Object.keys(v.responsive).every((key) => ['tablet', 'mobile'].includes(key)) &&
          validStyle(v.responsive.tablet, true) &&
          validStyle(v.responsive.mobile, true) &&
          validStyle({ ...s, ...(v.responsive.tablet as object) }) &&
          validStyle({
            ...s,
            ...(v.responsive.tablet as object),
            ...(v.responsive.mobile as object),
          }))) &&
      validAnimation(a, object(data) && data.version === 1) &&
      Array.isArray(v.children) &&
      (v.kind === 'section' || v.children.length === 0) &&
      v.children.every((c) => validNode(c, depth + 1))
    )
  }
  if (
    !object(data) ||
    typeof data.version !== 'number' ||
    ![1, 2, 3].includes(data.version) ||
    !str(data.id) ||
    !str(data.name) ||
    !str(data.updatedAt) ||
    !Array.isArray(data.nodes) ||
    !data.nodes.every((n) => validNode(n, 0)) ||
    (data.version !== 1 && !validTimeline(data.timeline, ids))
  )
    throw new Error('页面数据格式无效，或超出了支持的版本与大小。')
  const result = clone(data)
  if (result.version === 1) {
    // Validate the complete v1 tree before migrating a copy; never mutate a stored/imported input.
    const migrate = (nodes: Record<string, unknown>[]) => {
      for (const node of nodes) {
        const old = node.animation as {
          x: number
          y: number
          scale: number
          rotation: number
          opacity: number
          enabled: boolean
          duration: number
          trigger: number
          scrub: boolean
        }
        node.animation = {
          ...createAnimation(old),
          enabled: old.enabled,
          duration: old.duration,
          trigger: old.trigger,
          scrub: old.scrub,
        }
        migrate(node.children as Record<string, unknown>[])
      }
    }
    migrate(result.nodes as Record<string, unknown>[])
    result.version = 2
    result.timeline = defaultTimeline()
  }
  if (result.version === 2) {
    const migrateStyles = (nodes: Record<string, unknown>[]) => {
      for (const node of nodes) {
        const legacy = node.style as Record<string, unknown>
        const base = Object.fromEntries(
          [
            'color',
            'background',
            'fontSize',
            'fontFamily',
            'padding',
            'margin',
            'radius',
            'gap',
            'align',
            'layout',
          ].map((key) => [key, legacy[key]]),
        )
        const style = {
          ...base,
          ...extraStyle(node.kind as NodeKind),
        } as unknown as PageNode['style']
        node.style = style
        node.responsive = { tablet: {}, mobile: mobileDefaults(node.kind as NodeKind, style) }
        migrateStyles(node.children as Record<string, unknown>[])
      }
    }
    migrateStyles(result.nodes as Record<string, unknown>[])
    result.version = 3
    result.assets = []
  }
  const document = result as unknown as PageDocument
  const metadata = JSON.stringify({
    ...document,
    assets: document.assets.map((asset) => ({ ...asset, dataUrl: '' })),
  })
  if (
    new Blob([metadata]).size +
      document.assets.reduce((size, asset) => size + asset.dataUrl.length, 0) >
    MAX_DOCUMENT_BYTES
  )
    throw new Error('页面内容与素材合计不能超过 16 MB，请减少内容或图片后重试。')
  return document
}
