<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import NodeRenderer from '../components/editor/NodeRenderer.vue'
import { newDocument, parseDocument } from '../core/document'
import { loadDocument } from '../services/storage'
import { mountPageAnimations } from '../animation/runtime'
const doc = ref(newDocument())
const root = ref<HTMLElement>()
let cleanup: (() => void) | undefined
let revision = 0
async function render(input: unknown) {
  try {
    const next = parseDocument(input)
    const current = ++revision
    cleanup?.()
    doc.value = next
    await nextTick()
    if (current === revision && root.value) cleanup = mountPageAnimations(root.value, next.nodes)
  } catch {
    /* Invalid messages never replace the active page. */
  }
}
function receive(event: MessageEvent) {
  if (
    event.origin !== location.origin ||
    event.source !== window.parent ||
    event.data?.type !== 'scroll-studio:preview'
  )
    return
  void render(event.data.document)
}
function refreshImages() {
  void render(doc.value)
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
  cleanup?.()
})
</script>
<template>
  <main ref="root" class="rendered-page" @load.capture="refreshImages">
    <NodeRenderer v-for="node in doc.nodes" :key="node.id" :node="node" />
    <div v-if="!doc.nodes.length" class="empty-preview">这是一个空白页面。返回编辑器添加组件。</div>
  </main>
</template>
