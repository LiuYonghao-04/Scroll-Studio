import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { PageNode } from '../types/editor'
gsap.registerPlugin(ScrollTrigger)
export function mountPageAnimations(root: HTMLElement, nodes: PageNode[]): () => void {
  const media = gsap.matchMedia()
  media.add(
    '(prefers-reduced-motion: no-preference)',
    () => {
      function animate(list: PageNode[]) {
        for (const node of list) {
          const a = node.animation
          const el = root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`)
          if (a.enabled && el)
            gsap.fromTo(
              el,
              { x: a.x, y: a.y, scale: a.scale, rotation: a.rotation, opacity: a.opacity },
              {
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                opacity: 1,
                duration: a.duration,
                ease: a.scrub ? 'none' : 'power2.out',
                scrollTrigger: {
                  trigger: el,
                  start: `clamp(top ${a.trigger}%)`,
                  end: 'clamp(bottom 20%)',
                  scrub: a.scrub ? 0.6 : false,
                  toggleActions: 'play none none reverse',
                },
              },
            )
          animate(node.children)
        }
      }
      animate(nodes)
      ScrollTrigger.refresh()
    },
    root,
  )
  return () => media.revert()
}
