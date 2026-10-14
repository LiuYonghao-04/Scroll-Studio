<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import NodeRenderer from '../components/editor/NodeRenderer.vue'
import { newDocument, parseDocument } from '../core/document'
import { loadDocument } from '../services/storage'
import {
  mountPageAnimations,
  refreshPageAnimations,
  type AnimationPlayer,
  type PreviewMode,
} from '../animation/runtime'
const doc = ref(newDocument())
const root = ref<HTMLElement>()
let player: AnimationPlayer | undefined
let revision = 0
async function render(input: unknown, mode: PreviewMode = 'scroll') {
  try {
    const next = parseDocument(input)
    const current = ++revision
    player?.dispose()
    doc.value = next
    await nextTick()
    if (current === revision && root.value)
      player = mountPageAnimations(root.value, next, mode, (state) => {
        window.parent.postMessage({ type: 'scroll-studio:playback', ...state }, location.origin)
      })
  } catch {
    /* Invalid messages never replace the active page. */
  }
}
function receive(event: MessageEvent<unknown>) {
  if (event.origin !== location.origin || event.source !== window.parent) return
  if (typeof event.data !== 'object' || event.data === null) return
  const data = event.data as Record<string, unknown>
  if (data.type === 'scroll-studio:preview')
    void render(data.document, data.mode === 'timeline' ? 'timeline' : 'scroll')
  if (data.type === 'scroll-studio:transport') {
    if (data.action === 'seek' && typeof data.time === 'number' && Number.isFinite(data.time))
      player?.seek(data.time)
    if (data.action === 'play') player?.play()
    if (data.action === 'pause') player?.pause()
  }
}
function refreshImages() {
  refreshPageAnimations()
}
onMounted(() => {
  window.addEventListener('message', receive)
  try {
    const saved = loadDocument()
    if (saved) void render(saved)
  } catch {
    /* A parent preview can still provide valid data. */
  }
  window.parent.postMessage({ type: 'scroll-studio:ready' }, location.origin)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', receive)
  revision++
  player?.dispose()
})
</script>
<template>
  <main ref="root" class="rendered-page" @load.capture="refreshImages">
    <NodeRenderer v-for="node in doc.nodes" :key="node.id" :node="node" />
    <div v-if="!doc.nodes.length" class="empty-preview">这是一个空白页面。返回编辑器添加组件。</div>
  </main>
</template>
