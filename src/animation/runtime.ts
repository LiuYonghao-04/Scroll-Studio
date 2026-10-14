import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { PageDocument } from '../types/editor'
import { compileSequence, compileTrack, flattenNodes, type MotionTrack } from '../core/motion'

gsap.registerPlugin(ScrollTrigger)
export type PreviewMode = 'scroll' | 'timeline'
export interface PlaybackState {
  time: number
  duration: number
  playing: boolean
  reducedMotion: boolean
}
export interface AnimationPlayer {
  dispose: () => void
  seek: (time: number) => void
  play: () => void
  pause: () => void
}

export function mountPageAnimations(
  root: HTMLElement,
  doc: PageDocument,
  mode: PreviewMode = 'scroll',
  onState?: (state: PlaybackState) => void,
): AnimationPlayer {
  const sequence = compileSequence(doc.nodes)
  let timeline: gsap.core.Timeline | undefined
  let reducedMotion = false
  let lastSent = 0
  const publish = (force = false) => {
    const now = performance.now()
    if (!force && now - lastSent < 100) return
    lastSent = now
    onState?.({
      time: timeline?.time() ?? 0,
      duration: sequence.duration,
      playing: !!timeline && !timeline.paused() && timeline.progress() < 1,
      reducedMotion,
    })
  }
  const element = (id: string) =>
    root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
  const addTrack = (target: gsap.core.Timeline, track: MotionTrack) => {
    const el = element(track.nodeId)
    if (!el) return
    gsap.set(el, track.initial)
    for (const segment of track.segments)
      target.fromTo(
        el,
        segment.from,
        { ...segment.to, duration: segment.duration, ease: segment.ease, immediateRender: false },
        segment.at,
      )
  }
  // No scroll space means scrub has no reachable progress. Keep short pages visible.
  const settleShortPage = (animation: gsap.core.Timeline, scrub: boolean) => {
    if (ScrollTrigger.maxScroll(window) < 1) {
      if (scrub) animation.progress(1)
      else animation.play()
    }
  }
  const media = gsap.matchMedia()
  media.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      reduced: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      reducedMotion = !!context.conditions?.reduced
      if (reducedMotion) {
        timeline = undefined
        publish(true)
        return
      }
      if (sequence.tracks.length) {
        timeline = gsap.timeline({
          paused: true,
          onUpdate: () => publish(),
          onComplete: () => publish(true),
        })
        for (const track of sequence.tracks) addTrack(timeline, track)
        timeline.pause(0)
        if (mode === 'scroll') {
          const config = doc.timeline
          ScrollTrigger.create({
            animation: timeline,
            trigger: config.triggerNodeId ? (element(config.triggerNodeId) ?? root) : root,
            start: `clamp(top ${config.trigger}%)`,
            end: `clamp(+=${config.scrollDistance})`,
            scrub: config.scrub ? 0.6 : false,
            toggleActions: 'play none none reverse',
            onRefresh: () => {
              if (timeline) settleShortPage(timeline, config.scrub)
            },
          })
        }
      }
      if (mode === 'scroll') {
        for (const node of flattenNodes(doc.nodes).filter(
          (n) => n.animation.enabled && n.animation.mode === 'individual',
        )) {
          const el = element(node.id)
          if (!el) continue
          const independent = gsap.timeline({ paused: true })
          addTrack(independent, compileTrack(node, 0))
          ScrollTrigger.create({
            animation: independent,
            trigger: el,
            start: `clamp(top ${node.animation.trigger}%)`,
            end: 'clamp(bottom 20%)',
            scrub: node.animation.scrub ? 0.6 : false,
            toggleActions: 'play none none reverse',
            onRefresh: () => settleShortPage(independent, node.animation.scrub),
          })
        }
        ScrollTrigger.refresh()
      }
      publish(true)
      return () => {
        timeline = undefined
      }
    },
    root,
  )
  return {
    dispose: () => media.revert(),
    seek: (time) => {
      if (mode === 'timeline' && Number.isFinite(time))
        timeline?.pause(Math.max(0, Math.min(sequence.duration, time)))
      publish(true)
    },
    play: () => {
      if (mode === 'timeline' && timeline) {
        if (timeline.progress() >= 1) timeline.restart()
        else timeline.play()
      }
      publish(true)
    },
    pause: () => {
      timeline?.pause()
      publish(true)
    },
  }
}
export function refreshPageAnimations() {
  ScrollTrigger.refresh()
}
