import type { PageNode } from '../types/editor'
import { flattenNodes } from './motion'
import { safeUrl } from './document'

// Only links within the copied subtree change; links outside it retain their target.
export function rekeyNodes(nodes: PageNode[]): Map<string, string> {
  const mapping = new Map<string, string>()
  const all = flattenNodes(nodes)
  for (const node of all) {
    const id = crypto.randomUUID()
    mapping.set(node.id, id)
    node.id = id
    for (const frame of node.animation.keyframes) frame.id = crypto.randomUUID()
  }
  for (const node of all) {
    const href = safeUrl(node.href)
    const target = href.startsWith('#') ? mapping.get(href.slice(1)) : undefined
    if (target) node.href = `#${target}`
  }
  return mapping
}
