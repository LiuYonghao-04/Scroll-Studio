import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clone, createNode, newDocument, parseDocument } from '../src/core/document'
import { compileSequence, compileTrack, finalPose, insertKeyframe, pose } from '../src/core/motion'
import { useEditorStore } from '../src/stores/editor'
import { loadDocument, STORAGE_KEY } from '../src/services/storage'
import type { AnimationConfig, AnimationPose, PageNode } from '../src/types/editor'

type LegacyNode = Omit<PageNode, 'animation' | 'children'> & {
  animation: AnimationPose & Pick<AnimationConfig, 'enabled' | 'duration' | 'trigger' | 'scrub'>
  children: LegacyNode[]
}
function legacyDocument() {
  const doc = newDocument(true)
  const convert = (node: PageNode): LegacyNode => ({
    ...node,
    animation: {
      x: -25,
      y: 120,
      scale: 0.8,
      rotation: -10,
      opacity: 0.2,
      enabled: true,
      duration: 1.4,
      trigger: 72,
      scrub: true,
    },
    children: node.children.map(convert),
  })
  return {
    version: 1,
    id: doc.id,
    name: doc.name,
    updatedAt: doc.updatedAt,
    nodes: doc.nodes.map(convert),
  }
}
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})
describe('document version migration', () => {
  it('migrates nested v1 animations without mutating or losing the old draft', () => {
    const old = legacyDocument()
    const raw = JSON.stringify(old)
    localStorage.setItem(STORAGE_KEY, raw)
    const migrated = loadDocument()!
    expect(migrated.version).toBe(2)
    expect(migrated.nodes[0]!.children[1]!.id).toBe(old.nodes[0]!.children[1]!.id)
    const animation = migrated.nodes[0]!.children[1]!.animation
    expect(animation).toMatchObject({
      mode: 'individual',
      enabled: true,
      duration: 1.4,
      trigger: 72,
      scrub: true,
    })
    expect(pose(animation.keyframes[0]!)).toEqual(pose(old.nodes[0]!.children[1]!.animation))
    expect(pose(animation.keyframes[1]!)).toEqual(finalPose)
    expect(JSON.stringify(old)).toBe(raw)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(parseDocument(migrated)).toEqual(migrated)
  })
  it('rejects malformed legacy motion instead of silently manufacturing defaults', () => {
    const legacy = legacyDocument()
    legacy.nodes[0]!.animation.opacity = 10
    expect(() => parseDocument(legacy)).toThrow()
  })
  it('saves an edited migrated document as v2 and restores the same frame IDs', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyDocument()))
    const store = useEditorStore()
    store.restore()
    const node = store.document.nodes[0]!.children[1]!
    store.updateKeyframe(node.id, node.animation.keyframes[0]!.id, { y: 90 })
    expect(store.autosave()).toBe(true)
    expect(loadDocument()).toEqual(store.document)
  })
})
describe('motion compilation and transactions', () => {
  it('compiles unequal keyframe gaps to exact segment timings and target easing', () => {
    const node = createNode('heading')
    node.animation.start = 1.5
    node.animation.duration = 2
    node.animation.keyframes = insertKeyframe(node.animation.keyframes)
    node.animation.keyframes[1]!.offset = 0.25
    node.animation.keyframes[1]!.ease = 'none'
    node.animation.keyframes[1]!.x = 70
    const track = compileTrack(node)
    expect(track.segments.map((s) => [s.at, s.duration, s.ease])).toEqual([
      [1.5, 0.5, 'none'],
      [2, 1.5, 'power2.out'],
    ])
    expect(track.segments[1]!.from.x).toBe(70)
    expect(track.segments[1]!.to).toEqual(finalPose)
  })
  it('includes nested shared tracks and computes duration from the latest ending track', () => {
    const doc = newDocument(true)
    const parent = doc.nodes[0]!,
      first = parent.children[1]!,
      second = parent.children[2]!
    Object.assign(first.animation, { enabled: true, mode: 'sequence', start: 2, duration: 1 })
    Object.assign(second.animation, { enabled: true, mode: 'sequence', start: 0.5, duration: 4 })
    parent.animation.enabled = true // Independent tracks must not affect sequence duration.
    const result = compileSequence(doc.nodes)
    expect(result.tracks.map((t) => t.nodeId)).toEqual([first.id, second.id])
    expect(result.duration).toBe(4.5)
    second.animation.enabled = false
    expect(compileSequence(doc.nodes).duration).toBe(3)
    first.animation.enabled = false
    expect(compileSequence(doc.nodes).duration).toBe(0)
  })
  it('inserts and edits a keyframe as independent undoable actions', () => {
    const store = useEditorStore(),
      node = store.document.nodes[0]!.children[1]!
    store.addKeyframe(node.id)
    const id = store.selectedKeyframeId!
    store.updateKeyframe(node.id, id, { opacity: 0.8, rotation: 12 })
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes[1]!.opacity).toBe(0.8)
    store.undo()
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes[1]!.opacity).toBe(0.5)
    store.undo()
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes).toHaveLength(2)
    store.redo()
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes[1]!.id).toBe(id)
  })
  it('protects endpoints and the frame limit while allowing deletion of intermediate frames', () => {
    const store = useEditorStore(),
      node = store.document.nodes[0]!.children[1]!
    for (let i = 0; i < 15; i++) store.addKeyframe(node.id)
    const frames = store.document.nodes[0]!.children[1]!.animation.keyframes
    expect(frames).toHaveLength(12)
    store.removeKeyframe(node.id, frames[0]!.id)
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes).toHaveLength(12)
    store.removeKeyframe(node.id, frames[1]!.id)
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes).toHaveLength(11)
    store.undo()
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes).toHaveLength(12)
  })
  it('reverts to the page trigger when a trigger ancestor is deleted, then undoes both changes', () => {
    const store = useEditorStore(),
      parent = store.document.nodes[0]!
    store.commit((doc) => {
      doc.timeline.triggerNodeId = parent.children[0]!.id
    })
    store.remove(parent.id)
    expect(store.document.timeline.triggerNodeId).toBeNull()
    store.undo()
    expect(store.document.timeline.triggerNodeId).toBe(parent.children[0]!.id)
  })
})
describe('motion schema boundaries', () => {
  it.each([
    'duplicate-time',
    'missing-endpoint',
    'invalid-ease',
    'duplicate-id',
    'out-of-range',
  ] as const)('rejects %s frames before committing', (problem) => {
    const doc = newDocument(true)
    const frames = (doc.nodes[0]!.animation.keyframes = insertKeyframe(
      doc.nodes[0]!.animation.keyframes,
    ))
    if (problem === 'duplicate-time') frames[1]!.offset = 0
    if (problem === 'missing-endpoint') frames[2]!.offset = 0.9
    if (problem === 'invalid-ease') Object.assign(frames[1]!, { ease: 'arbitraryFunction()' })
    if (problem === 'duplicate-id') frames[1]!.id = frames[0]!.id
    if (problem === 'out-of-range') frames[1]!.scale = -1
    expect(() => parseDocument(doc)).toThrow()
  })
  it('rejects missing trigger references and nonfinite motion without damaging history', () => {
    const store = useEditorStore(),
      node = store.document.nodes[0]!
    const before = clone(store.document),
      history = store.past.length
    store.update(node.id, {}, undefined, { start: Infinity })
    store.updateKeyframe(node.id, node.animation.keyframes[1]!.id, { offset: 0.8 })
    store.commit((doc) => {
      doc.timeline.triggerNodeId = 'deleted-node'
    })
    expect(store.document).toEqual(before)
    expect(store.past).toHaveLength(history)
    expect(store.error).toContain('关键帧')
  })
})
