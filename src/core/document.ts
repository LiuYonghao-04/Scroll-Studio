import { nodeKinds, type PageDocument, type PageNode, type NodeKind } from '../types/editor'

export const nodeLabels: Record<NodeKind, string> = {
  section: '容器',
  heading: '标题',
  text: '段落',
  image: '图片',
  button: '按钮',
}
export function createNode(kind: NodeKind): PageNode {
  return {
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
    },
    animation: {
      enabled: false,
      y: 48,
      x: 0,
      scale: 1,
      rotation: 0,
      opacity: 0,
      duration: 0.8,
      trigger: 85,
      scrub: false,
    },
    children: [],
  }
}
export function newDocument(starter = false): PageDocument {
  const doc: PageDocument = {
    version: 1,
    id: crypto.randomUUID(),
    name: starter ? '我的第一个灵感' : '未命名页面',
    updatedAt: new Date().toISOString(),
    nodes: [],
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
  return JSON.parse(JSON.stringify(value)) as T
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
  if (clean.startsWith('#') || /^\/(?!\/)/.test(clean)) return clean
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
  const data: unknown = typeof input === 'string' ? JSON.parse(input) : input
  const object = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
  const finite = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  const str = (v: unknown) => typeof v === 'string' && v.length <= 100000
  const color = (v: unknown) => typeof v === 'string' && /^(#[0-9a-f]{6}|transparent)$/i.test(v)
  const ids = new Set<string>()
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
      typeof a.enabled === 'boolean' &&
      typeof a.scrub === 'boolean' &&
      finite(a.x, -500, 500) &&
      finite(a.y, -500, 500) &&
      finite(a.scale, 0.1, 3) &&
      finite(a.rotation, -180, 180) &&
      finite(a.opacity, 0, 1) &&
      finite(a.duration, 0.1, 5) &&
      finite(a.trigger, 10, 100) &&
      Array.isArray(v.children) &&
      (v.kind === 'section' || v.children.length === 0) &&
      v.children.every((c) => validNode(c, depth + 1))
    )
  }
  if (
    !object(data) ||
    data.version !== 1 ||
    !str(data.id) ||
    !str(data.name) ||
    !str(data.updatedAt) ||
    !Array.isArray(data.nodes) ||
    !data.nodes.every((n) => validNode(n, 0))
  )
    throw new Error('页面数据格式无效，或超出了支持的版本与大小。')
  return clone(data as unknown as PageDocument)
}
