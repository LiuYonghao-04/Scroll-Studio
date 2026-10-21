<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import NodeRenderer from '../components/editor/NodeRenderer.vue'
import { newDocument, parseDocument } from '../core/document'
import { loadDocument } from '../services/storage'
import { deviceForWidth } from '../core/responsive'
import { ACTIVE_PROJECT_KEY, getProject } from '../services/projects'
import {
  mountPageAnimations,
  refreshPageAnimations,
  type AnimationPlayer,
  type PreviewMode,
} from '../animation/runtime'
const doc = ref(newDocument())
const root = ref<HTMLElement>()
const device = ref(deviceForWidth(window.innerWidth))
let observer: ResizeObserver | undefined
let resizeFrame = 0
let player: AnimationPlayer | undefined
let revision = 0
let activeRequest: number | undefined
async function render(input: unknown, mode: PreviewMode = 'scroll', requestId = 0) {
  try {
    const next = parseDocument(input)
    const current = ++revision
    activeRequest = undefined
    player?.dispose()
    doc.value = next
    await nextTick()
    if (current === revision && root.value) {
      activeRequest = requestId
      player = mountPageAnimations(root.value, next, mode, (state) => {
        window.parent.postMessage(
          { type: 'scroll-studio:playback', ...state, requestId },
          location.origin,
        )
      })
    }
  } catch {
    /* Invalid messages never replace the active page. */
  }
}
function receive(event: MessageEvent<unknown>) {
  if (event.origin !== location.origin || event.source !== window.parent) return
  if (typeof event.data !== 'object' || event.data === null) return
  const data = event.data as Record<string, unknown>
  if (
    data.type === 'scroll-studio:preview' &&
    typeof data.requestId === 'number' &&
    Number.isSafeInteger(data.requestId)
  )
    void render(data.document, data.mode === 'timeline' ? 'timeline' : 'scroll', data.requestId)
  // Ignore controls and feedback belonging to a superseded preview render.
  if (
    data.type === 'scroll-studio:transport' &&
    activeRequest !== undefined &&
    data.requestId === activeRequest
  ) {
    if (data.action === 'seek' && typeof data.time === 'number' && Number.isFinite(data.time))
      player?.seek(data.time)
    if (data.action === 'play') player?.play()
    if (data.action === 'pause') player?.pause()
  }
}
function refreshImages() {
  refreshPageAnimations()
}
function previewKeyboard(event: KeyboardEvent) {
  if (window.parent === window || activeRequest === undefined) return
  if (event.key === 'Escape') {
    event.preventDefault()
    window.parent.postMessage(
      { type: 'scroll-studio:close-preview', requestId: activeRequest },
      location.origin,
    )
  }
  if (event.key !== 'Tab') return
  const targets = [...document.querySelectorAll<HTMLElement>('a[href]')].filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
  )
  if (
    !targets.length ||
    (event.shiftKey && document.activeElement === targets[0]) ||
    (!event.shiftKey && document.activeElement === targets.at(-1))
  ) {
    event.preventDefault()
    window.parent.postMessage(
      { type: 'scroll-studio:focus-boundary', backward: event.shiftKey, requestId: activeRequest },
      location.origin,
    )
  }
}
onMounted(async () => {
  observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? window.innerWidth
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      device.value = deviceForWidth(width)
    })
  })
  if (root.value) observer.observe(root.value)
  window.addEventListener('message', receive)
  window.addEventListener('keydown', previewKeyboard)
  window.parent.postMessage({ type: 'scroll-studio:ready' }, location.origin)
  if (window.parent !== window) return
  try {
    const id = localStorage.getItem(ACTIVE_PROJECT_KEY)
    const saved = id ? (await getProject(id)).document : loadDocument()
    if (saved) void render(saved)
  } catch {
    /* A parent preview can still provide valid data. */
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(resizeFrame)
  window.removeEventListener('message', receive)
  window.removeEventListener('keydown', previewKeyboard)
  revision++
  player?.dispose()
})
</script>
<template>
  <main ref="root" class="rendered-page" @load.capture="refreshImages">
    <NodeRenderer
      v-for="node in doc.nodes"
      :key="node.id"
      :node="node"
      :device="device"
      :assets="doc.assets"
    />
    <div v-if="!doc.nodes.length" class="empty-preview">这是一个空白页面。返回编辑器添加组件。</div>
  </main>
</template>
