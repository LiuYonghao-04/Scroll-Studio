import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEditorStore } from '../stores/editor'
import {
  editFrameOffset,
  editTrackTiming,
  type TimingEdit,
  type TrackTiming,
} from '../core/timeline-edit'
import type { PageNode } from '../types/editor'

interface DragState {
  kind: TimingEdit | 'frame'
  frameId?: string
  pointer: number
  target: HTMLElement
  x: number
  width: number
  span: number
  original: TrackTiming
  timing: TrackTiming
  offset?: number
  initialOffset?: number
  moved: boolean
}
export function useTimelineDrag(
  node: () => PageNode,
  span: () => number,
  snapping: () => boolean,
  select: (frameId?: string) => void,
  active: (value: boolean) => void,
) {
  const store = useEditorStore()
  const drag = ref<DragState>()
  function clear() {
    const previous = drag.value
    drag.value = undefined
    if (!previous) return
    if (previous.target.hasPointerCapture(previous.pointer))
      previous.target.releasePointerCapture(previous.pointer)
    active(false)
  }
  function begin(
    event: PointerEvent,
    lane: HTMLElement | undefined,
    kind: TimingEdit | 'frame',
    frameId?: string,
  ) {
    if (event.button !== 0 || !event.isPrimary || drag.value || !lane) return
    select(frameId)
    const target = event.currentTarget as HTMLElement
    target.focus({ preventScroll: true })
    const frame = node().animation.keyframes.find((f) => f.id === frameId)
    if (kind === 'frame' && (!frame || frame.offset === 0 || frame.offset === 1)) return
    const width = lane.getBoundingClientRect().width
    if (width <= 0) return
    const original = { start: node().animation.start, duration: node().animation.duration }
    target.setPointerCapture(event.pointerId)
    drag.value = {
      kind,
      frameId,
      pointer: event.pointerId,
      target,
      x: event.clientX,
      width,
      span: span(),
      original,
      timing: original,
      offset: frame?.offset,
      initialOffset: frame?.offset,
      moved: false,
    }
    active(true)
  }
  function move(event: PointerEvent) {
    const d = drag.value
    if (!d || d.pointer !== event.pointerId) return
    if (!d.moved && Math.abs(event.clientX - d.x) < 3) return
    d.moved = true
    const delta = ((event.clientX - d.x) / d.width) * d.span
    const step = snapping() && !event.altKey ? 0.1 : 0.01
    if (d.kind === 'frame')
      d.offset = editFrameOffset(
        node().animation.keyframes,
        d.frameId!,
        d.initialOffset! + delta / d.original.duration,
        d.original,
        step,
      )
    else d.timing = editTrackTiming(d.original, d.kind, delta, step)
  }
  function finish(event: PointerEvent) {
    const d = drag.value
    if (!d || d.pointer !== event.pointerId) return
    // Clear before committing: document changes cancel stale pointer gestures.
    clear()
    if (!d.moved) return
    if (d.kind === 'frame' && d.offset !== undefined)
      store.updateKeyframe(node().id, d.frameId!, { offset: d.offset })
    else if (d.kind !== 'frame') store.update(node().id, {}, undefined, d.timing)
  }
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && drag.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
      clear()
    }
  }
  watch(() => store.document, clear, { flush: 'sync' })
  onMounted(() => {
    window.addEventListener('keydown', escape, true)
    window.addEventListener('blur', clear)
  })
  onBeforeUnmount(() => {
    clear()
    window.removeEventListener('keydown', escape, true)
    window.removeEventListener('blur', clear)
  })
  return { drag, begin, move, finish, cancel: clear }
}
