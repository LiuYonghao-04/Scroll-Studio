import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createNode, newDocument, parseDocument } from '../src/core/document'
import { compileTrack, insertKeyframe } from '../src/core/motion'
import { editFrameOffset, editTrackTiming, frameOffsetBounds } from '../src/core/timeline-edit'
import { useEditorStore } from '../src/stores/editor'
import { loadDocument } from '../src/services/storage'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})
describe('track edge editing', () => {
  it('moves with absolute grid snapping and preserves duration', () => {
    expect(editTrackTiming({ start: 0.23, duration: 2 }, 'move', 0.34)).toEqual({
      start: 0.6,
      duration: 2,
    })
    expect(editTrackTiming({ start: 0.23, duration: 2 }, 'move', 0.34, 0.01)).toEqual({
      start: 0.57,
      duration: 2,
    })
  })
  it('clamps movement to the schema bounds', () => {
    expect(editTrackTiming({ start: 1, duration: 2 }, 'move', -99).start).toBe(0)
    expect(editTrackTiming({ start: 1, duration: 2 }, 'move', 99).start).toBe(30)
  })
  it('anchors the end when resizing the left edge', () => {
    const result = editTrackTiming({ start: 2, duration: 3 }, 'resize-start', 0.5)
    expect(result).toEqual({ start: 2.5, duration: 2.5 })
    expect(result.start + result.duration).toBe(5)
  })
  it('anchors the start when resizing the right edge', () => {
    expect(editTrackTiming({ start: 2, duration: 3 }, 'resize-end', 1.2)).toEqual({
      start: 2,
      duration: 4.2,
    })
  })
  it('protects the minimum and maximum durations on both edges', () => {
    const timing = { start: 8, duration: 3 }
    expect(editTrackTiming(timing, 'resize-start', 99)).toEqual({ start: 10.9, duration: 0.1 })
    expect(editTrackTiming(timing, 'resize-start', -99)).toEqual({ start: 1, duration: 10 })
    expect(editTrackTiming(timing, 'resize-end', -99).duration).toBe(0.1)
    expect(editTrackTiming(timing, 'resize-end', 99).duration).toBe(10)
  })
  it('keeps the latest legal track valid at 30s', () => {
    const result = editTrackTiming({ start: 30, duration: 10 }, 'resize-start', 100)
    expect(result).toEqual({ start: 30, duration: 10 })
    const node = createNode('heading')
    Object.assign(node.animation, result)
    const doc = newDocument()
    doc.nodes = [node]
    expect(() => parseDocument(doc)).not.toThrow()
  })
  it.each([NaN, Infinity, -Infinity])('ignores nonfinite pointer deltas: %s', (delta) => {
    expect(editTrackTiming({ start: 1, duration: 2 }, 'resize-end', delta)).toEqual({
      start: 1,
      duration: 2,
    })
  })
})
describe('keyframe positioning', () => {
  const frames = () => insertKeyframe(createNode('heading').animation.keyframes)
  it('keeps percentage keyboard edits exact on fractional imported timing', () => {
    const list = frames()
    expect(
      editFrameOffset(list, list[1]!.id, 0.61, { start: 0.1234567, duration: 0.1234567 }, 0),
    ).toBe(0.61)
  })
  it('snaps frames in global seconds, including a fractional track start', () => {
    const list = frames()
    const offset = editFrameOffset(list, list[1]!.id, 0.54, { start: 0.15, duration: 2 })!
    expect(offset).toBeCloseTo(0.525)
    expect(0.15 + 2 * offset).toBeCloseTo(1.2)
  })
  it('prevents a frame from crossing either neighbor and locks endpoints', () => {
    const list = frames(),
      id = list[1]!.id
    expect(editFrameOffset(list, id, -1, { start: 0, duration: 1 })).toBe(0.001)
    expect(editFrameOffset(list, id, 2, { start: 0, duration: 1 })).toBe(0.999)
    expect(editFrameOffset(list, list[0]!.id, 0.5, { start: 0, duration: 1 })).toBeUndefined()
    expect(editFrameOffset(list, list[2]!.id, 0.5, { start: 0, duration: 1 })).toBeUndefined()
  })
  it('preserves strict ordering in densely spaced imported frames', () => {
    const list = frames()
    list[1]!.offset = 0.0001
    list.splice(2, 0, { ...list[1]!, id: crypto.randomUUID(), offset: 0.0002 })
    const offset = editFrameOffset(list, list[1]!.id, 1, { start: 0, duration: 0.1 })!
    expect(offset).toBeGreaterThan(0)
    expect(offset).toBeLessThan(0.0002)
    expect(frameOffsetBounds(list, 'missing')).toBeUndefined()
  })
  it('preserves poses and frame IDs while moving a frame', () => {
    const node = createNode('heading')
    node.animation.keyframes = insertKeyframe(node.animation.keyframes)
    const before = structuredClone(node.animation.keyframes)
    const offset = editFrameOffset(node.animation.keyframes, before[1]!.id, 0.7, node.animation)!
    expect(node.animation.keyframes).toEqual(before)
    node.animation.keyframes[1]!.offset = offset
    expect(compileTrack(node).segments[0]!.duration).toBeCloseTo(0.6)
  })
  it('commits frame movement and edge resizing as separate reversible transactions', () => {
    const store = useEditorStore(),
      node = store.document.nodes[0]!.children[1]!
    store.addKeyframe(node.id)
    const id = store.selectedKeyframeId!
    store.updateKeyframe(node.id, id, { offset: 0.7 })
    store.update(node.id, {}, undefined, editTrackTiming(node.animation, 'resize-end', 1))
    expect(store.document.nodes[0]!.children[1]!.animation.duration).toBe(1.8)
    store.undo()
    expect(store.document.nodes[0]!.children[1]!.animation.duration).toBe(0.8)
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes[1]!.offset).toBe(0.7)
    store.undo()
    expect(store.document.nodes[0]!.children[1]!.animation.keyframes[1]!.offset).toBe(0.5)
    store.redo()
    store.redo()
    expect(store.save()).toBe(true)
    expect(loadDocument()).toEqual(store.document)
  })
})
