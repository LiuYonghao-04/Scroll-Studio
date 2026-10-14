import {
  animationEases,
  type AnimationConfig,
  type AnimationKeyframe,
  type AnimationPose,
  type PageNode,
  type TimelineConfig,
} from '../types/editor'

export const finalPose: AnimationPose = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
export const defaultTimeline = (): TimelineConfig => ({
  triggerNodeId: null,
  trigger: 85,
  scrollDistance: 1000,
  scrub: true,
})
export function createAnimation(
  initial: AnimationPose = { ...finalPose, y: 48, opacity: 0 },
): AnimationConfig {
  return {
    enabled: false,
    mode: 'individual',
    start: 0,
    duration: 0.8,
    trigger: 85,
    scrub: false,
    keyframes: [
      { id: crypto.randomUUID(), offset: 0, ease: 'none', ...pose(initial) },
      { id: crypto.randomUUID(), offset: 1, ease: 'power2.out', ...finalPose },
    ],
  }
}
export function flattenNodes(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}
export function pose(frame: AnimationPose): AnimationPose {
  return {
    x: frame.x,
    y: frame.y,
    scale: frame.scale,
    rotation: frame.rotation,
    opacity: frame.opacity,
  }
}
export interface MotionSegment {
  at: number
  duration: number
  from: AnimationPose
  to: AnimationPose
  ease: string
}
export interface MotionTrack {
  nodeId: string
  name: string
  start: number
  duration: number
  initial: AnimationPose
  segments: MotionSegment[]
}
export function compileTrack(node: PageNode, start = node.animation.start): MotionTrack {
  const a = node.animation
  return {
    nodeId: node.id,
    name: node.name,
    start,
    duration: a.duration,
    initial: pose(a.keyframes[0]!),
    segments: a.keyframes.slice(1).map((frame, index) => {
      const previous = a.keyframes[index]!
      return {
        at: start + previous.offset * a.duration,
        duration: (frame.offset - previous.offset) * a.duration,
        from: pose(previous),
        to: pose(frame),
        ease: frame.ease,
      }
    }),
  }
}
export function compileSequence(nodes: PageNode[]) {
  const tracks = flattenNodes(nodes)
    .filter((n) => n.animation.enabled && n.animation.mode === 'sequence')
    .map((n) => compileTrack(n))
  return { tracks, duration: Math.max(0, ...tracks.map((t) => t.start + t.duration)) }
}
// Insert into the widest gap, preserving sorted, unique times and both endpoints.
export function insertKeyframe(frames: AnimationKeyframe[]): AnimationKeyframe[] {
  if (frames.length >= 12) return frames
  let index = 0
  for (let i = 1; i < frames.length - 1; i++) {
    if (
      frames[i + 1]!.offset - frames[i]!.offset >
      frames[index + 1]!.offset - frames[index]!.offset
    )
      index = i
  }
  const left = frames[index]!,
    right = frames[index + 1]!
  const offset = Math.round((left.offset + right.offset) * 50) / 100
  if (offset <= left.offset || offset >= right.offset) return frames
  const frame: AnimationKeyframe = {
    ...left,
    id: crypto.randomUUID(),
    offset,
    ease: 'power2.inOut',
  }
  for (const key of ['x', 'y', 'scale', 'rotation', 'opacity'] as const)
    frame[key] = (left[key] + right[key]) / 2
  return [...frames.slice(0, index + 1), frame, ...frames.slice(index + 1)]
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
export function validPose(v: unknown): boolean {
  return (
    object(v) &&
    finite(v.x, -500, 500) &&
    finite(v.y, -500, 500) &&
    finite(v.scale, 0.1, 3) &&
    finite(v.rotation, -180, 180) &&
    finite(v.opacity, 0, 1)
  )
}
export function validAnimation(v: unknown, legacy: boolean): boolean {
  if (
    !object(v) ||
    typeof v.enabled !== 'boolean' ||
    typeof v.scrub !== 'boolean' ||
    !finite(v.duration, 0.1, legacy ? 5 : 10) ||
    !finite(v.trigger, 10, 100)
  )
    return false
  if (legacy) return validPose(v)
  if (
    !['individual', 'sequence'].includes(String(v.mode)) ||
    !finite(v.start, 0, 30) ||
    !Array.isArray(v.keyframes) ||
    v.keyframes.length < 2 ||
    v.keyframes.length > 12
  )
    return false
  const ids = new Set<string>()
  let previous = -1
  return v.keyframes.every((frame: unknown, index: number, frames: unknown[]) => {
    if (
      !object(frame) ||
      typeof frame.id !== 'string' ||
      !frame.id.length ||
      frame.id.length > 80 ||
      ids.has(frame.id) ||
      !validPose(frame) ||
      !finite(frame.offset, 0, 1) ||
      frame.offset <= previous ||
      (index === 0 && frame.offset !== 0) ||
      (index === frames.length - 1 && frame.offset !== 1) ||
      !animationEases.includes(frame.ease as AnimationKeyframe['ease'])
    )
      return false
    ids.add(frame.id)
    previous = frame.offset
    return true
  })
}
export function validTimeline(v: unknown, nodeIds: Set<string>): boolean {
  return (
    object(v) &&
    (v.triggerNodeId === null ||
      (typeof v.triggerNodeId === 'string' && nodeIds.has(v.triggerNodeId))) &&
    finite(v.trigger, 10, 100) &&
    finite(v.scrollDistance, 100, 5000) &&
    typeof v.scrub === 'boolean'
  )
}
