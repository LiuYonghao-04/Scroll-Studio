import type { AnimationKeyframe } from '../types/editor'

export type TimingEdit = 'move' | 'resize-start' | 'resize-end'
export interface TrackTiming {
  start: number
  duration: number
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000
const snap = (value: number, step: number) =>
  step > 0 ? rounded(Math.round(value / step) * step) : rounded(value)

// Resizing stretches relative frame positions; the opposite edge remains anchored.
export function editTrackTiming(
  original: TrackTiming,
  kind: TimingEdit,
  delta: number,
  step = 0.1,
): TrackTiming {
  if (!Number.isFinite(delta) || !Number.isFinite(step) || step < 0) return { ...original }
  const end = original.start + original.duration
  if (kind === 'move')
    return { start: clamp(snap(original.start + delta, step), 0, 30), duration: original.duration }
  if (kind === 'resize-start') {
    const start = rounded(
      clamp(snap(original.start + delta, step), Math.max(0, end - 10), Math.min(30, end - 0.1)),
    )
    return { start, duration: rounded(end - start) }
  }
  const nextEnd = clamp(snap(end + delta, step), original.start + 0.1, original.start + 10)
  return { start: original.start, duration: rounded(nextEnd - original.start) }
}

export function frameOffsetBounds(
  frames: AnimationKeyframe[],
  frameId: string,
): [number, number] | undefined {
  const index = frames.findIndex((frame) => frame.id === frameId)
  if (index <= 0 || index >= frames.length - 1) return
  const previous = frames[index - 1]!.offset,
    next = frames[index + 1]!.offset
  // Imported v2 frames may be much closer than the editor's usual 0.1% precision.
  const gap = Math.min(0.001, (next - previous) / 3)
  return [previous + gap, next - gap]
}
export function editFrameOffset(
  frames: AnimationKeyframe[],
  frameId: string,
  requested: number,
  timing: TrackTiming,
  step = 0.1,
): number | undefined {
  const bounds = frameOffsetBounds(frames, frameId)
  if (
    !bounds ||
    !Number.isFinite(requested) ||
    !Number.isFinite(step) ||
    step < 0 ||
    timing.duration <= 0
  )
    return
  const offset =
    step === 0
      ? requested
      : (snap(timing.start + requested * timing.duration, step) - timing.start) / timing.duration
  return clamp(Math.round(offset * 1_000_000_000) / 1_000_000_000, bounds[0], bounds[1])
}
