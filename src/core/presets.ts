import { createNode } from './document'
import { createAnimation, finalPose } from './motion'
import type { AnimationKeyframe, PageNode } from '../types/editor'

export const blockPresets = [
  { id: 'hero', name: '首屏介绍', detail: '标题、说明与行动按钮' },
  { id: 'features', name: '三列特性', detail: '桌面并排，手机自动堆叠' },
  { id: 'image-text', name: '图文介绍', detail: '图片与文字的双栏布局' },
  { id: 'cta', name: '行动邀请', detail: '结尾的联系与转化入口' },
] as const
export type BlockPresetId = (typeof blockPresets)[number]['id']
function text(kind: 'heading' | 'text' | 'button', value: string): PageNode {
  const node = createNode(kind)
  node.content = value
  return node
}
export function createBlock(id: BlockPresetId): PageNode {
  const section = createNode('section')
  section.name = blockPresets.find((preset) => preset.id === id)?.name ?? '区块'
  section.style.gap = 28
  if (id === 'hero') {
    section.children = [
      text('text', 'MAKE SOMETHING THAT MOVES'),
      text('heading', '让每一次滚动，\n都有新的发现。'),
      text('text', '用你的故事、画面与节奏，把一个想法变成值得停留的网页。'),
      text('button', '开始探索 →'),
    ]
    section.children[1]!.animation.enabled = true
  } else if (id === 'features') {
    section.style.layout = 'row'
    section.children = ['自由搭建', '细致编排', '随处呈现'].map((title, index) => {
      const card = createNode('section')
      card.style.padding = 24
      card.style.borderWidth = 1
      card.style.background = '#ffffff'
      card.children = [
        text('text', `0${index + 1}`),
        text('heading', title),
        text('text', '在这里写下这个特点，说明它如何帮助你的用户。'),
      ]
      card.children[1]!.style.fontSize = 28
      card.children[1]!.responsive.mobile.fontSize = 26
      return card
    })
  } else if (id === 'image-text') {
    section.style.layout = 'row'
    const copy = createNode('section')
    copy.style.background = 'transparent'
    copy.style.padding = 24
    copy.children = [
      text('heading', '让画面，\n讲述另一半故事。'),
      text('text', '上传你自己的图片，在桌面并排展示，在手机上自然堆叠。'),
    ]
    copy.children[0]!.style.fontSize = 40
    section.children = [createNode('image'), copy]
    section.children[0]!.style.radius = 12
  } else {
    section.style.background = '#dfead1'
    section.style.align = 'center'
    section.children = [
      text('heading', '下一个故事，由你开始。'),
      text('text', '留下一个清晰的行动邀请，让读者继续与你连接。'),
      text('button', '联系我 →'),
    ]
    section.children[0]!.style.fontSize = 40
  }
  return section
}
export const motionPresets = [
  { id: 'rise', name: '向上浮现' },
  { id: 'fade', name: '柔和淡入' },
  { id: 'turn', name: '旋入' },
  { id: 'slide', name: '侧向滑入' },
  { id: 'zoom', name: '缩放展开' },
  { id: 'parallax', name: '视差穿行' },
] as const
export type MotionPresetId = (typeof motionPresets)[number]['id']
export function presetFrames(id: MotionPresetId): AnimationKeyframe[] {
  const initial = { ...finalPose, opacity: 0 }
  if (id === 'rise') initial.y = 48
  if (id === 'turn') Object.assign(initial, { x: -80, rotation: -12, scale: 0.8 })
  if (id === 'slide') initial.x = -100
  if (id === 'zoom') initial.scale = 0.7
  if (id === 'parallax') Object.assign(initial, { y: 80, opacity: 1 })
  const frames = createAnimation(initial).keyframes
  if (id === 'parallax') {
    frames[1]!.y = -80
    frames[1]!.ease = 'none'
  }
  return frames
}
