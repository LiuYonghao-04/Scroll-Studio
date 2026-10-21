import { createNode, newDocument, parseDocument } from './document'
import { createBlock, presetFrames } from './presets'
import type { PageNode } from '../types/editor'

function heading(section: PageNode, title: string) {
  const node = section.children.find((child) => child.kind === 'heading')!
  node.content = title
  return node
}
export function createShowcase(kind: 'studio' | 'launch') {
  const doc = newDocument()
  const hero = createBlock('hero'),
    features = createBlock('features'),
    detail = createBlock('image-text'),
    end = createBlock('cta')
  doc.name = kind === 'studio' ? '创意工作室' : '新品发布页'
  hero.name = '01 / 开场'
  features.name = '02 / 特点'
  detail.name = '03 / 故事'
  end.name = '04 / 联系'
  hero.style.minHeight = 650
  hero.responsive.mobile.minHeight = 480
  hero.style.justify = 'center'
  hero.children[0]!.content =
    kind === 'studio' ? 'OFFSET / INDEPENDENT CREATIVE STUDIO' : 'PAPER / A QUIETER WAY TO CREATE'
  const title = heading(
    hero,
    kind === 'studio' ? '用设计，\n让好的想法被看见。' : '少一点噪声，\n多一点创作。',
  )
  title.style.fontSize = 72
  title.style.maxWidth = 900
  title.responsive.tablet.fontSize = 56
  title.responsive.mobile.fontSize = 40
  title.animation.keyframes = presetFrames('rise')
  hero.children[2]!.content =
    kind === 'studio'
      ? '我们为独立品牌塑造清晰的视觉语言，从一个标志，到一段完整的数字体验。'
      : '纸间，一本懂得留白的数字手记。记录想法，整理灵感，让每一天都有自己的节奏。'
  hero.children[3]!.content = kind === 'studio' ? '认识我们的工作 ↓' : '探索纸间 ↓'
  hero.children[3]!.href = `#${features.id}`
  const labels =
    kind === 'studio' ? ['品牌识别', '数字体验', '动态叙事'] : ['即时记录', '自由整理', '专注回看']
  features.children.forEach((card, index) => {
    heading(card, labels[index]!)
    card.children[2]!.content =
      kind === 'studio'
        ? [
            '从品牌的真实特质出发，建立可持续使用的视觉系统。',
            '将复杂信息化为清晰的路径，让每一次交互自然发生。',
            '以时间与滚动为线索，让内容拥有恰好的节奏。',
          ][index]!
        : [
            '捕捉转瞬即逝的想法，让记录成为随手的习惯。',
            '用自己的方式组织内容，不让工具限制思考。',
            '在安静的空间里，重新发现过去留下的线索。',
          ][index]!
    card.animation.enabled = true
    card.animation.keyframes = presetFrames('rise')
  })
  const copy = detail.children[1]!
  heading(
    copy,
    kind === 'studio' ? '从细节开始，\n走向完整的表达。' : '给想法空间，\n让灵感慢慢生长。',
  )
  copy.children[1]!.content =
    '这是一份可编辑的示例。替换图片与文案，调整断点样式和动画，让它成为你自己的作品。'
  detail.children[0]!.animation.enabled = true
  detail.children[0]!.animation.keyframes = presetFrames('zoom')
  const endTitle = heading(
    end,
    kind === 'studio' ? '下一次合作，\n从一封信开始。' : '把下一段灵感，\n写在这里。',
  )
  endTitle.animation.enabled = true
  end.children[2]!.content = '回到开头 ↑'
  end.children[2]!.href = `#${hero.id}`
  if (kind === 'launch') {
    hero.style.background = '#f2e8d7'
    features.style.background = '#faf6ef'
    end.style.background = '#e7d8bd'
    title.animation.mode = 'sequence'
    title.animation.duration = 1.1
    const eyebrow = hero.children[0]!
    eyebrow.animation.enabled = true
    eyebrow.animation.mode = 'sequence'
    eyebrow.animation.keyframes = presetFrames('fade')
    eyebrow.animation.start = 0.2
    doc.timeline.scrub = false
  }
  const note = createNode('text')
  note.content = '示例模板 · 图片与文案均可替换'
  note.style.fontSize = 12
  end.children.push(note)
  doc.nodes = [hero, features, detail, end]
  return parseDocument(doc)
}
