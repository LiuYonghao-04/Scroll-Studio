export const nodeKinds = ['section', 'heading', 'text', 'image', 'button'] as const
export type NodeKind = (typeof nodeKinds)[number]
export type Device = 'desktop' | 'tablet' | 'mobile'
export interface NodeStyle {
  color: string
  background: string
  fontSize: number
  fontFamily: 'sans' | 'serif' | 'mono'
  padding: number
  margin: number
  radius: number
  gap: number
  align: 'left' | 'center' | 'right'
  layout: 'column' | 'row'
}
export interface AnimationPose {
  y: number
  x: number
  scale: number
  rotation: number
  opacity: number
}
export const animationEases = ['none', 'power2.out', 'power2.inOut', 'back.out(1.4)'] as const
export type AnimationEase = (typeof animationEases)[number]
export interface AnimationKeyframe extends AnimationPose {
  id: string
  offset: number
  ease: AnimationEase
}
export interface AnimationConfig {
  enabled: boolean
  mode: 'individual' | 'sequence'
  start: number
  keyframes: AnimationKeyframe[]
  duration: number
  trigger: number
  scrub: boolean
}
export interface PageNode {
  id: string
  kind: NodeKind
  name: string
  content: string
  src: string
  href: string
  style: NodeStyle
  animation: AnimationConfig
  children: PageNode[]
}
export interface PageDocument {
  version: 2
  id: string
  name: string
  updatedAt: string
  nodes: PageNode[]
  timeline: TimelineConfig
}
export interface TimelineConfig {
  triggerNodeId: string | null
  trigger: number
  scrollDistance: number
  scrub: boolean
}
export interface DragPayload {
  kind: 'new' | 'move'
  value: string
}
export const deviceWidths: Record<Device, number> = { desktop: 1120, tablet: 768, mobile: 390 }
