import { flattenNodes } from './motion'
import type { PageDocument } from '../types/editor'
const escape = (s: string) =>
  Array.from(s, (ch) => {
    const code = ch.codePointAt(0) ?? 0
    return code >= 0xd800 && code <= 0xdfff ? '\ufffd' : ch
  })
    .join('')
    .replace(
      /[&<>"']/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch] ?? ch,
    )
// A small layout illustration generated from actual text/colors, not a screenshot service.
export function projectThumbnail(doc: PageDocument): string {
  const nodes = flattenNodes(doc.nodes),
    background = doc.nodes[0]?.style.background
  const heading = nodes.find((n) => n.kind === 'heading')
  const lines = (heading?.content ?? (nodes.length ? doc.name : '空白，也是一个好开始。'))
    .split('\n')
    .slice(0, 3)
  const image = nodes.some((n) => n.kind === 'image')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="${background && background !== 'transparent' ? escape(background) : '#f1f3eb'}"/><text x="40" y="48" font-family="sans-serif" font-size="10" fill="#6c8060">SCROLL STUDIO / ${nodes.length} ELEMENTS</text>${lines.map((line, i) => `<text x="40" y="${104 + i * 40}" font-family="sans-serif" font-size="28" font-weight="600" fill="${escape(heading?.style.color ?? '#26352b')}">${escape(Array.from(line).slice(0, 21).join(''))}</text>`).join('')}<rect x="40" y="${image ? 230 : 260}" width="${image ? 560 : 170}" height="${image ? 130 : 36}" rx="8" fill="#c7d8b6"/>${image ? '<path d="M40 360 Q180 210 330 310 T600 270 V360Z" fill="#8ba879"/>' : ''}<text x="40" y="384" font-family="sans-serif" font-size="9" fill="#789067">布局缩略图</text></svg>`
}
