import { clone, createNode, newDocument, parseDocument } from './document'
import { flattenNodes } from './motion'
import type { NodeKind, PageDocument, PageNode } from '../types/editor'
import type { TemplateId } from '../types/project'

export const templates: { id: TemplateId; name: string; subtitle: string; color: string }[] = [
  { id: 'blank', name: '空白画布', subtitle: '从一个想法开始，自由搭建。', color: '#edf0e7' },
  {
    id: 'portfolio',
    name: '个人作品集',
    subtitle: '自我介绍、精选项目与联系入口。',
    color: '#dce7cb',
  },
  { id: 'product', name: '产品介绍', subtitle: '产品主张、功能介绍与行动按钮。', color: '#e9dfd0' },
  { id: 'story', name: '滚动叙事', subtitle: '三个章节，逐步展开你的故事。', color: '#d8e5df' },
]
function content(kind: NodeKind, text: string): PageNode {
  const n = createNode(kind)
  n.content = text
  return n
}
function section(name: string, title: string, text: string, background: string): PageNode {
  const n = createNode('section')
  n.name = name
  n.style.background = background
  n.children = [
    content('text', name.toUpperCase()),
    content('heading', title),
    content('text', text),
  ]
  const heading = n.children[1]!
  heading.animation.enabled = true
  return n
}
export function createTemplate(id: TemplateId): PageDocument {
  const doc = newDocument()
  doc.name = templates.find((t) => t.id === id)?.name ?? '未命名作品'
  if (id === 'blank') return doc
  if (id === 'portfolio') {
    const hero = section(
      '01 / 林序 · 设计与开发',
      '把细小的观察，\n做成有温度的作品。',
      '我关注界面、交互与日常体验。这里记录最近的探索，也欢迎与你一起创造。',
      '#eef2e6',
    )
    hero.children.push(content('button', '看看我的作品 ↓'))
    const work = section(
      '02 / 精选项目',
      '山间来信',
      '一个关于自然、行走与地方记忆的数字体验。你可以在这里介绍项目背景、设计过程与最终成果。',
      '#f4f1e8',
    )
    work.children.push(createNode('image'))
    const contact = section(
      '03 / 保持联系',
      '下一件作品，\n也许与你有关。',
      '正在寻找前端开发与交互设计的合作机会。',
      '#dfead1',
    )
    contact.children.push(content('button', '联系我 →'))
    doc.nodes = [hero, work, contact]
    hero.children[3]!.href = `#${work.id}`
  } else if (id === 'product') {
    const hero = section(
      'FIELD NOTES / 数字手记',
      '为专注留白，\n让灵感落地。',
      '把零散的笔记、素材和想法，整理成属于自己的创作空间。',
      '#f1e9dc',
    )
    hero.children.push(createNode('image'), content('button', '了解产品 ↓'))
    const features = section(
      '01 / 从记录到创作',
      '少一点切换，\n多一点心流。',
      '快速记录、自由组织、随时回看。用自己的节奏，把每个未完成的想法往前推进一步。',
      '#f8f5ee',
    )
    const action = section(
      '02 / 开始你的第一本手记',
      '给下一个想法，\n一个好位置。',
      '在这里填写你的产品优势、联系方式或体验入口。',
      '#dfd9c7',
    )
    action.children.push(content('button', '开始探索 →'))
    doc.nodes = [hero, features, action]
    hero.children[4]!.href = `#${features.id}`
    for (const [index, node] of hero.children.entries()) {
      if (node.kind === 'heading' || node.kind === 'image')
        Object.assign(node.animation, {
          enabled: true,
          mode: 'sequence',
          start: index === 1 ? 0 : 0.4,
          duration: 1.2,
        })
    }
    doc.timeline.scrub = false
  } else {
    const first = section(
      'CHAPTER 01 / 出发',
      '沿着风，\n走向山的另一边。',
      '向下滚动，翻开一段关于风景与时间的旅程。',
      '#e7eee5',
    )
    first.children.push(createNode('image'))
    const second = section(
      'CHAPTER 02 / 停留',
      '真正的风景，\n藏在停下来的时候。',
      '记录沿途的光、声音和那些不经意的相遇。在这里继续讲述你的故事。',
      '#d9e6dc',
    )
    const third = section(
      'CHAPTER 03 / 归来',
      '带走回忆，\n也把故事留下。',
      '每一次出发，都让我们以新的目光看待日常。',
      '#c8d9cd',
    )
    third.children.push(content('button', '回到开头 ↑'))
    third.children[3]!.href = `#${first.id}`
    doc.nodes = [first, second, third]
    for (const n of doc.nodes) {
      n.style.padding = 80
      n.style.gap = 32
      n.children[1]!.animation.scrub = true
    }
  }
  return parseDocument(doc)
}
export function duplicateDocument(original: PageDocument): PageDocument {
  const doc = clone(original),
    mapping = new Map<string, string>()
  doc.id = crypto.randomUUID()
  doc.name = `${original.name} 副本`
  doc.updatedAt = new Date().toISOString()
  for (const node of flattenNodes(doc.nodes)) {
    const id = crypto.randomUUID()
    mapping.set(node.id, id)
    node.id = id
    node.animation.keyframes.forEach((frame) => {
      frame.id = crypto.randomUUID()
    })
  }
  for (const node of flattenNodes(doc.nodes)) {
    if (node.href.startsWith('#') && mapping.has(node.href.slice(1)))
      node.href = `#${mapping.get(node.href.slice(1))}`
  }
  if (doc.timeline.triggerNodeId)
    doc.timeline.triggerNodeId = mapping.get(doc.timeline.triggerNodeId) ?? null
  return parseDocument(doc)
}
