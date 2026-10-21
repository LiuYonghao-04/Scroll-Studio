import { parseDocument } from '../core/document'
import { mountPageAnimations, refreshPageAnimations } from '../animation/runtime'

const root = document.querySelector<HTMLElement>('.rendered-page')
const payload = document.getElementById('scroll-studio-document')
if (root && payload?.textContent) {
  try {
    const player = mountPageAnimations(root, parseDocument(payload.textContent))
    root.addEventListener('load', refreshPageAnimations, true)
    window.addEventListener('load', refreshPageAnimations, { once: true })
    window.addEventListener('pagehide', () => player.dispose(), { once: true })
    // bfcache restores DOM with the old GSAP poses; reload to mount a fresh animation context.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) location.reload()
    })
  } catch (error) {
    console.error('页面动画未能载入；静态内容仍可阅读。', error)
  }
}
