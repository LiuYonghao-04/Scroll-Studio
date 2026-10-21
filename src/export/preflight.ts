import { parseDocument, safeUrl } from '../core/document'
import { flattenNodes } from '../core/motion'
import { resolveStyle } from '../core/responsive'
import type { PageDocument } from '../types/editor'

export interface ExportIssue {
  level: 'error' | 'warning' | 'info'
  message: string
  nodeId?: string
}
export function preflight(input: PageDocument): ExportIssue[] {
  let doc: PageDocument
  try {
    doc = parseDocument(input)
  } catch (error) {
    return [{ level: 'error', message: error instanceof Error ? error.message : '页面数据无效。' }]
  }
  const nodes = flattenNodes(doc.nodes),
    ids = new Set(nodes.map((node) => node.id))
  const issues: ExportIssue[] = []
  if (!nodes.length) issues.push({ level: 'error', message: '页面还是空的，请先添加内容。' })
  for (const node of nodes) {
    const add = (message: string, level: ExportIssue['level'] = 'warning') =>
      issues.push({ level, message: `${node.name}：${message}`, nodeId: node.id })
    if (node.kind === 'image') {
      if (!node.content.trim()) add('建议填写图片描述，便于屏幕阅读器理解。')
      if (!node.src.startsWith('asset:') && node.src !== '/images/landscape.svg') {
        if (!safeUrl(node.src, true) || node.src.startsWith('#'))
          add('图片地址无效，请替换图片。', 'error')
        else add('导出时需要读取此图片；若跨域访问受限，请先上传为本地素材。')
      }
    }
    if (node.kind === 'button') {
      if (!safeUrl(node.href) || node.href === '#') add('尚未设置有效链接。')
      else if (node.href.startsWith('#') && !ids.has(node.href.slice(1)))
        add('目标锚点已经不存在。')
      else if (node.href.startsWith('/')) add('本站绝对链接在新域名下可能指向其他页面。')
    }
    for (const device of ['desktop', 'tablet', 'mobile'] as const) {
      const style = resolveStyle(node, device)
      if (style.height && node.kind !== 'image') {
        add('使用了固定高度，请检查小屏文字是否溢出。')
        break
      }
    }
  }
  issues.push({
    level: 'info',
    message: '导出包使用系统字体回退，不依赖在线字体；不同设备字形可能略有差异。',
  })
  issues.push({
    level: 'info',
    message:
      '动画运行资源将随包附带。GSAP 用途许可说明也会包含在包内，部署成功不代表许可资格已确认。',
  })
  return issues
}
