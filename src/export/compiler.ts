import type { CSSProperties } from 'vue'
import type { Device, PageDocument, PageNode } from '../types/editor'
import { parseDocument, safeUrl } from '../core/document'
import { resolveStyle } from '../core/responsive'
import { nodeStyle, imageStyle } from '../core/render-style'
import pageCss from './page.css?raw'

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
const cssId = (value: string) =>
  Array.from(value, (char) =>
    /[a-zA-Z0-9_-]/.test(char) ? char : `\\${char.codePointAt(0)!.toString(16)} `,
  ).join('')
export function cssText(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${String(value)}`,
    )
    .join(';')
}
export function compileHtml(input: PageDocument): { html: string; css: string } {
  const doc = parseDocument(input)
  const css: Record<Device, string[]> = { desktop: [], tablet: [], mobile: [] }
  function render(node: PageNode, parent?: PageNode): string {
    for (const device of ['desktop', 'tablet', 'mobile'] as const) {
      const selector = `.page-node[data-node-id="${cssId(node.id)}"]`
      css[device].push(
        `${selector}{${cssText(nodeStyle(node, device, parent?.kind === 'section' && resolveStyle(parent, device).layout === 'row'))}}`,
      )
      if (node.kind === 'image')
        css[device].push(`${selector}>img{${cssText(imageStyle(resolveStyle(node, device)))}}`)
    }
    let content: string
    if (node.kind === 'section')
      content = node.children.map((child) => render(child, node)).join('')
    else if (node.kind === 'heading') content = `<h2>${escapeHtml(node.content)}</h2>`
    else if (node.kind === 'text') content = `<p>${escapeHtml(node.content)}</p>`
    else if (node.kind === 'image') {
      const local = /^\.\/media\/[\w-]+\.(png|jpg|webp)$/.test(node.src) ? node.src : ''
      const source = node.src.startsWith('asset:')
        ? doc.assets.find((asset) => asset.id === node.src.slice(6))?.dataUrl
        : node.src === '/images/landscape.svg'
          ? './images/landscape.svg'
          : local || safeUrl(node.src, true)
      content = `<img src="${escapeHtml(source || './images/landscape.svg')}" alt="${escapeHtml(node.content)}">`
    } else {
      let href = safeUrl(node.href)
      if (href.startsWith('#') && href.length > 1)
        href = `#node-${encodeURIComponent(href.slice(1))}`
      content = `<a href="${escapeHtml(href || '#')}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(node.content)}</a>`
    }
    return `<div id="${escapeHtml(`node-${node.id}`)}" data-node-id="${escapeHtml(node.id)}" class="page-node ${node.kind}">${content}</div>`
  }
  const body = doc.nodes.map((node) => render(node)).join('')
  const payload = JSON.stringify(doc)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return {
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Scroll Studio"><meta name="description" content="${escapeHtml(doc.name)}"><title>${escapeHtml(doc.name)}</title><link rel="stylesheet" href="./styles.css"><script src="./runtime.js" defer></script></head><body><main class="rendered-page">${body}</main><script type="application/json" id="scroll-studio-document">${payload}</script></body></html>`,
    css: `${pageCss}\n${css.desktop.join('\n')}\n@media(max-width:900px){${css.tablet.join('\n')}}\n@media(max-width:600px){${css.mobile.join('\n')}}`,
  }
}
